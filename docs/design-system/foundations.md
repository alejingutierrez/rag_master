# Foundations

Los tokens fundamentales del sistema: tipografía, color, espaciado,
grid, bordes, elevación y motion. Todo lo que viene después se
construye con estos.

---

## Tipografía

### Familias

| Rol         | Familia              | Uso                                                                    |
| ----------- | -------------------- | ---------------------------------------------------------------------- |
| `serif`     | **Newsreader**       | Headings, lectura larga, respuestas RAG, prosa académica               |
| `sans`     | **IBM Plex Sans**    | UI: nav, botones, labels, formularios, tablas                          |
| `mono`      | **IBM Plex Mono**    | Código, datos crudos, citas (`[42]`), IDs de documento, kbd            |

**Por qué Newsreader.** Es una serif variable diseñada por Production
Type específicamente para lectura digital larga. Tiene optical sizing
(ajusta proporción según tamaño), pesos de 200 a 800, y un carácter
editorial-académico sin caer en lo arcaico. Es legítimamente
*contemporánea*, no nostálgica.

**Por qué Plex Sans.** Es la sans de IBM, diseñada como contrapeso
"humano-técnico" a Helvetica. Tiene proporciones más estrechas que
Inter (ahorra espacio horizontal en sidebars), carácter humanista
(menos frío que Inter), y soporta números monoespaciados como feature
opcional. Es la combinación perfecta con una serif editorial.

**Por qué Plex Mono.** Coherencia con Plex Sans. Pesos consistentes,
alineación métrica.

### Carga

Las tres familias se cargan vía `next/font/google` con `display: 'swap'`
y se exponen como CSS variables (`--font-serif`, `--font-sans`,
`--font-mono`). Subsetting latin-ext (necesario para tildes, ñ, y
caracteres precolombinos en transliteraciones).

Newsreader carga el rango variable completo (`opsz 6..72`, `wght 200..800`).
Plex Sans carga pesos `400, 500, 600, 700`. Plex Mono carga `400, 500`.

### Escala tipográfica

Una sola escala, modular ratio 1.200 (minor third), basada en 16px.

| Token            | Tamaño  | Line height | Letter spacing | Uso                                   |
| ---------------- | ------: | ----------: | -------------: | ------------------------------------- |
| `text-display`   |  48px   |    1.05     |    -0.025em    | Hero, título de research artifact     |
| `text-h1`        |  36px   |    1.15     |    -0.020em    | Título de página                      |
| `text-h2`        |  28px   |    1.20     |    -0.015em    | Sección dentro de página              |
| `text-h3`        |  22px   |    1.25     |    -0.010em    | Subsección, card title grande         |
| `text-h4`        |  18px   |    1.30     |    -0.005em    | Card title, drawer title              |
| `text-h5`        |  16px   |    1.35     |     0          | Label fuerte, group heading           |
| `text-body-lg`   |  17px   |    1.65     |     0          | Lectura larga (respuestas RAG)        |
| `text-body`      |  15px   |    1.55     |     0          | Texto general de UI                   |
| `text-sm`        |  13px   |    1.50     |     0          | Metadatos, labels secundarios         |
| `text-xs`        |  12px   |    1.45     |    +0.005em    | Captions, microcopy                   |
| `text-micro`     |  11px   |    1.40     |    +0.020em    | Tags muy pequeños, badges densos      |

**Reglas:**

- `text-display` y `text-h1` usan **Newsreader** con `opsz` alto (32+)
- `text-h2` a `text-h5` pueden usar **Newsreader** (contenido editorial)
  o **Plex Sans** (UI) según contexto. Default UI: Plex Sans. Default
  contenido: Newsreader.
- `text-body-lg` (lectura larga) **siempre** es Newsreader
- `text-body`, `text-sm`, `text-xs`, `text-micro` **siempre** son
  Plex Sans
- Letter spacing negativo en titulares grandes corrige la apertura
  visual; positivo en textos chicos mejora legibilidad

### Pesos

| Peso | Token         | Uso                                              |
| ---: | ------------- | ------------------------------------------------ |
|  400 | `regular`     | Body, default                                    |
|  500 | `medium`      | Labels, UI emphasis (botones, nav activa)        |
|  600 | `semibold`    | Headings (Plex), subtítulos                      |
|  700 | `bold`        | Titulares Newsreader (h1, h2, display)           |

