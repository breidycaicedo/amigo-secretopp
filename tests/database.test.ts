/**
 * Prueba el SQL REAL de supabase/migrations en un PostgreSQL embebido (PGlite):
 * restricciones, triggers de bloqueo, sorteo atómico y permisos/RLS.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const migration = readFileSync(path.resolve(__dirname, "../supabase/migrations/0001_init.sql"), "utf8");

let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  `);
});

/** Base de datos limpia para cada prueba: se borra el esquema y se vuelve a ejecutar la migración. */
async function fresh(): Promise<void> {
  await pg.exec(`
    reset role;
    drop schema if exists public cascade;
    create schema public;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await pg.exec(migration);
}

async function addParticipant(name: string, code: string, targetId: string | null = null, hasPaper = false): Promise<string> {
  const result = await pg.query<{ id: string }>(
    `insert into participants (name, name_normalized, student_code, has_existing_assignment, reported_target_name, reported_target_id, reported_target_confirmed)
     values ($1, lower($1), $2, $3, $4, $5, $6) returning id`,
    [name, code, hasPaper, hasPaper ? "alguien" : null, targetId, targetId !== null],
  );
  return result.rows[0].id;
}

async function status(): Promise<string> {
  const result = await pg.query<{ status: string }>("select status from game_settings where id = 1");
  return result.rows[0].status;
}

async function commit(ids: string[], pairs: Array<[string, string, "EXISTING" | "GENERATED"]>) {
  const payload = JSON.stringify(pairs.map(([giver, receiver, source]) => ({ giver_id: giver, receiver_id: receiver, source })));
  return pg.query("select commit_assignments($1::uuid[], $2::jsonb) as done", [ids, payload]);
}

async function count(table: string): Promise<number> {
  const result = await pg.query<{ n: number }>(`select count(*)::int as n from ${table}`);
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
      "select assignments_locked, assignment_completed_at from game_settings",
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
    await expect(pg.query("insert into assignments (giver_id, receiver_id, source) values ($1, $2, 'GENERATED')", [a, b])).rejects.toThrow(
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
      await expect(pg.query("select commit_assignments('{}'::uuid[], '[]'::jsonb)")).rejects.toThrow(/permission denied/);
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

  it("el servidor (service_role) sí puede operar", async () => {
    await addParticipant("Ana", "A00123456");
    await pg.exec("set role service_role");
    const result = await pg.query("select id from participants");
    expect(result.rows).toHaveLength(1);
    await pg.exec("reset role");
  });
});
