# 🎁 Amigo Secreto

Aplicación web para organizar un amigo secreto que empezó con papelitos: **conserva los papelitos que sobrevivieron, completa al azar los que faltan** y deja que la administradora decida cuándo se hace el sorteo definitivo.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + RLS) · Vercel.

---

## Índice

1. [Cómo funciona](#cómo-funciona)
2. [Puesta en marcha paso a paso](#puesta-en-marcha-paso-a-paso) (Supabase → GitHub → Vercel)
3. [Variables de entorno](#variables-de-entorno)
4. [Ejecutar en tu computador](#ejecutar-en-tu-computador)
5. [Seguridad y privacidad](#seguridad-y-privacidad)
6. [El algoritmo de asignación](#el-algoritmo-de-asignación)
7. [Pruebas](#pruebas)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Preguntas frecuentes y reinicio del juego](#preguntas-frecuentes)

---

## Cómo funciona

```
Todos se registran → la administradora revisa → pulsa «ASIGNAR TODOS»
→ el sistema analiza → asigna → bloquea → cada quien ve su amigo secreto
```

**Participantes**

- `/registro` — nombre, código (`A00xxxxxx`), lista de deseos y si tienen papelito.
  - Si tienen papelito, escriben el nombre: el sistema sugiere participantes registrados. Si el nombre coincide con varias personas («Gabriela»), pide elegir cuál. Si la persona aún no se registra, el papelito queda como **referencia pendiente** y se vincula sola cuando esa persona se registre.
  - Si no tienen papelito, quedan **pendientes** hasta el sorteo.
- `/login` — entran con su código; la sesión dura 14 días.
- `/mi-cuenta` — editan sus datos mientras el registro esté abierto. Después del sorteo ven **solo** a quién le regalan y su lista de deseos.

**Administradora**

- `/admin/login` — entrada separada con el código guardado en `ADMIN_CODE`.
- `/admin` — tablero: registrados vs. esperados, papelitos existentes, pendientes por resolver, problemas detectados y el botón **🎁 ASIGNAR TODOS** (con confirmación, y confirmación extra si faltan personas).
- `/admin/participantes` — tabla con nombre, código, papelito, persona reportada y estado (OK / Pendiente / Verificar / Sin vincular / Conflicto). Permite confirmar o corregir vínculos y eliminar registros mientras el registro está abierto.
- `/admin/asignaciones` — todas las asignaciones (difuminadas hasta pulsar «Mostrar», por si la administradora también participa).

**Estados del juego:** `REGISTRATION_OPEN` → `ASSIGNING` → `ASSIGNED`. Nunca se sortea solo: únicamente cuando la administradora pulsa el botón. Una vez `ASSIGNED`, no se puede volver a sortear ni modificar nada (salvo la lista de deseos, si la administradora lo permite).

---

## Puesta en marcha paso a paso

> No necesitas saber programar. Necesitas cuentas gratuitas en [Supabase](https://supabase.com), [GitHub](https://github.com) y [Vercel](https://vercel.com).

### 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com/dashboard> → **New project**.
2. Ponle un nombre (ej. `amigo-secreto`), una contraseña de base de datos (guárdala) y la región más cercana (ej. *South America (São Paulo)* o *East US*).
3. Espera a que termine de crearse (1–2 minutos).

### 2. Ejecutar el SQL

1. En el menú izquierdo: **SQL Editor** → **New query**.
2. Abre el archivo [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), copia **todo** su contenido y pégalo.
3. Pulsa **Run**. Debe decir *Success. No rows returned*.
4. (Opcional) En **Table Editor** verás las tablas `participants`, `assignments`, `game_settings` y `login_attempts`, todas con el candado de RLS activo.

> El script se puede volver a ejecutar sin romper nada (es idempotente).

### 3. Copiar las claves de Supabase

En **Project Settings → API** (o **Data API** / **API Keys**, según la versión del panel):

| Lo que ves en Supabase | Variable |
|---|---|
| Project URL (`https://xxxx.supabase.co`) | `SUPABASE_URL` |
| Clave **secret** (`sb_secret_…`) o, en proyectos antiguos, **service_role** | `SUPABASE_SERVICE_ROLE_KEY` |

⚠️ La clave secreta da acceso total a la base de datos. **Nunca** la pegues en el código, en GitHub ni en una variable que empiece con `NEXT_PUBLIC_`. Solo va en Vercel (y en tu `.env.local`).

### 4. Subir el proyecto a GitHub

1. Crea un repositorio **privado** nuevo en <https://github.com/new> (ej. `amigo-secreto`). No marques «Add README».
2. En una terminal, dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Amigo Secreto"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/amigo-secreto.git
git push -u origin main
```

El archivo `.gitignore` ya evita subir `.env`, `.env.local`, `node_modules` y otros secretos. Verifica en GitHub que **no** aparezca ningún archivo `.env.local`.

> ¿Sin terminal? Usa [GitHub Desktop](https://desktop.github.com): *File → Add local repository* → *Publish repository* (marca *Keep this code private*).

### 5. Crear el proyecto en Vercel y conectar GitHub

1. Entra a <https://vercel.com/new>.
2. **Import Git Repository** → autoriza GitHub → elige `amigo-secreto`.
3. Vercel detecta Next.js automáticamente. No cambies los comandos de build.

### 6. Configurar las variables de entorno en Vercel

Antes de pulsar *Deploy*, abre **Environment Variables** y agrega:

| Nombre | Valor |
|---|---|
| `SUPABASE_URL` | La Project URL del paso 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | La clave secreta del paso 3 |
| `ADMIN_CODE` | El código de estudiante de la administradora (formato `A00xxxxxx`) |
| `SESSION_SECRET` | Una cadena aleatoria de **mínimo 32 caracteres** (ver abajo) |
| `ADMIN_PASSWORD` | *(Opcional, recomendado)* una contraseña extra para Administración |

Para generar `SESSION_SECRET` puedes usar cualquiera de estas opciones:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# o
openssl rand -base64 32
```

…o simplemente escribir una frase larga y rara de más de 40 caracteres.

> Si luego cambias una variable en Vercel (*Settings → Environment Variables*), haz **Redeploy** para que se aplique.

### 7. Deploy

Pulsa **Deploy**. En 1–2 minutos tendrás una URL como `https://amigo-secreto-xxxx.vercel.app`.

### 8. Abrir la URL y probar el registro

1. Abre la URL → **Registrarme**.
2. Registra un participante de prueba con un código válido (ej. `A00123456`).
3. Verás «¡Listo! Ya estás registrado.» y podrás entrar a *Mi cuenta*.

### 9. Probar la administración

1. Vuelve al inicio → **Administración** → escribe el código de `ADMIN_CODE` (y la contraseña, si la configuraste).
2. En **Configuración**, escribe la *cantidad esperada de participantes*.
3. Comparte el enlace con los participantes y espera a que todos se registren.
4. Revisa **Participantes**: confirma los papelitos marcados como *Verificar* y vincula los *Sin vincular*.

> Si hiciste registros de prueba, elimínalos desde **Participantes** antes del sorteo.

### 10. Ejecutar la asignación

1. En **Panel**, cuando no haya problemas pendientes, pulsa **🎁 ASIGNAR TODOS**.
2. Revisa el resumen y confirma. Si faltan personas por registrarse, deberás marcar una confirmación adicional.
3. Listo: el juego queda bloqueado y cada participante ve su amigo secreto en *Mi cuenta*.

---

## Variables de entorno

| Variable | Obligatoria | Dónde se usa | Descripción |
|---|---|---|---|
| `SUPABASE_URL` | Sí | Servidor | URL del proyecto de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Servidor | Clave secreta de Supabase. Nunca llega al navegador. |
| `ADMIN_CODE` | Sí | Servidor | Código de la administradora (`A00xxxxxx`). Se compara en el servidor con comparación de tiempo constante. |
| `SESSION_SECRET` | Sí | Servidor + proxy | Firma las cookies de sesión. Mínimo 32 caracteres. Cambiarlo cierra todas las sesiones. |
| `ADMIN_PASSWORD` | No | Servidor | Si existe, Administración pide además esta contraseña. |

**¿Por qué no hay variables `NEXT_PUBLIC_…`?** Porque el navegador nunca habla con Supabase: todo pasa por el servidor de Next.js después de verificar la sesión. Así ni la URL ni ninguna clave se exponen en el JavaScript público, y la base de datos puede negar **todo** acceso público.

Para trabajar en tu computador, copia `.env.example` como `.env.local` y llénalo. `.env.local` está en `.gitignore`.

---

## Ejecutar en tu computador

Requisitos: Node.js 20.9 o superior.

```bash
npm install
cp .env.example .env.local   # y completa los valores
npm run dev                  # http://localhost:3000
```

Otros comandos:

```bash
npm test           # pruebas (algoritmo, validaciones, rutas, SQL real)
npm run typecheck  # TypeScript estricto
npm run build      # build de producción (igual que Vercel)
```

---

## Seguridad y privacidad

**Principio:** la información privada ni siquiera llega al navegador.

| Capa | Qué hace |
|---|---|
| **Base de datos (RLS + permisos)** | Las 4 tablas tienen RLS activo, políticas restrictivas que niegan todo a `anon`/`authenticated` y se revocan sus privilegios. Aunque alguien consiga la URL y la clave pública de Supabase, no puede leer ni escribir nada. La función de sorteo tampoco se puede invocar públicamente. |
| **Triggers** | Bloquean registros/ediciones fuera de `REGISTRATION_OPEN`, impiden insertar asignaciones fuera del sorteo, impiden modificar o borrar asignaciones, y solo permiten transiciones de estado válidas (no se puede volver de `ASSIGNED`). Funcionan incluso si alguien usa la clave secreta por error. |
| **Sorteo atómico** | `commit_assignments` guarda todo en una sola transacción, vuelve a verificar que el resultado sea una permutación válida que conserva los papelitos, y aborta si alguien se registró mientras tanto. Si algo falla, no se guarda nada. |
| **Sesiones** | Cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción, firmada (JWT HS256) con `SESSION_SECRET`. El ID del participante sale **siempre** de la cookie firmada, nunca de la URL ni del formulario. Las sesiones de administración duran 8 horas y se invalidan si cambia `ADMIN_CODE`. |
| **Rutas** | `proxy.ts` bloquea `/admin/*` (403 para participantes) y `/mi-cuenta`. Además, cada página y cada Server Action vuelve a verificar la sesión (defensa en profundidad). |
| **Datos mínimos** | `/mi-cuenta` consulta solo el nombre y la lista de deseos de *su* amigo secreto. El buscador de nombres del registro solo devuelve id y nombre (máx. 6 resultados), nunca códigos, deseos ni asignaciones. |
| **Fuerza bruta** | Máximo 10 intentos fallidos de entrada por IP cada 15 minutos (5 para Administración). Las IP se guardan como hash. |
| **Secretos** | Los módulos con secretos importan `server-only`: si un componente del navegador los importara, el build fallaría. `ADMIN_CODE` no aparece en ningún archivo del repositorio. |

**Nota sobre los códigos de estudiante:** el código funciona como identificador de entrada, como pidió el enunciado. Como un compañero podría conocer el código de otro, se recomienda configurar `ADMIN_PASSWORD` para proteger mejor el panel de administración.

> **Nota técnica:** Next.js 16 renombró `middleware.ts` a `proxy.ts`. Es el mismo mecanismo con otro nombre.

---

## El algoritmo de asignación

Archivo: [`lib/assignment.ts`](lib/assignment.ts).

1. **Validación de papelitos.** Se detecta y explica a la administradora:
   - papelitos sin vincular a un participante registrado;
   - autoasignaciones (`A → A`);
   - una persona en varios papelitos (`A → B` y `C → B`).
   En esos casos **no se inventa nada**: se muestra «⚠️ No existe una combinación válida con las asignaciones actuales» y la lista de problemas.
2. **Conservar lo existente.** Cada papelito válido se guarda tal cual (`source = EXISTING`). Nunca se hace un sorteo completamente nuevo.
3. **Calcular los huecos.** *Dadores pendientes* = quienes no tienen papelito. *Receptores libres* = quienes nadie tiene. Ambos grupos tienen el mismo tamaño.
4. **Emparejar sin autoasignaciones.** Es un emparejamiento perfecto en un grafo bipartito completo sin las aristas `x → x`. Por el teorema de Hall siempre existe si hay 2 o más pendientes; el único caso imposible es cuando queda **una** persona sin papelito que además es la única a quien nadie tiene (tendría que regalarse a sí misma). Ese caso se explica con nombre propio.
5. **Aleatoriedad uniforme.** Se usa muestreo por rechazo (barajar con `crypto.getRandomValues` y descartar si alguien queda consigo mismo), que elige con la misma probabilidad entre todas las soluciones válidas. Como red de seguridad, si se agotan los intentos se usa backtracking aleatorio.
6. **Verificación doble.** El resultado se verifica en TypeScript (`verifyAssignments`) y de nuevo en PostgreSQL (`commit_assignments` + restricciones `UNIQUE`/`CHECK`).

Se permiten parejas recíprocas (`A ↔ B`), como en un amigo secreto normal.

---

## Pruebas

```bash
npm test
```

65 pruebas automáticas (Vitest):

| Archivo | Qué verifica |
|---|---|
| `tests/validation.test.ts` | Formato del código (válidos e inválidos de la rúbrica), limpieza de entrada, IDs manipulados. |
| `tests/assignment.test.ts` | `A→B, B→C, C→A` válido; `A→A` inválido; `A→B, C→B` inválido; parejas recíprocas; ejemplo del enunciado (200 corridas); caso imposible; 500 escenarios aleatorios; uniformidad estadística; respaldo por backtracking. |
| `tests/access.test.ts` | Participante en `/admin/*` → 403; sin sesión → login; sesión expirada; reglas de estado (`REGISTRATION_OPEN` permite registro, `ASSIGNING` bloquea cambios, `ASSIGNED` bloquea el sorteo). |
| `tests/names.test.ts` | Normalización de nombres, ambigüedad «Gabriela», resumen del panel, conflictos, lista de deseos. |
| `tests/database.test.ts` | Ejecuta el **SQL real** en PostgreSQL embebido: restricciones, sorteo atómico con rollback, imposibilidad de re-sortear, triggers de bloqueo, que `anon`/`authenticated` no puedan leer nada y que RLS niegue incluso si se otorgan permisos por error. |

Además, el flujo completo se probó de punta a punta en un navegador real contra PostgreSQL + PostgREST (registro con papelito pendiente, ambigüedad de nombres, sugerencias, duplicados, 403 en `/admin`, confirmación extra, sorteo, resultado y bloqueo posterior).

**Checklist manual después del deploy**

- [ ] Registrar con `A0012345` muestra error inmediato.
- [ ] Registrar dos veces el mismo código muestra «ya está registrado».
- [ ] Un participante que abre `/admin` ve «Acceso denegado».
- [ ] Antes del sorteo, *Mi cuenta* dice que la asignación aún no se realizó.
- [ ] Después del sorteo, *Mi cuenta* muestra solo su amigo secreto y sus deseos.
- [ ] Pulsar «ASIGNAR TODOS» por segunda vez no es posible.

---

## Estructura del proyecto

```
app/
  page.tsx                      Inicio
  registro/page.tsx             Registro
  login/page.tsx                Entrada de participantes
  mi-cuenta/page.tsx            Vista del participante
  admin/login/page.tsx          Entrada de administración
  admin/(panel)/layout.tsx      Verificación de admin + navegación
  admin/(panel)/page.tsx        Tablero y «ASIGNAR TODOS»
  admin/(panel)/participantes/  Tabla de participantes
  admin/(panel)/asignaciones/   Asignaciones (privado)
  acceso-denegado/page.tsx      403
  salir/route.ts                Cierra sesiones inválidas
  api/personas/route.ts         Buscador de nombres (solo id + nombre)
  actions/                      Server Actions (auth, participante, admin)
components/                     UI, formularios y componentes de admin
lib/
  assignment.ts                 Algoritmo de asignación (puro)
  validation.ts                 Validaciones (cliente y servidor)
  names.ts                      Normalización y coincidencia de nombres
  paper.ts                      Resolución del papelito reportado
  review.ts                     Resumen del panel de administración
  session*.ts, auth.ts          Sesiones firmadas y verificación
  data.ts, supabase.ts          Acceso a datos (solo servidor)
  rate-limit.ts                 Límite de intentos
types/                          Tipos de base de datos y dominio
supabase/migrations/0001_init.sql  Esquema completo, triggers, RLS
tests/                          Pruebas automáticas
proxy.ts                        Protección de rutas (antes middleware.ts)
```

---

## Preguntas frecuentes

**Alguien escribió mal el nombre en su papelito.** En *Participantes*, elige la persona correcta en el selector de esa fila y pulsa *Confirmar*.

**Dos personas reportaron a la misma persona.** Aparece como *Conflicto* y el sorteo se bloquea hasta resolverlo. Habla con ellas, corrige el vínculo del papelito equivocado (o déjalo *Sin vincular* y pídele a esa persona que cambie su papelito a «No tengo»).

**Una persona se registró dos veces / registros de prueba.** Elimínalos desde *Participantes* (solo antes del sorteo).

**Alguien quiere cambiar su lista de deseos después del sorteo.** En *Panel → Configuración*, pulsa *Permitir* en «Editar listas de deseos después del sorteo». Solo se habilita la lista de deseos; nada más.

### Reiniciar el juego (empezar de cero)

No hay botón para esto a propósito: evita volver a sortear por accidente. Si realmente necesitas reiniciar (por ejemplo, para el próximo año), ejecuta en **Supabase → SQL Editor**:

```sql
-- ⚠️ BORRA TODO: asignaciones y participantes. No se puede deshacer.
begin;
set local app.allow_reset = 'on';
delete from public.assignments;
update public.game_settings
   set status = 'REGISTRATION_OPEN',
       assignment_started_at = null,
       assignment_completed_at = null
 where id = 1;
delete from public.participants;
delete from public.login_attempts;
commit;
```

Si solo quieres **repetir el sorteo conservando los registros**, ejecuta lo mismo pero sin la línea `delete from public.participants;`.
