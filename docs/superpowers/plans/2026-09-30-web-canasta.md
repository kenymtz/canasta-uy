# Web de Canasta UY: plan de implementación

> **Para agentes:** ejecutar tarea por tarea con superpowers:executing-plans. Los pasos usan
> casillas (`- [ ]`) para seguir el avance.

**Objetivo:** construir la web "mapa + ticket" descrita en
`docs/superpowers/specs/2026-09-30-web-canasta-design.md`.

**Arquitectura:** SPA en `web/` (React 19 + Vite + TypeScript) que consume la API existente
(`api/main.py`) a través del proxy de Vite (`/api/*` → `http://api:8000/*`). Corre en Docker
(`node:22-alpine`) porque Smart App Control bloquea los binarios nativos de Node en Windows.

**Stack:** React 19, Vite, TypeScript, Tailwind v4 (`@tailwindcss/vite`), Motion, MapLibre GL
+ OpenFreeMap (`positron` claro, `dark` oscuro), `@number-flow/react`, `@phosphor-icons/react`,
zustand, Vitest.

## Restricciones globales

- Cero rayas largas (`—`, `–`) en textos visibles; usar `-`, comas o puntos.
- Un solo acento verde en toda la página (claro `#167A4F`, oscuro `#4CC38A`); neutros fríos.
- Tipografía Geist (textos) y Geist Mono (precios, con `tabular-nums`), autoalojadas.
- Un solo sistema de radios: 14 px contenedores, 10 px controles, píldora solo en chips.
- Animaciones de interfaz ≤ 300 ms, `ease-out` propio `cubic-bezier(0.23, 1, 0.32, 1)`, solo
  `transform` y `opacity`, desactivadas con `prefers-reduced-motion`.
- Botones: `scale(0.97)` al presionar; hover solo con `@media (hover: hover)`.
- Contraste WCAG AA en todo texto y control, en modo claro y oscuro.
- Aviso visible: "Precios del SIPC al 31/12/2025" (la fecha sale de `GET /salud`).
- Textos en español rioplatense, claros y funcionales.

## Estructura de archivos

```
web/
  package.json, vite.config.ts, tsconfig.json, index.html
  src/main.tsx                    arranque, fuentes y estilos
  src/styles.css                  Tailwind + tokens de color, radios y curvas; papel del ticket
  src/App.tsx                     disposición: mapa + panel; orquesta los pasos
  src/lib/api.ts                  tipos de la API y funciones fetch
  src/lib/formato.ts              plata ($ 1.480,50), cantidades (2 kg, 500 g, 12 u, 120 m)
  src/lib/pasos.ts                cuánto suma el + de cada genérico
  src/lib/canastaBasica.ts        canasta sugerida (nombre → cantidad)
  src/store/canasta.ts            estado (zustand + persist en localStorage)
  src/hooks/useCotizacion.ts      cotiza con demora de 400 ms cuando cambia la canasta
  src/components/Encabezado.tsx   marca + aviso de fecha
  src/components/Ubicacion.tsx    departamento, ciudad y radio
  src/components/Mapa.tsx         MapLibre: tu punto, radio, comercios y totales
  src/components/Canasta.tsx      buscador, categorías, filas con + y −, presupuesto
  src/components/Ticket.tsx       ticket grande y compacto
  src/components/Resultados.tsx   lista de tickets y estados (cargando, vacío, error)
  src/lib/*.test.ts               tests de Vitest de la lógica pura
docker-compose.yml                servicio web (puerto 5173)
```

---

### Tarea 1: proyecto base en Docker

**Archivos:** crear `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`,
`web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles.css`; modificar
`docker-compose.yml`, `.gitignore`.

- [ ] Crear el proyecto con las dependencias del stack y los scripts `dev`, `build`
      (`tsc -b && vite build`), `test` (`vitest run`).
