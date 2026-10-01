# Banco de pruebas del lector de boletas

**La idea, en simple:** es tomarle un examen al lector. La foto es la pregunta; el `.json` de
al lado es la hoja con las respuestas correctas; el evaluador le da la foto al lector, compara
lo que contestó con las respuestas y le pone nota. Para que la nota valga hacen falta muchos
exámenes: por eso se generan muchas fotos.

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

## Probar con una boleta tuya, paso a paso

1. Pasá la foto **original** del celular a `eval/boletas/reales/` (por ejemplo
   `reales/tata-01.jpg`). Que sea la original: si pasa por WhatsApp o un chat se achica y
   las comas de los precios desaparecen.
2. Al lado, creá `reales/tata-01.json` con lo que dice la boleta (las respuestas correctas):
   los productos con su precio y, si querés, los datos que nunca deberían aparecer.
3. Corré `docker compose run --rm eval-boletas`. Además de las boletas falsas, arma
   12 versiones "parecidas" de cada foto tuya (`variar.mjs`: más giradas, oscuras, borrosas,
   chicas, con sombra) y le toma el examen al lector con todas.
4. Mirá la tabla **Fotos reales y sus versiones**: qué porcentaje de productos encontró y
   cuántos precios leyó bien.

Para más versiones por foto: `docker compose run --rm -e VERSIONES=40 eval-boletas`.

## Fotos reales: el formato del `.json`

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

## Resultados

Para probar otra forma de preparar la imagen sin tocar la web:
`OCR_ANCHO=2400 OCR_NIVELES=0 docker compose run --rm eval-boletas` (ancho al que se amplía
el recorte y porcentaje de niveles automáticos; ver `web/src/lib/lectorBoleta.ts`).

**01/10/2026**, 60 boletas falsas (cinco niveles de foto) + la boleta real de Macromercado y
12 versiones, leyendo el recorte. Precio exacto:

| Nivel de foto | Antes (2400 px) | Ahora (1800 px + niveles) |
|---|---|---|
| limpia | 89 % | 93 % |
| leve | 73 % | 70 % |
| media | 57 % | 63 % |
| fuerte | 9 % | 16 % |
| whatsapp (renglones de ~20 px, JPG) | 81 % | 82 % |
| **boleta real de Macromercado** (por WhatsApp, 900 px) | 0 % → 33 % | **67 %** |

Boleta **inventada** con formato de Macromercado (impresión nítida, 939 px de ancho; solo
para probar, no es un dato real), con 3 versiones de cada forma de llegar:

| Cómo llega | Precio exacto (recorte) | Precio exacto (foto entera) |
|---|---|---|
| archivo original | 100 % | 100 % |
| por WhatsApp (1600 px, JPG) | 100 % | 100 % |
| captura de la galería, por WhatsApp | 95 % | 100 % |
| leve / media | 100 % | 100 % |
| fuerte | 29 % | 29 % |

La diferencia con la boleta real no es "archivo o WhatsApp" sino **la impresión**: con tinta
negra y nítida aguanta WhatsApp y capturas; con tinta térmica gris y gastada, no tanto.

Cómo se llegó ahí, paso a paso, con este banco:

1. Espacio después de la coma, signo al final del monto y productos en dos renglones: de
   56 % a 92 % con fotos limpias.
2. Precios sin coma en boletas con columnas ("1000 4528" = 1,000 × 45,28) y el monto calculado
   cuando falta su columna: la boleta real pasa de 0 % a 33 %.
3. Niveles automáticos (la tinta gris del papel térmico pasa a negro) y menos ampliación: la
   boleta real llega a 67 %.
4. El recuadro de impuestos escrito sin puntos ("T.BImp.:", "T.Expa.:"): sin basura al leer la
   foto entera.

Lo que sigue flojo:

- **Las boletas falsas son más fáciles que las reales**: con renglones del mismo tamaño, una
  falsa da 82 % y la real 67 %. Las reales tienen tinta gris gastada, papel arrugado y letra
  angosta. Hacen falta más boletas reales (de distintos comercios, mandadas por WhatsApp
  como lo haría un usuario) para medir de verdad.
- **Leer la foto entera en vez del recorte** empeora mucho la boleta real (0 %): con todo el
  ticket la letra queda más chica. Por eso la web pide recortar los productos.
- Volver a achicar una foto que ya vino por WhatsApp (las versiones de la boleta real) la
  deja ilegible: ahí la única salida es escribir los productos a mano (la web lo permite).