**Newsreader display weight:** para `text-display` y `text-h1`, usar
peso 700 con `opsz` alto. Para `text-h2` y `text-h3` editoriales, peso
600.

No usar pesos 200, 300, 800 en producción. Son recursos para casos
muy específicos (ej. número de año gigante en timeline) y deben pedir
permiso explícito al sistema.

### Reglas de prosa larga

Aplican a `.prose-academic` y a respuestas del asistente (`text-body-lg`):

- **Ancho máximo:** `70ch` (~640px a `text-body-lg`)
- **Alineación:** izquierda. **Nunca** `justify` (crea ríos de espacio)
- **Indentación de párrafo:** no. Espacio entre párrafos (`1em` bottom)
- **Hyphenation:** auto en español (`hyphens: auto; lang="es"`)
- **Comillas:** «españolas» en cuerpo, "tipográficas" en UI
- **Números:** lining numerals en UI; old-style en cuerpo prose
- **Citas inline (`[42]`):** Plex Mono, tamaño 0.75em, baseline-aligned
- **Enlaces inline:** underline con offset `0.2em`, color `tinta-700`

### Ejemplo de jerarquía completa

```
Display       Newsreader 48/50, weight 700, opsz 48
H1            Newsreader 36/41, weight 700, opsz 36
H2            Newsreader 28/34, weight 600, opsz 28
H3            Plex Sans 22/28, weight 600
H4            Plex Sans 18/23, weight 600
H5            Plex Sans 16/22, weight 600
Body-lg       Newsreader 17/28, weight 400, opsz 17
Body          Plex Sans 15/23, weight 400
SM            Plex Sans 13/20, weight 400
XS            Plex Sans 12/17, weight 400, tracking +0.005
Micro         Plex Sans 11/15, weight 500, tracking +0.020
```

---

## Color

### Filosofía

Tres capas:

1. **Neutros** (`ink-*`) — la base. Backgrounds, superficies, texto,
   bordes. Todo lo que no es contenido específico.
2. **Acento signature** (`tinta-*`) — el único color de marca. Acciones
   primarias, focus rings, links, énfasis editorial.
3. **Color de dominio** (`period-*`, `category-*`, semánticos) —
   contextual. Solo aparece donde el dominio lo justifica.

**Reglas duras:**

- Ningún componente de UI usa color de dominio como color de marca.
- Ningún elemento decorativo (gradiente, fondo de hero, ilustración)
  usa color saturado.
- Dark mode no es derivado; cada token tiene par light/dark explícito.

### Neutros — `ink`

Escala de 13 pasos, perceptualmente uniforme (oklab). Levemente
azulada (no gris puro) para sentir "tinta sobre papel" en lugar de
"gris industrial".

| Token         | Light       | Dark         | Uso típico                                         |
| ------------- | ----------- | ------------ | -------------------------------------------------- |
| `ink-0`       | `#FFFFFF`   | `#0A0B0D`    | Background base (page)                             |
| `ink-25`      | `#FAFAFB`   | `#101216`    | Background sutilmente diferenciado                 |
| `ink-50`      | `#F5F5F7`   | `#16181D`    | Background de bloque secundario                    |
| `ink-100`     | `#EDEEF0`   | `#1D2026`    | Background hover, surface elevation 1              |
| `ink-200`     | `#DFE1E5`   | `#262A31`    | Bordes default                                     |
| `ink-300`     | `#C5C8CE`   | `#363B44`    | Bordes énfasis, divisores                          |
| `ink-400`     | `#9CA1AB`   | `#4D525C`    | Iconos disabled, placeholder                       |
| `ink-500`     | `#71767F`   | `#6C7280`    | Texto terciario, captions                          |
| `ink-600`     | `#565A63`   | `#8A8F98`    | Texto secundario, iconos default                   |
| `ink-700`     | `#3D4148`   | `#A7ABB3`    | Texto secundario fuerte                            |
| `ink-800`     | `#272A30`   | `#C5C8CE`    | Texto primario en componentes invertidos           |
| `ink-900`     | `#16181C`   | `#E1E3E7`    | Texto primario                                     |
| `ink-1000`    | `#08090B`   | `#F5F6F8`    | Texto enfático, headings                           |