- [ ] `vite.config.ts`: plugins React y Tailwind; `server.host = true`, puerto 5173;
      `server.watch.usePolling` si existe `VITE_POLLING` (los cambios en una carpeta de Windows
      montada no generan eventos dentro de Docker); proxy `/api` → `process.env.API_URL`
      quitando el prefijo.
- [ ] Servicio `web` en el compose: `node:22-alpine`, `working_dir: /web`, volumen `./web:/web`
      y volumen con nombre para `/web/node_modules` (los paquetes nativos se instalan para
      Linux, no para Windows), `command: sh -c "npm install && npm run dev"`,
      `API_URL=http://api:8000`, `VITE_POLLING=1`, puerto `127.0.0.1:5173:5173`, depende de `api`.
- [ ] `.gitignore`: `web/node_modules/`, `web/dist/`.
- [ ] Verificar: `docker compose up -d web`; `http://localhost:5173` responde y
      `http://localhost:5173/api/salud` devuelve `{"estado":"ok",...}` a través del proxy.
- [ ] Commit.

### Tarea 2: lógica pura con tests

**Archivos:** crear `web/src/lib/formato.ts`, `pasos.ts`, `canastaBasica.ts`, `api.ts` y sus
tests.

**Produce:**
- `formatoPlata(n: number): string` → `"$ 1.480,50"`, `"$ 79"` (sin decimales si es entero).
- `formatoCantidad(n: number, unidad: Unidad): string` → kg: `"500 g"` si < 1, `"1,5 kg"`;
  l: `"900 ml"` si < 1, `"2 l"`; unidad: `"12 u"`; m: `"120 m"`.
- `paso(g: Generico): number` → Huevos 6, Papel higiénico 120, suelto 0,5, kg/l de paquete
  0,5, unidad 1; `cantidadInicial(g)` igual al paso salvo aceite (0,9 l).
- `type Unidad = "kg" | "l" | "unidad" | "m"`; tipos `Ciudad`, `Generico`, `Comercio`,
  `LineaCanasta`, `ResultadoComercio`, `PedidoCanasta` idénticos a los modelos de `api/main.py`.
- `api.ciudades()`, `api.genericos()`, `api.comercios(lat, lon, radioKm)`,
  `api.cotizar(pedido)`, `api.salud()`; ante un estado HTTP no 2xx lanzan `ErrorApi` con el
  mensaje `detail` de la API.
- `CANASTA_BASICA: Array<[nombre: string, cantidad: number]>`: Arroz blanco 2, Fideos semolados
  1, Aceite de girasol 0,9, Azúcar 1, Yerba mate 1, Harina de trigo 0000 1, Sal fina 0,5,
  Huevos 12, Manteca 0,2, Carne picada 1, Pollo entero 1,5, Papa 2, Tomate 1, Manzana 1,
  Detergente para vajilla 1, Hipoclorito de sodio 1, Jabón en polvo 0,8, Papel higiénico 120,
  Pasta dental 0,09.

- [ ] Escribir los tests de `formato` y `pasos` (casos de arriba, más redondeos: 0,09 kg →
      `"90 g"`, 1,25 l → `"1,25 l"`); correrlos y verlos fallar.
- [ ] Implementar; `npm test` pasa.
- [ ] Commit.

### Tarea 3: estado de la canasta

**Archivos:** crear `web/src/store/canasta.ts` y su test.

**Produce:** `useCanasta` (zustand + `persist`, clave `canasta-uy`) con
`ubicacion: {departamento, ciudad, lat, lon} | null`, `radioKm` (5), `items: Record<number,
number>`, `presupuesto: number | null` y acciones `elegirUbicacion`, `setRadio`, `sumar(g)`,
`restar(g)` (en 0 elimina el ítem), `cargarBasica(genericos)`, `vaciar`, `setPresupuesto`.

- [ ] Test: sumar/restar respetan el paso; restar hasta 0 elimina; `cargarBasica` ignora
      nombres inexistentes. Verlo fallar, implementar, pasar.
- [ ] Commit.

### Tarea 4: identidad visual y disposición

