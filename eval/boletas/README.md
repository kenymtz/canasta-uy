# Banco de pruebas del lector de boletas

Mide qué tan bien la web lee los productos de una foto de boleta, para que cada cambio en el
lector se pueda **medir** en lugar de adivinar.

1. `generar.mjs` fabrica boletas falsas: productos reales del catálogo del SIPC, tres formatos
   de ticket y datos personales y de pago **inventados**. Las "ensucia" como una foto de
   celular en cuatro niveles (limpia, leve, media, fuerte): giro, arrugas, sombra,
   desenfoque, ruido, poca resolución y compresión JPG. Al lado de cada imagen guarda la
   respuesta correcta (`NNN.json`).
2. `evaluar.mjs` pasa cada imagen por **el mismo código de la web**
   (`web/src/lib/lectorBoleta.ts` y `web/src/lib/boleta.ts`, importados desde la web de
   desarrollo) y compara lo leído con la respuesta.

## Cómo correrlo

Con la web andando (`docker compose up -d web`):

```bash
docker compose run --rm eval-boletas                    # 48 boletas
docker compose run --rm -e CANTIDAD=200 eval-boletas    # más boletas, más precisión
```

Tarda unos 2 segundos por boleta. El detalle de cada lectura queda en
`resultados/AAAA-MM-DD-HH-MM.json` (texto leído, productos esperados y encontrados).

## Qué mide

| Métrica | Qué es |
|---|---|
| encontrados % | productos de la boleta que aparecen en la lectura (descripción parecida en un 80 %) |
| precio ok % | productos encontrados con el precio exacto |
| basura x boleta | renglones leídos como producto que no lo son |
| fugas | datos personales o de pago que llegaron a la lista. **Tiene que ser 0**: si no, el comando termina con error |

Cada imagen se lee de dos formas: **recorte** (solo la zona de productos, como se le pide al
usuario) y **completa** (la foto entera, como hace mucha gente igual).

## Fotos reales

Para probar con boletas de verdad, poné las fotos en `reales/` con un `.json` del mismo nombre:

```json
{
  "productos": [
    { "descripcion": "SAL SEK FINA YODOFLUORADA 500 GRS.", "precio": 45.28 },
    { "descripcion": "SAL SEK GRUESA YODOFLUORADA 500 GRS.", "precio": 45.28 }
  ],
  "sensibles": ["2902", "JUAN"],
  "recorte": { "x": 120, "y": 880, "ancho": 1300, "alto": 420 }
}
```

- `sensibles`: datos de la boleta que nunca deberían aparecer (últimos dígitos de la
  tarjeta, nombre, cédula). Sirven para medir fugas.
- `recorte` (opcional): la zona de productos en píxeles de la foto. Sin él, se lee solo la
  foto entera.

**La carpeta `reales/` no se sube a GitHub** (está en `.gitignore`): las fotos pueden tener
datos personales. Por la misma razón, de las fotos reales no se guarda el texto leído en los
resultados, solo los productos.

## Resultados (01/10/2026, 48 boletas, leyendo el recorte)

| Nivel de foto | Encontrados | Precio ok | Basura x boleta |
|---|---|---|---|
| limpia | 92 % | 90 % | 0 |
| leve | 89 % | 85 % | 0,1 |
| media | 79 % | 72 % | 0,1 |
| fuerte | 21 % | 15 % | 1,3 |

Antes de los arreglos que encontró este banco (espacio después de la coma, signo al final del
monto, productos en dos renglones) era 56 % con fotos limpias y 40 % en total. Fugas: 0.

Lo que falta: las fotos muy dañadas (arrugas fuertes, sombra, poca resolución). Ahí el
problema es la lectura de la imagen, no el filtro: por eso la web deja corregir la lista
antes de guardar.