**Notas:**

- `ink-0` light es **blanco puro** porque la app se va a ver mucho en
  pantallas mate; los blancos cremosos se vuelven "amarillentos" en
  monitores buenos. Si en testing visual se siente frío, ajustar a
  `#FCFCFB` (warm white sutil).
- `ink-0` dark **no es negro puro**. `#0A0B0D` mantiene contraste sin
  el "agujero negro" en OLED.
- `ink-1000` dark **no es blanco puro** (`#F5F6F8`). Evita strain en
  lecturas largas y mantiene texto y fondo "del mismo material".

### Acento signature — `tinta`

Un solo acento. Es la voz cromática del producto.

| Token         | Light       | Dark         | Uso                                                |
| ------------- | ----------- | ------------ | -------------------------------------------------- |
| `tinta-50`    | `#EFF3F8`   | `#0F1620`    | Background sutil, hover de elementos primarios     |
| `tinta-100`   | `#DCE5EF`   | `#162338`    | Selected background (nav, menu)                    |
| `tinta-200`   | `#B6C7DC`   | `#1F3252`    | Border de input focused                            |
| `tinta-300`   | `#88A2C0`   | `#2C4470`    | Outline ring (focus)                               |
| `tinta-400`   | `#5878A0`   | `#3F5A8C`    | Icon accent secundario                             |
| `tinta-500`   | `#345887`   | `#5B7AAE`    | Link default, icon primario                        |
| `tinta-600`   | `#264273`   | `#7991C0`    | Action default (button bg)                         |
| **`tinta-700`** | **`#1E3A5F`** | **`#94A8CE`** | **Acento primario** — button bg, link, ring   |
| `tinta-800`   | `#162F4F`   | `#B0BFDC`    | Action hover/active                                |
| `tinta-900`   | `#0F2440`   | `#CDD7E8`    | Action pressed                                     |
| `tinta-950`   | `#0A1B30`   | `#E2E8F2`    | Inverso (texto sobre `tinta-700`)                  |

**El token signature es `tinta-700` (`#1E3A5F`).** Es un azul tinta
profundo, sobrio, asociable al azul de mapas históricos y al azul de
escritura de documentos del XIX colombiano. Sin caer en cliché
patriótico (no es el azul de la bandera; es el azul de la fuente).

### Acento secundario — `monte` (reservado)

Verde botella, uso muy restringido: success contextual cuando el
verde del semáforo (`success`) no es suficiente (ej. "este dato está
verificado por 3 fuentes"), y acentos editoriales puntuales (línea
debajo del título de un research artifact).

| Token        | Light     | Dark      | Uso                              |
| ------------ | --------- | --------- | -------------------------------- |
| `monte-100`  | `#E1ECE6` | `#142420` | Background success académico     |
| `monte-500`  | `#3D7059` | `#5C9B7E` | Verde de "verificado"            |
| `monte-700`  | `#2D5F3F` | `#88BDA1` | Acento editorial (línea, ícono)  |

### Color de dominio — `period`

Los 16 colores de período histórico. **Conservamos los hex actuales**
(están bien pensados narrativamente) pero documentamos sus valores
dark mode (más claros, menos saturados para mantener WCAG AA en fondo
oscuro).

| Token           | Light       | Dark        | Período                                  |
| --------------- | ----------- | ----------- | ---------------------------------------- |
| `period-pre`    | `#B45309`   | `#E8995F`   | Prehispánico                             |
| `period-con`    | `#92400E`   | `#D88860`   | Conquista                                |
| `period-col`    | `#78350F`   | `#C97A55`   | Colonia                                  |
| `period-pre-ind`| `#A16207`   | `#DBA653`   | Pre-independencia                        |
| `period-ind`    | `#1E40AF`   | `#7A9CE8`   | Independencia                            |
| `period-ngr`    | `#1D4ED8`   | `#7A99E8`   | Nueva Granada                            |
| `period-euc`    | `#2563EB`   | `#7AA8E8`   | Estados Unidos de Colombia               |
| `period-reg`    | `#7C2D12`   | `#D88060`   | Regeneración                             |
| `period-rep-lib`| `#0F766E`   | `#5FB3A9`   | República Liberal                        |
| `period-vio`    | `#991B1B`   | `#E07A7A`   | La Violencia                             |
| `period-fn`     | `#4F46E5`   | `#9B95F0`   | Frente Nacional                          |
| `period-cna`    | `#7C3AED`   | `#B399F0`   | Crisis y narcotráfico                    |
| `period-c91`    | `#DB2777`   | `#F08AB3`   | Constitución 1991                        |
| `period-sde`    | `#0891B2`   | `#5FBED8`   | Seguridad Democrática                    |
| `period-pos`    | `#059669`   | `#5FBE96`   | Posconflicto                             |
| `period-trans`  | `#6B7280`   | `#9CA3AF`   | Transversal                              |