**Archivos:** `styles.css`, `App.tsx`, `Encabezado.tsx`, `main.tsx`.

- [ ] Tokens en `@theme` (papel, tinta, tinta suave, línea, acento, radios, curva) con
      versión oscura bajo `prefers-color-scheme: dark`; clase `.ticket` (papel, borde inferior
      dentado con `mask`, línea punteada `.ticket-corte`); fuentes Geist y Geist Mono.
- [ ] Disposición: ≥ 1024 px grilla `minmax(0,1fr) 460px` (mapa fijo a la izquierda, panel
      con scroll); < 1024 px mapa arriba (40dvh) y panel encima con esquinas redondeadas.
- [ ] Encabezado: marca "Canasta UY", frase "¿Dónde te sale más barata la compra?" y aviso
      con la fecha de `api.salud()`.
- [ ] Verificar en el navegador integrado (escritorio y 375 px, claro y oscuro). Commit.

### Tarea 5: ubicación y mapa

**Archivos:** `Ubicacion.tsx`, `Mapa.tsx`.

**Consume:** `api.ciudades`, `api.comercios`, `useCanasta`.
**Produce:** `<Mapa comercios resultados seleccionado onSeleccionar onElegirPunto />`.

- [ ] `Ubicacion`: dos selects nativos accesibles (departamento → ciudades), radio con
      `input type=range` 1-20 km; al elegir ciudad se guarda su centro.
- [ ] `Mapa`: MapLibre con `positron`/`dark` según el tema; ajustar colores de fondo y agua a
      los tokens; círculo del radio (fuente GeoJSON), punto del usuario, comercios cercanos
      como puntos chicos; clic en el mapa = elegir punto (ciudad "Punto en el mapa").
      Con resultados, cada comercio muestra una etiqueta con su total; la del mejor, en acento.
- [ ] Verificar en el navegador: Salto y Montevideo, cambio de radio. Commit.

### Tarea 6: armar la canasta

**Archivos:** `Canasta.tsx`.

- [ ] Buscador (sin acentos ni mayúsculas), chips de categoría con desplazamiento horizontal,
      filas de genérico con cantidad en `formatoCantidad` y botones − y + (íconos Phosphor,
      área táctil ≥ 44 px), botón "Canasta básica", "Vaciar", presupuesto opcional con
      etiqueta arriba del campo. Estado vacío que explica cómo empezar.
- [ ] Verificar en el navegador. Commit.

### Tarea 7: resultados en tickets

**Archivos:** `hooks/useCotizacion.ts`, `Ticket.tsx`, `Resultados.tsx`; conectar en `App.tsx`.

- [ ] `useCotizacion`: con ubicación e ítems, espera 400 ms sin cambios y llama a
      `api.cotizar` (cancela el pedido anterior con `AbortController`); devuelve
      `{estado: "inactivo" | "cargando" | "listo" | "error", resultados, error}`.
- [ ] `Ticket` grande: comercio, dirección y distancia; líneas "producto real × unidades ...
      costo"; faltantes tachados; total con NumberFlow; sello "Entra en tu presupuesto" o
      "Te pasás por $ X"; entra desde arriba 240 ms. `Ticket` compacto: nombre, cobertura,
      total; se expande.
- [ ] Estados: esqueleto con forma de ticket, "Ningún comercio a menos de N km" con botón para
      ampliar, error con reintentar.
- [ ] Seleccionar un ticket resalta su comercio en el mapa y viceversa.
- [ ] Verificar la canasta básica en Salto y Montevideo. Commit.

### Tarea 8: pulido y verificación final

- [ ] Recorrer la lista final de la skill design-taste-frontend y la tabla de revisión de
      emil-design-eng; corregir lo que falle.
- [ ] `npm test` y `npm run build` sin errores; consola del navegador limpia.
- [ ] Capturas en escritorio y celular, claro y oscuro.
- [ ] Actualizar README (cómo abrir la web, captura) y `docs/CONTEXTO.md`. Commit.
