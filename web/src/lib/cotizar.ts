// Cotización de la canasta en el navegador, para la web estática (sin servidor).
//
// Repite paso a paso la función mart.cotizar_canasta de sql/init/05_mart.sql, con los datos
// que exporta pipelines/exportar/web_estatica.py. Si cambia una, hay que cambiar la otra.

import type { Comercio, Generico, LineaCanasta, PedidoCanasta, ResultadoComercio } from "./api";

export type ComercioBase = Omit<Comercio, "distancia_km">;

/** Lo que trae precios.json: productos [genérico, nombre, tamaño] y precios [comercio, producto, precio, días]. */
export interface DatosPrecios {
  ultimo_precio: string;
  productos: [number, string, number][];
  precios: [number, number, number, number][];
}

interface Opcion {
  producto: string;
  tamano: number;
  precio: number;
  fecha: string;
}

/** Precios ordenados para buscarlos rápido: comercio → genérico → productos que sirven. */
export type IndicePrecios = Map<number, Map<number, Opcion[]>>;

// La Tierra según el GPS (elipsoide WGS84): un poco achatada en los polos
const SEMIEJE_MAYOR = 6378137; // radio en el ecuador, en metros
const ACHATAMIENTO = 1 / 298.257223563;
const SEMIEJE_MENOR = SEMIEJE_MAYOR * (1 - ACHATAMIENTO);

// Orden alfabético igual al de la base (en_US.utf8): sin distinguir mayúsculas ni tildes,
// sin mirar los espacios y con la ñ como si fuera n ("Pañales" antes que "Pan de molde")
const porNombre = new Intl.Collator("en", { ignorePunctuation: true }).compare;

/** Redondea como Postgres (la mitad hacia arriba), sin los errores de 1.005 * 100 = 100.49999. */
export function redondear(valor: number, decimales = 2): number {
  return Number(`${Math.round(Number(`${valor}e${decimales}`))}e-${decimales}`);
}

/**
 * Distancia en km entre dos puntos sobre el elipsoide (fórmula de Vincenty), la misma que usa
 * PostGIS. Con una esfera la diferencia llega a 50 m en 20 km: suficiente para que un comercio
 * justo en el borde del radio entre en una versión y no en la otra.
 */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const f = ACHATAMIENTO;
  const L = (lon2 - lon1) * rad;
  const U1 = Math.atan((1 - f) * Math.tan(lat1 * rad));
  const U2 = Math.atan((1 - f) * Math.tan(lat2 * rad));
  const [sinU1, cosU1, sinU2, cosU2] = [Math.sin(U1), Math.cos(U1), Math.sin(U2), Math.cos(U2)];

  // Se ajusta la longitud sobre la esfera auxiliar hasta que deja de cambiar
  let lambda = L;
  let sinSigma = 0, cosSigma = 1, sigma = 0, cos2Alpha = 1, cos2SigmaM = 0;
  for (let i = 0; i < 100; i++) {
    const [sinLambda, cosLambda] = [Math.sin(lambda), Math.cos(lambda)];
    sinSigma = Math.hypot(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
    if (sinSigma === 0) return 0; // el mismo punto
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cos2Alpha = 1 - sinAlpha ** 2;
    cos2SigmaM = cos2Alpha === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cos2Alpha;
    const C = (f / 16) * cos2Alpha * (4 + f * (4 - 3 * cos2Alpha));
    const anterior = lambda;
    lambda =
      L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    if (Math.abs(lambda - anterior) < 1e-12) break;
  }

  const u2 = (cos2Alpha * (SEMIEJE_MAYOR ** 2 - SEMIEJE_MENOR ** 2)) / SEMIEJE_MENOR ** 2;
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
  return (SEMIEJE_MENOR * A * (sigma - deltaSigma)) / 1000;
}

function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function indexarPrecios(datos: DatosPrecios): IndicePrecios {
  const indice: IndicePrecios = new Map();
  for (const [comercio, posicion, precio, dias] of datos.precios) {
    const [generico, producto, tamano] = datos.productos[posicion];
    let porGenerico = indice.get(comercio);
    if (!porGenerico) indice.set(comercio, (porGenerico = new Map()));
    let opciones = porGenerico.get(generico);
    if (!opciones) porGenerico.set(generico, (opciones = []));
    opciones.push({ producto, tamano, precio, fecha: restarDias(datos.ultimo_precio, dias) });
  }
  return indice;
}