**Uso permitido:**

- Fondo de badge de período (con texto blanco/ink-0)
- Banda izquierda de card (4px)
- Punto/línea en timeline
- Borde sutil (1-2px) en source card del período
- Nodo en grafo

**Uso prohibido:**

- Color principal de un botón de UI
- Background de página completa
- Texto largo (excepto en heading muy puntual de un artifact de período)

### Color de dominio — `category`

Diez categorías temáticas. Mismos principios que period.

| Token            | Light       | Dark        | Categoría                       |
| ---------------- | ----------- | ----------- | ------------------------------- |
| `category-pol`   | `#1E40AF`   | `#7A9CE8`   | Política                        |
| `category-eco`   | `#059669`   | `#5FBE96`   | Economía                        |
| `category-con`   | `#DC2626`   | `#F08585`   | Conflicto                       |
| `category-soc`   | `#D97706`   | `#E8995F`   | Sociedad *(ajustado de `#F59E0B`)* |
| `category-cul`   | `#7C3AED`   | `#B399F0`   | Cultura                         |
| `category-rel`   | `#0891B2`   | `#5FBED8`   | Relaciones internacionales      |
| `category-ter`   | `#65A30D`   | `#9DC95E`   | Territorio                      |
| `category-mov`   | `#DB2777`   | `#F08AB3`   | Movimientos sociales            |
| `category-ins`   | `#475569`   | `#94A3B8`   | Instituciones                   |
| `category-his`   | `#A855F7`   | `#C99FF6`   | Historiografía                  |

**Nota sobre colisiones con `period`:** `category-pol` y `period-ind`
son el mismo azul intencionalmente — son conceptos relacionados.
`category-con` (Conflicto) y `period-vio` son rojos cercanos pero
distintos. Esto es OK porque period y category nunca compiten en el
mismo componente: period va a la izquierda (banda, badge), category
va inline (chip).

### Semánticos

Cinco estados. Severamente limitados.

| Token           | Light       | Dark        | Uso                                     |
| --------------- | ----------- | ----------- | --------------------------------------- |
| `success-bg`    | `#E6F4EC`   | `#0F2A1C`   | Background de toast/alert success       |
| `success-fg`    | `#0E7B43`   | `#5FBE96`   | Texto/icono success                     |
| `warning-bg`    | `#FBF1DC`   | `#2C2110`   | Background warning                      |
| `warning-fg`    | `#A36A05`   | `#E8B660`   | Texto/icono warning                     |
| `danger-bg`     | `#FBE7E7`   | `#2C1010`   | Background danger                       |
| `danger-fg`     | `#B42323`   | `#E88585`   | Texto/icono danger                      |
| `info-bg`       | `#E5EDF7`   | `#101C2C`   | Background info                         |
| `info-fg`       | `#2A5A95`   | `#7A9CE8`   | Texto/icono info                        |
| `neutral-bg`    | `ink-100`   | `ink-100`   | Toast neutro, no-status                 |

No agregar más colores semánticos. Si un caso de uso parece requerir
uno nuevo, probablemente es un caso de `category-*` o `period-*`.

### Selecciones, focus, overlays

