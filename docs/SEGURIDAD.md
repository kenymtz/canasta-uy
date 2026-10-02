# Auditoría de seguridad (02/10/2026)

Revisión de Canasta UY como lo haría una persona externa, usando la metodología de skills de
seguridad ofensiva (secskills, offensive-security-skills, awesome-skills-security) aplicada con
herramientas propias contra la infraestructura real del proyecto (autorizada por Augusto, dueño
del proyecto). La superficie es chica: web estática en Cloudflare Pages + base en Supabase
(PostgREST con Row Level Security) + inicio de sesión con Google (OAuth).

## Resultado

Nada crítico. Los datos de los usuarios están aislados: sin sesión no se puede leer, escribir ni
borrar nada, y la clave secreta no está expuesta. Se encontró **una** configuración para endurecer
(registro por email abierto) y **una** mejora de cabeceras (clickjacking), más notas menores.

## Pruebas hechas y resultado

| # | Prueba (OWASP API / checklist OAuth) | Resultado |
|---|---|---|
| 1 | Secretos en el repo (clave secreta, contraseña, `.env`) | ✅ Limpio; `.env` no versionado |
| 2 | Clave **secreta** filtrada en el bundle publicado | ✅ Solo aparece la clave pública (así debe ser) |
| 3 | Leer compras de otros **sin sesión** (GET) | ✅ 401 permission denied |
| 4 | Insertar/borrar **sin sesión** (POST/DELETE) | ✅ 401 |
| 5 | Otras tablas expuestas (auth.users, precios, etc.) | ✅ 404: ninguna |
| 6 | Llamar funciones (RPC) sin sesión | ✅ 401 `borrar_mi_cuenta` |
| 7 | Introspección del esquema por la API | ✅ Bloqueada (requiere clave secreta) |
| 8 | Robo de identidad al guardar (mass assignment: guardar a nombre de otro) | ✅ RLS `WITH CHECK` lo bloquea (prueba en `sql/supabase/prueba_rls.sql`) |
| 9 | Aislamiento entre usuarios (BOLA/IDOR) | ✅ Políticas `USING (usuario_id = auth.uid())`, verificado en la prueba de RLS |
| 10 | Inyección de HTML/XSS (texto de boletas y nombres) | ✅ No hay `dangerouslySetInnerHTML`; React escapa todo |
| 11 | Secuestro de sesión por `redirect_to` en OAuth | ✅ Google siempre vuelve al callback de Supabase; `redirect_to` se valida contra una lista sin comodines |
| 12 | Secretos filtrados en los logs de los workflows | ✅ No se imprimen; van como env (GitHub los enmascara) |
| 13 | Cabeceras de seguridad del sitio | ⚠️ Faltaban anti-clickjacking y Permissions-Policy (corregido) |
| 14 | Registro de cuentas | ⚠️ Email/contraseña abierto aunque la app solo usa Google (ver abajo) |

## Hallazgos

### 1. Registro por email/contraseña abierto (Medio) — requiere acción en Supabase

La app solo ofrece "Entrar con Google", pero en Supabase el proveedor **Email** sigue activo y el
registro no está restringido. Por la API se puede crear una cuenta email/contraseña sin pasar por
Google (se creó `pentest-canasta-001@mailinator.com` como prueba; quedó pendiente de confirmar, sin
sesión).

- **Impacto:** no es una fuga de datos (RLS sigue aislando), pero es una puerta de entrada que la
  app no usa ni controla: permite crear cuentas basura y gastar la cuota de correos de confirmación
  del proyecto (podría dejar sin correos a los registros legítimos).
- **Solución (en el panel de Supabase):** Authentication → Sign In / Providers → **Email** →
  desactivar (dejar solo Google). Si se quiere conservar email pero sin registro abierto:
  Authentication → **Allow new users to sign up** → desactivar.
- **Además:** borrar la cuenta de prueba en Authentication → Users → `pentest-canasta-001@mailinator.com`.

### 2. Faltaban cabeceras anti-clickjacking (Bajo) — CORREGIDO

El sitio se podía incrustar en un `<iframe>` y no declaraba `Permissions-Policy`. Impacto bajo (no
hay acciones sensibles de un solo clic: borrar la cuenta pide confirmación), pero es endurecimiento
gratis. Se agregó `web/public/_headers` (lo sirve Cloudflare Pages) con `X-Frame-Options: DENY`,
`Content-Security-Policy: frame-ancestors 'none'` y una `Permissions-Policy` que apaga cámara,
micrófono, ubicación y pagos (la app no usa ninguno: la foto del ticket entra por selector de
archivos, no por la cámara web).

## Notas menores (sin acción urgente)

- **Historial en el teléfono sin cifrar:** sin cuenta, las compras se guardan en `localStorage` en
  texto plano. Es a propósito (quedan solo en el dispositivo) y no salen de ahí. Aceptable.
- **Sin CSP completa de scripts/conexiones:** una CSP que restrinja orígenes de scripts y fetch
  sería ideal, pero la lectura de boletas (tesseract) descarga piezas de CDNs y el mapa usa workers
  `blob:`, así que una CSP estricta es frágil. Queda como mejora futura, a probar con el banco de
  pruebas para no romper el mapa ni la lectura.
- **Cuenta de prueba:** `pentest-canasta-001@mailinator.com` quedó creada sin confirmar (ver arriba).

## Cómo reproducir

Las pruebas 1–12 están en los comandos de esta auditoría (curl contra la API de Supabase con la
clave pública y `git grep` sobre el repo). La prueba de aislamiento entre usuarios se corre en local
con `sql/supabase/prueba_rls.sql` (imita a Supabase e incluye un control de que la prueba detecta
una regla rota).
