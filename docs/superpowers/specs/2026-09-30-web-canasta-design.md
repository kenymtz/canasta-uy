# Web de Canasta UY: diseño

Fecha: 30/09/2026. Aprobado por Augusto en la conversación.

## Objetivo

Una web, adaptable al celular, donde cualquier persona elige dónde está, arma su canasta con
productos genéricos y ve en qué comercio le sale más barata. Tiene que ser llamativa, simple de
entender y sin el aspecto típico de las webs hechas por IA.

Fuera de alcance en esta etapa: cuentas de usuario, carga de tickets y comparación con la compra
anterior (paso 5), y el despliegue público (paso 6).

## Lectura de diseño

Herramienta de consumo para público general de Uruguay, con un lenguaje "mapa + ticket": el mapa
para ubicarse y ver los comercios, y el resultado de cada comercio presentado como un ticket de
supermercado. Diales: variedad 6, movimiento 5, densidad 4.

## Flujo (una sola pantalla, tres pasos)

1. **Dónde:** selector de departamento y ciudad (datos de `GET /ciudades`) o tocar el mapa;
   control de radio en km (1 a 20, por defecto 5). El mapa se centra en la ciudad elegida.
2. **Qué:** buscador y categorías (`GET /genericos`); cada producto con + y − en su unidad
   natural (kg, l, unidades, metros), con pasos razonables (0,5 kg; 1 l; 6 huevos; 1 unidad).
   Botón "Canasta básica" que carga una canasta sugerida. Presupuesto opcional.
3. **Dónde conviene:** `POST /canasta/cotizar`. En el mapa, cada comercio es un marcador con su
   total. El mejor comercio se muestra como un ticket grande (productos, cantidades a comprar,
   total, distancia, sello "entra en tu presupuesto"); el resto, como tickets compactos que se
   expanden. Los faltantes se marcan en cada ticket.

La canasta y la ubicación se recuerdan en el navegador (`localStorage`) para no rearmarla.

## Diseño visual

- **Ticket dosificado:** fondo de papel claro y frío (no el crema típico), números en fuente
  monoespaciada alineados a la derecha, líneas punteadas, borde inferior dentado. El resto de
  la interfaz es limpia.
- **Tipografía:** Geist para textos y Geist Mono para precios (autoalojadas con Fontsource).
- **Color:** neutros fríos + un solo acento verde "ahorro", usado en toda la página. Sin
  violetas, sin degradados de IA, sin rayas largas (em-dash) en ningún texto.
- **Forma:** un solo sistema de bordes redondeados.
- **Mapa:** MapLibre GL con estilo de OpenFreeMap (gratis, sin clave), con colores ajustados
  para combinar con el ticket.
- **Movimiento con propósito:** el total se anima al aparecer (NumberFlow); el ticket entra
  como si saliera de la impresora; respuesta al tocar botones (`scale(0.97)`). Todo menor a
  300 ms en la interfaz, curvas `ease-out` propias, y se desactiva con `prefers-reduced-motion`.
- **Modo claro y oscuro** según el sistema.
- **Estados completos:** cargando (esqueletos con la forma del ticket), vacío (cómo empezar),
  error (mensaje claro y reintentar), sin comercios en el radio (sugerir ampliarlo).
- **Aviso fijo:** "Precios del SIPC al 31/12/2025".

Disposición: en pantallas anchas, mapa a la izquierda y panel a la derecha; en el celular,
mapa arriba y panel que sube desde abajo.

## Arquitectura

- Carpeta `web/`: React 19 + Vite + TypeScript, Tailwind v4, Motion, MapLibre GL, NumberFlow,
  íconos Phosphor, zustand para el estado de la canasta.
- Todo corre en Docker (Smart App Control bloquea Node en Windows): servicio `web` con
  `node:22-alpine` y el servidor de desarrollo de Vite en `http://localhost:5173`.
- Vite reenvía `/api/*` a la API (`http://api:8000`), así la web no necesita CORS.
- Componentes chicos con una sola responsabilidad: selector de ubicación, mapa, constructor
  de canasta, ticket, lista de resultados, y un módulo `api.ts` con las llamadas tipadas.

## Verificación

- `tsc` y `vite build` sin errores.
- Revisión en el navegador integrado: escritorio y celular, modo claro y oscuro, con una
  canasta real en Salto y en Montevideo, y los estados de carga, vacío y error.
- Chequeo final con la lista de la skill de "buen gusto" (sin rayas largas, un solo acento,
  contraste AA, sin patrones típicos de IA).
