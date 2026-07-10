# El Escenario — motor de video tipográfico 9:16

Renderizador de videos tipográficos verticales para **El Taller** (Historia
Colombiana). Es un proyecto **standalone** (su propio `package.json`) porque el
render usa Chromium headless + ffmpeg y **no corre en App Runner**.

Arquitectura espejo del Taller: un **Director** agéntico (en la app Next, Fase B)
decide una "partitura", y este **Escenario** la renderiza de forma determinista
—igual que `art-director.ts` → `gpt-image-2`.

## Correr

```bash
cd remotion
npm install            # baja Remotion; el Chromium headless se descarga solo la 1a vez
npm run studio         # preview interactivo en el navegador
npm run render         # renderiza out/bogotazo.mp4 (1080x1920, 30fps)
```

Para renderizar otra partitura sin tocar código:

```bash
npm run render -- --props=./ruta/partitura.json
```

## Estructura

```
src/
  index.ts                 registerRoot
  Root.tsx                 Composition parametrica (duracion/tamano salen del score)
  score/
    schema.ts              CONTRATO: TypographicScore (TS puro, se compartira con el Director)
    examples/bogotazo.ts   partitura de referencia hecha a mano
  theme/
    fonts.ts               Instrument Serif / DM Sans / JetBrains Mono
    palette.ts             color por epoca (fuente autoritativa, unifica --p-* vs getPeriodColor)
    motion.ts              curvas + progresiones compartidas
  video/
    TypographicVideo.tsx   monta las escenas (Sequence + crossfade) + grano + chrome
    Chrome.tsx             HUD de epoca + barra de ritmo
    parts.tsx              primitivas: MaskRise, Fade, DrawBar
    layouts.tsx            vocabulario CERRADO: portada, enunciado, nombre, cifra, corte, cierre
```

## Regla de diseño

Los **6 layouts** son la *línea gráfica* (cerrada, no se inventan nuevos). La
**personalidad** de cada video sale de cómo el Director los ordena y temporiza,
y del **color de época**. Todo texto grande se ajusta al ancho con
`@remotion/layout-utils` (`fitLines`) para no desbordar el cuadro 9:16.

## Pendiente

- **Fase B** — Director: tema → `runRagPipeline` + verificación → partitura JSON.
- **Fase C** — Integración: guardar partitura + MP4 en el `Deliverable`, UI admin,
  render local → `@remotion/lambda`.
- **Fase D** — personalidades (ruptura / archivo / cifra / retrato), presets
  15/30/60s, fondos B/N+tinta detrás del texto.