/** Comercios a menos de radioKm del punto, del más cercano al más lejano. */
export function comerciosCercanos(comercios: ComercioBase[], lat: number, lon: number, radioKm: number): Comercio[] {
  return comercios
    .map((c) => ({ ...c, distancia: distanciaKm(lat, lon, c.lat, c.lon) }))
    .filter((c) => c.distancia <= radioKm)
    .sort((a, b) => a.distancia - b.distancia)
    .map(({ distancia, ...c }) => ({ ...c, distancia_km: redondear(distancia) }));
}

export function cotizarCanasta(
  pedido: PedidoCanasta,
  datos: { comercios: ComercioBase[]; genericos: Generico[]; indice: IndicePrecios },
): ResultadoComercio[] {
  const genericos = new Map(datos.genericos.map((g) => [g.producto_canonico_id, g]));
  const pedidos = pedido.items.map((item) => ({ ...item, generico: genericos.get(item.producto_canonico_id) }));
  const desconocidos = pedidos.filter((p) => !p.generico).map((p) => p.producto_canonico_id);
  if (desconocidos.length > 0) {
    throw new Error(`Productos que no existen: [${desconocidos.sort((a, b) => a - b).join(", ")}]`);
  }

  const resultados: ResultadoComercio[] = [];
  for (const comercio of comerciosCercanos(datos.comercios, pedido.lat, pedido.lon, pedido.radio_km)) {
    const precios = datos.indice.get(comercio.establecimiento_id);
    const detalle: LineaCanasta[] = [];
    const fechas: string[] = [];
    const faltantes: string[] = [];

    for (const { cantidad, generico } of pedidos) {
      const g = generico!;
      // La forma más barata de comprar este ítem acá: lo suelto se paga por kilo; los
      // paquetes no se fraccionan. Si dos cuestan lo mismo queda el primero, que es el de
      // menor id (precios.json viene ordenado así), igual que en la base
      let mejor: { opcion: Opcion; unidades: number; costo: number } | null = null;
      for (const opcion of precios?.get(g.producto_canonico_id) ?? []) {
        const unidades = g.se_vende_suelto ? cantidad / opcion.tamano : Math.ceil(cantidad / opcion.tamano);
        const costo = unidades * opcion.precio;
        if (!mejor || costo < mejor.costo) mejor = { opcion, unidades, costo };
      }
      if (!mejor) {
        faltantes.push(g.nombre);
        continue;
      }
      detalle.push({
        generico: g.nombre,
        producto: mejor.opcion.producto,
        cantidad,
        unidades: redondear(mejor.unidades),
        precio: mejor.opcion.precio,
        costo: redondear(mejor.costo),
      });
      fechas.push(mejor.opcion.fecha);
    }
    if (detalle.length === 0) continue; // sin ningún producto de la canasta, no compite

    const total = redondear(detalle.reduce((suma, linea) => suma + linea.costo, 0));
    resultados.push({
      establecimiento_id: comercio.establecimiento_id,
      comercio: comercio.nombre,
      cadena: comercio.cadena,
      direccion: comercio.direccion,
      ciudad: comercio.ciudad,
      distancia_km: comercio.distancia_km,
      productos_pedidos: pedidos.length,
      productos_con_precio: detalle.length,
      cobertura: redondear(detalle.length / pedidos.length),
      total,
      entra_en_presupuesto: pedido.presupuesto === null || total <= pedido.presupuesto,
      faltantes: faltantes.sort(porNombre),
      fecha_precios: fechas.sort()[0],
      detalle: detalle.sort((a, b) => porNombre(a.generico, b.generico)),
    });
  }

  // Primero los que tienen toda la canasta, después el más barato; si empatan, el más cerca
  resultados.sort((a, b) => b.cobertura - a.cobertura || a.total - b.total || a.distancia_km - b.distancia_km);
  return resultados.slice(0, pedido.limite ?? 20);
}