| Token              | Light                              | Dark                               |
| ------------------ | ---------------------------------- | ---------------------------------- |
| `selection-bg`     | `tinta-200` a 50% alpha            | `tinta-300` a 35% alpha            |
| `focus-ring`       | `tinta-300`, 2px, offset 2px       | `tinta-400`, 2px, offset 2px       |
| `overlay-scrim`    | `ink-1000` a 50% alpha             | `ink-0` a 70% alpha                |
| `overlay-blur`     | `ink-0` a 75% alpha + blur(12px)   | `ink-25` a 70% alpha + blur(12px)  |

---

## Espaciado

### Escala

Base 4px. Una sola escala, sin tokens semánticos (no hay
`spacing-card-padding`; hay `space-6`).

| Token        | Valor   | Notas                                       |
| ------------ | ------- | ------------------------------------------- |
| `space-0`    | 0       |                                             |
| `space-0.5`  | 2px     | Solo para iconografía interna               |
| `space-1`    | 4px     | Gap muy denso (tags inline)                 |
| `space-1.5`  | 6px     |                                             |
| `space-2`    | 8px     | Gap denso (chips, badges agrupados)         |
| `space-3`    | 12px    | Padding de botón sm vertical                |
| `space-4`    | 16px    | Padding de card mínimo                      |
| `space-5`    | 20px    |                                             |
| `space-6`    | 24px    | Padding de card default                     |
| `space-8`    | 32px    | Gap entre secciones                         |
| `space-10`   | 40px    |                                             |
| `space-12`   | 48px    | Padding hero, gap entre bloques editoriales |
| `space-16`   | 64px    | Padding página vertical                     |
| `space-20`   | 80px    | Solo para landing/hero                      |
| `space-24`   | 96px    | Solo para landing/hero                      |

**Reglas:**

- Padding interno de componente: múltiplos de 4 (4, 8, 12, 16, 24)
- Gap entre componentes: múltiplos de 4 a partir de 8 (8, 12, 16, 24, 32)
- Margen vertical de sección: 24, 32, 48
- No usar valores fuera de escala. Si necesitas 22px, usa 20 o 24.

### Reglas de aplicación

| Contexto                  | Espaciado                                          |
| ------------------------- | -------------------------------------------------- |
| Texto inline              | `space-1` (4px) entre tokens                       |
| Iconos + texto en botón   | `space-2` (8px)                                    |
| Botones en grupo          | `space-2` (8px)                                    |
| Card padding              | `space-6` (24px); `space-4` en cards pequeñas      |
| Card → siguiente card     | `space-4` (16px) en grid, `space-6` en lista       |
| Sección → sección         | `space-8` (32px) o `space-12` (48px) en hero/edit  |
| Página padding (desktop)  | `space-8` vertical, `space-8` horizontal           |
| Página padding (mobile)   | `space-4` vertical y horizontal                    |

---

## Grid y contenedores

### Breakpoints

| Token  | Min width  | Uso                                                |
| ------ | ---------- | -------------------------------------------------- |
| `sm`   | 640px      | Tablet portrait                                    |
| `md`   | 768px      | Tablet landscape                                   |
| `lg`   | 1024px     | Desktop pequeño                                    |
| `xl`   | 1280px     | Desktop estándar                                   |
| `2xl`  | 1536px     | Desktop grande                                     |

Mobile-first. Default styles aplican < 640px; `sm:`, `md:`… van
sumando.

### Contenedores (max-width)

| Token              | Max-width  | Uso                                              |
| ------------------ | ---------: | ------------------------------------------------ |
| `container-reading`|     680px  | Lectura larga (research artifact, respuesta RAG) |
| `container-prose`  |     760px  | Prosa con metadatos laterales                    |
| `container-page`   |    1080px  | Páginas estándar (dashboard, listas)             |
| `container-wide`   |    1440px  | Páginas con data densa (tablas, grids)           |
| `container-canvas` |       —    | Full width (timeline, grafo, mapa)               |

### Grid de página

12 columnas, gutter 24px (desktop), 16px (tablet), 12px (mobile).

**Layouts típicos:**

- Dashboard: 12 cols, cards de 4 (3 por fila) o 6 (2 por fila)
- Conversación: 8 cols chat + 4 cols sources (drawer-able)
- Reading: 8 cols centradas, 2 cols TOC sticky lateral
- Timeline: full canvas

### Sidebars

