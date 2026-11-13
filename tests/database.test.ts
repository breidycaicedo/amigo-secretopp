/**
 * Prueba el SQL REAL de supabase/migrations en un PostgreSQL embebido (PGlite):
 * restricciones, triggers de bloqueo, sorteo atómico y permisos/RLS.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const migration = readFileSync(path.resolve(__dirname, "../supabase/migrations/0001_init.sql"), "utf8");
const photosMigration = readFileSync(path.resolve(__dirname, "../supabase/migrations/0002_wishlist_photos.sql"), "utf8");
const multiGameMigration = readFileSync(path.resolve(__dirname, "../supabase/migrations/0003_multi_game.sql"), "utf8");

let pg: PGlite;
/** Juego por defecto de las pruebas (cada prueba arranca con una base limpia). */
let gameId: string;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    -- Versión mínima del esquema storage de Supabase para probar 0002.
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  `);
});

async function resetSchema(): Promise<void> {
  await pg.exec(`
    reset role;
    drop schema if exists public cascade;
    create schema public;
    grant usage on schema public to anon, authenticated, service_role;
  `);
}

/** Base de datos limpia para cada prueba: esquema actual (0001 → 0002 → 0003) con un juego de prueba. */
async function fresh(): Promise<void> {
  await resetSchema();
  await pg.exec(migration);
  await pg.exec(photosMigration);
  await pg.exec(photosMigration); // se puede ejecutar dos veces
  await pg.exec(multiGameMigration);
  await pg.exec(multiGameMigration); // se puede ejecutar dos veces
  gameId = await createGame("Prueba", "prueba");
}

async function createGame(name: string, slug: string): Promise<string> {
  const result = await pg.query<{ id: string }>(
    "insert into games (slug, name) values ($1, $2) returning id",
    [slug, name],
  );
  const id = result.rows[0].id;
  await pg.query("insert into game_settings (game_id) values ($1)", [id]);
  return id;
}

async function addParticipant(
  name: string,
  code: string,
  targetId: string | null = null,
  hasPaper = false,
  game: string = gameId,
): Promise<string> {
  const result = await pg.query<{ id: string }>(
    `insert into participants (game_id, name, name_normalized, student_code, has_existing_assignment, reported_target_name, reported_target_id, reported_target_confirmed)
     values ($1, $2, lower($2), $3, $4, $5, $6, $7) returning id`,
    [game, name, code, hasPaper, hasPaper ? "alguien" : null, targetId, targetId !== null],
  );
  return result.rows[0].id;
}

async function status(game: string = gameId): Promise<string> {
  const result = await pg.query<{ status: string }>("select status from game_settings where game_id = $1", [game]);
  return result.rows[0].status;
}

async function commit(ids: string[], pairs: Array<[string, string, "EXISTING" | "GENERATED"]>, game: string = gameId) {
  const payload = JSON.stringify(pairs.map(([giver, receiver, source]) => ({ giver_id: giver, receiver_id: receiver, source })));
  return pg.query("select commit_assignments($1::uuid, $2::uuid[], $3::jsonb) as done", [game, ids, payload]);
}

async function count(table: string, game: string = gameId): Promise<number> {
  const result = await pg.query<{ n: number }>(`select count(*)::int as n from ${table} where game_id = $1`, [game]);
  return result.rows[0].n;
}

beforeEach(async () => {
  await fresh();
});

describe("restricciones de datos", () => {
  it("rechaza códigos con formato inválido y duplicados", async () => {
    await addParticipant("Ana", "A00123456");
    await expect(addParticipant("Otra", "A00123456")).rejects.toThrow(/unique|duplicate/i);
    await expect(addParticipant("Mal", "B00123456")).rejects.toThrow(/student_code_format/);
    await expect(addParticipant("Mal", "A0012345")).rejects.toThrow(/student_code_format/);
  });

  it("no permite reportarse a sí mismo", async () => {
    const id = await addParticipant("Ana", "A00123456");
    await expect(
      pg.query("update participants set has_existing_assignment = true, reported_target_name = 'Ana', reported_target_id = $1 where id = $1", [id]),
    ).rejects.toThrow(/no_self_report/);
  });

  it("al eliminar a alguien, los papelitos que lo mencionan quedan pendientes (no se borran)", async () => {
    const gaby = await addParticipant("Gabriela", "A00000002");
    const brendy = await addParticipant("Brendy", "A00000001", gaby, true);
    await pg.query("delete from participants where id = $1", [gaby]);
    const row = await pg.query<{ has_existing_assignment: boolean; reported_target_id: string | null; reported_target_name: string }>(
      "select has_existing_assignment, reported_target_id, reported_target_name from participants where id = $1",
      [brendy],
    );
    expect(row.rows[0]).toEqual({ has_existing_assignment: true, reported_target_id: null, reported_target_name: "alguien" });
    const confirmed = await pg.query<{ reported_target_confirmed: boolean }>("select reported_target_confirmed from participants where id = $1", [brendy]);
    expect(confirmed.rows[0].reported_target_confirmed).toBe(false);
  });
});

describe("fotos de la lista de deseos", () => {
  it("el bucket es privado y solo acepta imágenes", async () => {
    const result = await pg.query<{ public: boolean; allowed_mime_types: string[] }>("select public, allowed_mime_types from storage.buckets where id = 'wishlist'");
    expect(result.rows[0].public).toBe(false);
    expect(result.rows[0].allowed_mime_types).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("máximo 4 fotos y siempre dentro de la carpeta propia", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    const own = (n: number) => Array.from({ length: n }, (_, i) => `${a}/${i}.jpg`);
    await pg.query("update participants set wishlist_photos = $1 where id = $2", [own(4), a]);
    await expect(pg.query("update participants set wishlist_photos = $1 where id = $2", [own(5), a])).rejects.toThrow(/photos_max/);
    await expect(pg.query("update participants set wishlist_photos = $1 where id = $2", [[`${b}/x.jpg`], a])).rejects.toThrow(/photos_owner/);
    await expect(pg.query("update participants set wishlist_photos = $1 where id = $2", [[`${a}/../${b}/x.jpg`], a])).rejects.toThrow(/photos_owner/);
  });

  it("después del sorteo las fotos solo cambian si la administradora lo permite", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    await commit([a, b], [[a, b, "GENERATED"], [b, a, "GENERATED"]]);
    await expect(pg.query("update participants set wishlist_photos = $1 where id = $2", [[`${a}/1.jpg`], a])).rejects.toThrow(/GAME_LOCKED/);
    await pg.query("update game_settings set allow_wishlist_edit_after_lock = true");
    await pg.query("update participants set wishlist_photos = $1 where id = $2", [[`${a}/1.jpg`], a]);
  });
});

describe("eliminación", () => {
  it("se pueden eliminar varios participantes que se reportan entre sí", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002", a, true);
    await pg.query("update participants set has_existing_assignment = true, reported_target_name = 'Persona B', reported_target_id = $1, reported_target_confirmed = true where id = $2", [b, a]);
    await pg.query("delete from participants");
    expect(await count("participants")).toBe(0);
  });
});

describe("sorteo atómico", () => {
  it("guarda una permutación válida y bloquea el juego", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    const c = await addParticipant("Persona C", "A00000003", a, true);
    await commit([a, b, c], [[a, b, "GENERATED"], [b, c, "GENERATED"], [c, a, "EXISTING"]]);
    expect(await status()).toBe("ASSIGNED");
    expect(await count("assignments")).toBe(3);
    const settings = await pg.query<{ assignments_locked: boolean; assignment_completed_at: string | null }>(
      "select assignments_locked, assignment_completed_at from game_settings where game_id = $1",
      [gameId],
    );
    expect(settings.rows[0].assignments_locked).toBe(true);
    expect(settings.rows[0].assignment_completed_at).not.toBeNull();
  });

  it("A → A es rechazado y no guarda NADA", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    await expect(commit([a, b], [[a, a, "GENERATED"], [b, b, "GENERATED"]])).rejects.toThrow();
    expect(await status()).toBe("REGISTRATION_OPEN");
    expect(await count("assignments")).toBe(0);
  });

  it("A → B y C → B es rechazado (receptor duplicado)", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    const c = await addParticipant("Persona C", "A00000003");
    await expect(commit([a, b, c], [[a, b, "GENERATED"], [b, a, "GENERATED"], [c, b, "GENERATED"]])).rejects.toThrow(/unique|duplicate/i);
    expect(await status()).toBe("REGISTRATION_OPEN");
    expect(await count("assignments")).toBe(0);
  });

  it("no permite ignorar un papelito existente", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    const c = await addParticipant("Persona C", "A00000003", b, true);
    await expect(commit([a, b, c], [[a, b, "GENERATED"], [b, c, "GENERATED"], [c, a, "GENERATED"]])).rejects.toThrow(
      /EXISTING_NOT_PRESERVED/,
    );
    expect(await count("assignments")).toBe(0);
  });

  it("aborta si la lista de participantes cambió durante el cálculo", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    await addParticipant("Tarde", "A00000009");
    await expect(commit([a, b], [[a, b, "GENERATED"], [b, a, "GENERATED"]])).rejects.toThrow(/PARTICIPANTS_CHANGED/);
  });

  it("no permite volver a sortear", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    await commit([a, b], [[a, b, "GENERATED"], [b, a, "GENERATED"]]);
    await expect(commit([a, b], [[a, b, "GENERATED"], [b, a, "GENERATED"]])).rejects.toThrow(/ALREADY_ASSIGNED/);
    await expect(pg.query("update game_settings set status = 'REGISTRATION_OPEN'")).rejects.toThrow(/ALREADY_ASSIGNED/);
  });
});

describe("bloqueos después del sorteo", () => {
  async function assignedGame() {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    await commit([a, b], [[a, b, "GENERATED"], [b, a, "GENERATED"]]);
    return { a, b };
  }

  it("ASSIGNED bloquea registro, edición y eliminación", async () => {
    const { a } = await assignedGame();
    await expect(addParticipant("Nuevo", "A00000003")).rejects.toThrow(/GAME_LOCKED/);
    await expect(pg.query("update participants set name = 'Otro' where id = $1", [a])).rejects.toThrow(/GAME_LOCKED/);
    await expect(pg.query("delete from participants where id = $1", [a])).rejects.toThrow(/GAME_LOCKED/);
  });

  it("nadie puede modificar ni borrar asignaciones", async () => {
    const { a } = await assignedGame();
    await expect(pg.query("update assignments set receiver_id = giver_id where giver_id = $1", [a])).rejects.toThrow(
      /ASSIGNMENTS_LOCKED|no_self/,
    );
    await expect(pg.query("delete from assignments")).rejects.toThrow(/ASSIGNMENTS_LOCKED/);
    await expect(pg.query("truncate assignments")).rejects.toThrow(/ASSIGNMENTS_LOCKED/);
  });

  it("no se pueden insertar asignaciones fuera del sorteo", async () => {
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    await expect(pg.query("insert into assignments (game_id, giver_id, receiver_id, source) values ($1, $2, $3, 'GENERATED')", [gameId, a, b])).rejects.toThrow(
      /ASSIGNMENTS_LOCKED/,
    );
  });

  it("la lista de deseos solo se edita después si la administradora lo permite", async () => {
    const { a } = await assignedGame();
    await expect(pg.query("update participants set wishlist = 'Libro' where id = $1", [a])).rejects.toThrow(/GAME_LOCKED/);
    await pg.query("update game_settings set allow_wishlist_edit_after_lock = true");
    await pg.query("update participants set wishlist = 'Libro' where id = $1", [a]);
    await expect(pg.query("update participants set wishlist = 'x', name = 'Hack' where id = $1", [a])).rejects.toThrow(/GAME_LOCKED/);
  });
});

describe("permisos y RLS", () => {
  it("los roles públicos (anon/authenticated) no pueden leer ni escribir nada", async () => {
    await addParticipant("Ana", "A00123456");
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      await expect(pg.query("select * from participants")).rejects.toThrow(/permission denied/);
      await expect(pg.query("select * from assignments")).rejects.toThrow(/permission denied/);
      await expect(pg.query("select * from game_settings")).rejects.toThrow(/permission denied/);
      await expect(pg.query("update game_settings set status = 'ASSIGNED'")).rejects.toThrow(/permission denied/);
      await expect(pg.query("select commit_assignments(null, '{}'::uuid[], '[]'::jsonb)")).rejects.toThrow(/permission denied/);
      await pg.exec("reset role");
    }
  });

  it("aunque alguien otorgue permisos por error, RLS sigue negando el acceso", async () => {
    await addParticipant("Ana", "A00123456");
    await pg.exec("grant select on participants to anon; set role anon;");
    const result = await pg.query("select * from participants");
    expect(result.rows).toHaveLength(0);
    await pg.exec("reset role");
  });

  it("el servidor (service_role) sí puede operar: registrar, editar fotos y sortear", async () => {
    await pg.exec("set role service_role");
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    await pg.query("update participants set wishlist_photos = $1 where id = $2", [[`${a}/1.jpg`], a]);
    await commit([a, b], [[a, b, "GENERATED"], [b, a, "GENERATED"]]);
    const result = await pg.query("select id from participants");
    expect(result.rows).toHaveLength(2);
    await pg.exec("reset role");
  });
});

describe("varios juegos independientes", () => {
  it("el mismo código puede estar en dos juegos distintos, pero no repetido dentro de uno", async () => {
    const otro = await createGame("Otro grupo", "otro-grupo");
    await addParticipant("Ana", "A00123456");
    await addParticipant("Ana en otro", "A00123456", null, false, otro);
    await expect(addParticipant("Ana repetida", "A00123456")).rejects.toThrow(/unique|duplicate/i);
  });

  it("un papelito solo puede apuntar a alguien del mismo juego", async () => {
    const otro = await createGame("Otro grupo", "otro-grupo");
    const ajena = await addParticipant("Ajena", "A00000009", null, false, otro);
    await expect(addParticipant("Mía", "A00000001", ajena, true)).rejects.toThrow(/REFERENCE_OTHER_GAME/);
  });

  it("sortear un juego no bloquea otro, y cada juego sortea con sus propios participantes", async () => {
    const otro = await createGame("Otro grupo", "otro-grupo");
    const a = await addParticipant("Persona A", "A00000001");
    const b = await addParticipant("Persona B", "A00000002");
    const x = await addParticipant("Persona X", "A00000003", null, false, otro);
    const y = await addParticipant("Persona Y", "A00000004", null, false, otro);
    await commit([a, b], [[a, b, "GENERATED"], [b, a, "GENERATED"]]);
    expect(await status()).toBe("ASSIGNED");
    expect(await status(otro)).toBe("REGISTRATION_OPEN");
    await commit([x, y], [[x, y, "GENERATED"], [y, x, "GENERATED"]], otro);
    expect(await status(otro)).toBe("ASSIGNED");
  });

  it("no se puede sortear con participantes de otro juego", async () => {
    const otro = await createGame("Otro grupo", "otro-grupo");
    const a = await addParticipant("Persona A", "A00000001");
    const x = await addParticipant("Persona X", "A00000003", null, false, otro);
    const y = await addParticipant("Persona Y", "A00000004", null, false, otro);
    await expect(commit([a, x], [[a, x, "GENERATED"], [x, a, "GENERATED"]])).rejects.toThrow();
    await expect(commit([x, y], [[x, y, "GENERATED"], [y, x, "GENERATED"]], gameId)).rejects.toThrow(/PARTICIPANTS_CHANGED/);
    expect(await count("assignments")).toBe(0);
  });

  it("nadie puede cambiar de juego a un participante", async () => {
    const otro = await createGame("Otro grupo", "otro-grupo");
    const a = await addParticipant("Persona A", "A00000001");
    await expect(pg.query("update participants set game_id = $1 where id = $2", [otro, a])).rejects.toThrow(/GAME_IMMUTABLE/);
  });

  it("el nombre del enlace (slug) es único y con formato válido", async () => {
    await expect(createGame("Repetido", "prueba")).rejects.toThrow(/unique|duplicate/i);
    await expect(createGame("Mal", "Mal Slug")).rejects.toThrow(/games_slug_format/);
  });
});

describe("migración del juego existente (versión de una sola fila)", () => {
  it("conserva participantes, papelitos y el sorteo, y los asigna al juego «grupo-8»", async () => {
    await resetSchema();
    await pg.exec(migration);
    await pg.exec(photosMigration);
    // Estado anterior: una sola fila de configuración con datos reales.
    await pg.exec("insert into game_settings (id) values (1)");
    const a = await pg.query<{ id: string }>(
      `insert into participants (name, name_normalized, student_code) values ('Persona A', 'persona a', 'A00000001') returning id`,
    );
    const b = await pg.query<{ id: string }>(
      `insert into participants (name, name_normalized, student_code, has_existing_assignment, reported_target_name, reported_target_id, reported_target_confirmed)
       values ('Persona B', 'persona b', 'A00000002', true, 'Persona A', $1, true) returning id`,
      [a.rows[0].id],
    );
    await pg.query("update game_settings set status = 'REGISTRATION_OPEN' where id = 1");

    await pg.exec(multiGameMigration);
    await pg.exec(multiGameMigration);

    const game = await pg.query<{ id: string; slug: string; name: string }>("select id, slug, name from games");
    expect(game.rows).toEqual([{ id: game.rows[0].id, slug: "grupo-8", name: "Grupo 8" }]);
    const people = await pg.query<{ game_id: string }>("select game_id from participants");
    expect(people.rows.every((row) => row.game_id === game.rows[0].id)).toBe(true);
    const settings = await pg.query<{ game_id: string; status: string }>("select game_id, status from game_settings");
    expect(settings.rows).toEqual([{ game_id: game.rows[0].id, status: "REGISTRATION_OPEN" }]);
    const reported = await pg.query<{ reported_target_id: string; reported_target_confirmed: boolean }>(
      "select reported_target_id, reported_target_confirmed from participants where id = $1",
      [b.rows[0].id],
    );
    expect(reported.rows[0]).toEqual({ reported_target_id: a.rows[0].id, reported_target_confirmed: true });

    // Y el sorteo nuevo funciona por juego.
    await pg.query("select commit_assignments($1::uuid, $2::uuid[], $3::jsonb)", [
      game.rows[0].id,
      [a.rows[0].id, b.rows[0].id],
      JSON.stringify([
        { giver_id: a.rows[0].id, receiver_id: b.rows[0].id, source: "GENERATED" },
        { giver_id: b.rows[0].id, receiver_id: a.rows[0].id, source: "EXISTING" },
      ]),
    ]);
    const after = await pg.query<{ status: string }>("select status from game_settings");
    expect(after.rows[0].status).toBe("ASSIGNED");
  });
});
