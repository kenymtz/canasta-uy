# Inscripción de la base de datos en la URCDP

> **Estado:** enviada el 01/10/2026, "Pendiente de Revisión". Lo de abajo es lo que se declaró.

La Ley 18.331 pide inscribir en la Unidad Reguladora y de Control de Datos Personales (URCDP)
toda base con datos de personas que no sea de uso personal o doméstico. Canasta UY guarda las
cuentas y el historial de compras de sus usuarios (Supabase), así que corresponde inscribirla
**antes de anunciar la web en público**.

- **Trámite:** [Inscripción de bases de datos personales](https://www.gub.uy/tramites/inscripcion-bases-datos-personales). Gratis.
- **Dónde:** <https://www.datospersonales.gub.uy/SRCiudadanoWeb> → "Mis Registros" → "Nuevo Registro".
- **Cómo entrar:** usuario gub.uy, cédula digital (con lector), Identidad Digital de Abitab o TuID de Antel.
- **Formulario:** "Registro de Persona Física" (el responsable es Augusto, sin RUT).
- **Consultas:** 2901 0065, opción 3.

> La guía oficial de los pasos ([PDF de la URCDP](https://www.opp.gub.uy/sites/default/files/inline-files/guia_inscripcion_BD.pdf))
> es de cuando el trámite terminaba en persona: pedía presentar el formulario firmado y la
> cédula en la URCDP (Andes 1365, piso 8) dentro de los 10 días hábiles. Hoy se entra con
> identificación digital; **confirmar por teléfono si todavía hace falta ir.**

Abajo, lo que va en cada paso. Lo marcado con **[completar]** son datos personales de Augusto
que no están en el repo.

---

## Datos del titular

| Campo | Valor |
|---|---|
| Nombre | Augusto Calfani |
| Cédula | [completar] |
| Domicilio para notificaciones | [completar] |
| Correo para notificaciones | uycanasta@gmail.com (el mismo de la página de privacidad) |
| Teléfono | [completar] |

## Paso 1. Identificación de la base

- **Nombre:** Canasta UY: cuentas e historial de compras.
- **Descripción:** Cuentas de los usuarios de la web Canasta UY (identificador de cuenta, correo
  y nombre que entrega Google al iniciar sesión) e historial de compras que cada usuario registra
  por su cuenta a partir de sus tickets: fecha, total, RUT de la empresa, comercio que marcó y
  productos con su precio.

## Paso 2. Ubicación física

Servidores de Supabase (sobre Amazon Web Services), región `eu-central-1`, Frankfurt, Alemania
(Unión Europea). La ubicación corresponde a un tercero; Amazon no publica la dirección exacta
del centro de datos. No hay copias en papel ni ubicaciones alternativas.

## Paso 3. Tratamiento

Lo realiza el propio responsable. Proveedores que intervienen como encargados:

- **Supabase Pte. Ltd.** (encargado, se carga en 4.2): base de datos e inicio de sesión;
  guarda los datos. 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, Singapur;
  privacy@supabase.com. Fuente: su [acuerdo de tratamiento de datos](https://supabase.com/legal/dpa).
- **Google LLC** (no se carga como encargado: es responsable de sus propios datos): el inicio de sesión con Google. Canasta UY recibe de Google el correo, el
  nombre y un identificador; no recibe ni guarda la contraseña.
- **Cloudflare Inc.** (no se carga: no toca la base): sirve la página web, que es estática.

## Paso 4. Contacto técnico

Augusto Calfani (los mismos datos del titular), dependiente del titular.

## Paso 5. Dónde se ejercen los derechos

En la propia web (<https://canastauy.pages.dev>), con la sesión iniciada, y por correo a
uycanasta@gmail.com (figura en la [página de privacidad](https://canastauy.pages.dev/privacidad)).

## Paso 6. Información estadística

No es una base comercial ni crediticia: 0 en todos los casilleros.

## Paso 7. Ejercicio de los derechos

- **Acceso:** en "Mis compras" el usuario ve todo lo que hay guardado de él.
- **Supresión:** cada compra tiene "Borrar"; "Borrar mi cuenta" elimina la cuenta y todas sus
  compras (en cascada, en la base).
- **Rectificación:** borrar la compra y volver a cargarla; o pedirlo a uycanasta@gmail.com.
- **Requisito:** tener la sesión iniciada con la cuenta, o escribir desde el correo de la cuenta.

## Paso 8. Datos que se tratan

- **Cantidad de personas:** [completar al inscribir: cantidad de cuentas en Supabase,
  Authentication → Users].
- **Tipos de información:**
  - *Identificatorios:* correo electrónico, nombre, identificador de cuenta.
  - *Información comercial (hábitos de consumo):* compras (fecha, monto total, empresa, comercio y
    productos con precio).
  - *Otros datos:* lo que guarda el sistema de inicio de sesión (Supabase) al entrar con Google:
    enlace a la foto de perfil de Google (la web no la usa), fecha y dirección IP de los inicios
    de sesión.
  - *Características personales, económico-financieros, especialmente protegidos:* no.
  - *Personas jurídicas sometidas al tratamiento:* 0 (el RUT del comercio es un dato de la
    compra; los titulares son los usuarios).
- **Datos sensibles:** no se piden. Aclaración: si un usuario compra productos de farmacia, su
  nombre puede aparecer en el detalle de la compra; no se usan para inferir nada.
- **No se guardan:** las fotos de los tickets (se leen en el teléfono y no se suben), datos de
  pago, cédula, ni la ubicación del usuario.

## Paso 9. Obtención y tratamiento

- **Procedencia:** proporcionado por el interesado, y otras personas jurídicas (Google LLC
  entrega el correo, el nombre y el identificador al iniciar sesión).
- **Procedimientos:** formularios y transmisión electrónica.
- **9.4 Conservación (Otros):** hasta que el usuario borre la compra o su cuenta desde la web,
  o lo pida por correo a uycanasta@gmail.com. Al borrar la cuenta se eliminan todas sus compras.
- **9.5 Finalidad:** mostrarle al usuario su historial de compras y compararlo con sus compras
  anteriores. No se usan para publicidad ni perfiles, no se venden ni se ceden a terceros.
- **Comunicaciones o cesiones:** ninguna.
- **Transferencias internacionales:** sí. País adecuado: **Unión Europea** (los datos se guardan
  en Frankfurt, Alemania). País no adecuado: **Singapur**, sede del proveedor (Supabase Pte.
  Ltd.), con cláusulas contractuales tipo en su [acuerdo de tratamiento de datos](https://supabase.com/legal/dpa).
  Motivo: con consentimiento del titular (la página de privacidad lo explica y se acepta al
  iniciar sesión) y otros motivos (prestación del servicio de alojamiento, con cláusulas
  contractuales tipo). Confirmar en el formulario que la UE figura entre los destinos con nivel de protección
  adecuado reconocidos por la URCDP.
- **Información al titular:** la página de privacidad lo explica, y al iniciar sesión se avisa
  que entrar implica aceptarla.

## Paso 10. Medidas de seguridad

- Cada usuario solo puede ver, guardar y borrar sus propias compras: Row Level Security en la
  base, probado con una prueba que imita a otro usuario y a un visitante sin sesión
  (`sql/supabase/prueba_rls.sql`).
- No hay contraseñas propias: el inicio de sesión lo hace Google (OAuth, con PKCE).
- La clave que usa la web es pública y no tiene permisos propios; las claves secretas están
  solo en Supabase y en los secretos del repositorio.
- Toda la comunicación es por HTTPS.
- El navegador borra los datos de pago y personales de la boleta antes de guardar.
- Acceso al panel de la base: solo el responsable. **Pendiente:** activar la verificación en
  dos pasos en las cuentas de Supabase, Google, GitHub y Cloudflare.

## Paso 11. Descripción técnica

PostgreSQL 17 administrado por Supabase. Tablas: `auth.users` (cuentas, la maneja Supabase) y
`public.compra` (una fila por ticket y usuario; los productos en formato JSON). La web es
estática (React, publicada en Cloudflare Pages) y accede a la base por la API REST de Supabase.
Esquema: `sql/supabase/01_compras.sql`.