| Variante      | Ancho       | Notas                                       |
| ------------- | ----------- | ------------------------------------------- |
| Colapsada     | 64px        | Solo iconos                                 |
| Default       | 240px       | Iconos + labels                             |
| Expandida     | 320px       | Iconos + labels + metadatos (counts, etc.)  |

Sidebar es **colapsable**, no escondible. Siempre visible en desktop
≥1024px; drawer overlay en mobile.

### Reading width

Ancho óptimo de lectura: **65–72ch** (caracteres). Con `text-body-lg`
(17px) eso son ~640–680px. Es el ancho objetivo de `container-reading`.

---

## Bordes y radios

### Border widths

| Token            | Valor   | Uso                                              |
| ---------------- | ------- | ------------------------------------------------ |
| `border-thin`    | 1px     | Default (cards, inputs, divisores)               |
| `border-medium`  | 1.5px   | Énfasis sutil                                    |
| `border-thick`   | 2px     | Focus rings, estado activo                       |

### Border radius

| Token         | Valor   | Uso                                                |
| ------------- | ------- | -------------------------------------------------- |
| `radius-none` | 0       | Tablas, divisores                                  |
| `radius-sm`   | 4px     | Tags, badges, chips, kbd                           |
| `radius-md`   | 6px     | Inputs, botones, selects                           |
| `radius-lg`   | 8px     | Cards estándar, tooltips, popovers                 |
| `radius-xl`   | 12px    | Drawers, modales, dialogs                          |
| `radius-2xl`  | 16px    | Cards de hero, contenedores grandes                |
| `radius-full` | 9999px  | Avatares, badges circulares, switches              |

**Reglas:**

- Coherencia interna: si un card tiene `radius-lg`, sus inputs internos
  tienen `radius-md` (un paso abajo).
- Nunca mezclar `radius-none` con `radius-xl` en el mismo cluster.

---

## Elevación

Cuatro niveles. En light mode son sombras; en dark mode son
sombras + ring sutil (porque las sombras puras se pierden en
backgrounds oscuros).

| Token        | Light                                          | Dark                                                        | Uso                                  |
| ------------ | ---------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| `elev-0`     | `none`                                         | `none`                                                      | Flat — backgrounds, inset            |
| `elev-1`     | `0 1px 2px rgba(8,9,11,.05)`                   | `0 0 0 1px ink-200 inset`                                   | Cards default                        |
| `elev-2`     | `0 2px 4px rgba(8,9,11,.06), 0 1px 2px rgba(8,9,11,.04)` | `0 0 0 1px ink-200 inset, 0 2px 6px rgba(0,0,0,.4)` | Cards hover, dropdowns               |
| `elev-3`     | `0 8px 24px rgba(8,9,11,.08), 0 2px 4px rgba(8,9,11,.04)` | `0 0 0 1px ink-300 inset, 0 8px 24px rgba(0,0,0,.5)` | Popovers, menus, tooltips           |
| `elev-4`     | `0 16px 48px rgba(8,9,11,.12), 0 4px 12px rgba(8,9,11,.06)` | `0 0 0 1px ink-300 inset, 0 16px 48px rgba(0,0,0,.6)` | Modales, drawers, command palette  |

**Reglas:**

- `elev-1` es el default invisible: usar en cards. La diferencia con
  flat es perceptible al hover (elev-2).
- En dark mode, **nunca** usar solo sombra para elevar — combinar con
  ring inset.
- No usar gradientes para simular elevación.

---

## Motion

### Duraciones

| Token            | Valor   | Uso                                              |
| ---------------- | ------: | ------------------------------------------------ |
| `duration-instant`|   75ms | Cambio de color (hover, active)                  |
| `duration-fast`  |  150ms  | Transformaciones pequeñas (escala icono, fade)   |
| `duration-base`  |  220ms  | Entradas de UI estándar (tooltip, popover)       |
| `duration-slow`  |  320ms  | Modales, drawers, sheet                          |
| `duration-deliberate`| 500ms| Solo coreografía narrativa (no UI común)        |

### Easings

| Token             | Curva                                | Uso                                         |
| ----------------- | ------------------------------------ | ------------------------------------------- |
| `ease-out`        | `cubic-bezier(0.2, 0.8, 0.2, 1)`     | **Default** — entradas, hover                |
| `ease-in-out`     | `cubic-bezier(0.4, 0, 0.2, 1)`       | Transformaciones bidireccionales            |
| `ease-spring`     | `cubic-bezier(0.34, 1.56, 0.64, 1)`  | Overlays con sensación de "asentarse"        |
| `linear`          | `linear`                             | Progress bars, shimmer                      |

### Principios

- **Cambios de estado < 200ms.** Hover, focus, active.
- **Entradas de UI < 320ms.** Tooltips, popovers, dropdowns.
- **Modales y drawers ~320ms.** Suficiente para registrar el cambio
  de contexto sin sentir lentitud.
- **Streaming de texto:** sin animación de fade letra por letra
  (cansa). Caret titilante 1s, texto aparece en burst de palabras
  completas.
- **`prefers-reduced-motion: reduce`:** todas las duraciones bajan a
  ~50ms, transformaciones de translate se vuelven opacity-only.
- **No animar:** scroll vertical, cambios de página, layout shifts.
  Lo único animado durante el scroll es lo que el usuario tocó.

### Tabla de transiciones por componente

| Acción                          | Duration       | Easing      | Propiedades                  |
| ------------------------------- | -------------- | ----------- | ---------------------------- |
| Button hover                    | instant (75ms) | ease-out    | bg, border, color            |
| Input focus                     | fast (150ms)   | ease-out    | border, ring                 |
| Tooltip aparece                 | base (220ms)   | ease-out    | opacity, translateY (4px)    |
| Tooltip desaparece              | fast (150ms)   | ease-in     | opacity                      |
| Dropdown abre                   | base (220ms)   | ease-out    | opacity, translateY (-6px), scale (0.98→1) |
| Modal abre                      | slow (320ms)   | ease-out    | opacity, scale (0.96→1)      |
| Drawer abre                     | slow (320ms)   | ease-spring | translateX                   |
| Theme switch (light↔dark)       | base (220ms)   | linear      | bg, color (sin transform)    |

---

## Iconografía

**Librería:** [Lucide](https://lucide.dev) (React: `lucide-react`).
2,000+ iconos consistentes, line-based, weight ajustable, MIT.

**Tamaños canónicos:**

| Token        | Valor  | Uso                                            |
| ------------ | -----: | ---------------------------------------------- |
| `icon-xs`    | 12px   | Inline en `text-xs`, badges densos             |
| `icon-sm`    | 14px   | Inline en botones sm                           |
| `icon-md`    | 16px   | Default — botones, inputs, nav                 |
| `icon-lg`    | 20px   | Headers, cards prominentes                     |
| `icon-xl`    | 24px   | Hero icons, empty states                       |

**Stroke:** 1.5px (Lucide default es 2; bajamos para tono editorial).

**Color:** hereda de texto (`currentColor`). Nunca colorear icono fuera
de su contexto (un icono naranja en una row gris no tiene sentido a
menos que esté en un period badge).

**Reglas:**

- Icono solo (sin label): obligatorio `aria-label`.
- Icono + label: `aria-hidden="true"` en el icono.
- No usar iconos decorativos en headings (compiten con la tipografía
  serif).

---

## Lista de tokens — resumen rápido

Para consulta exprés. Detalles en cada sección de arriba.

```
TIPOGRAFÍA
  serif  → Newsreader (display, headings, reading)
  sans   → IBM Plex Sans (UI)
  mono   → IBM Plex Mono (code, citations)

ESCALA
  display 48 / h1 36 / h2 28 / h3 22 / h4 18 / h5 16
  body-lg 17 / body 15 / sm 13 / xs 12 / micro 11

COLOR (signature)
  ink-0..1000  → 13 pasos neutros
  tinta-700    → #1E3A5F (acento primario)
  monte-700    → #2D5F3F (acento editorial sutil)

ESPACIADO
  4px base, 0/0.5/1/1.5/2/3/4/5/6/8/10/12/16/20/24

CONTENEDORES
  reading 680 / prose 760 / page 1080 / wide 1440

RADIOS
  sm 4 / md 6 / lg 8 / xl 12 / 2xl 16

ELEVACIÓN
  4 niveles: flat / 1 / 2 / 3 / 4

MOTION
  instant 75 / fast 150 / base 220 / slow 320
```
