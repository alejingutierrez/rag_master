# Components

Especificación de componentes: primitivos (los building blocks de UI)
y componentes de dominio (los que hacen este producto reconocible).

Esto **no es código**. Es la especificación que el código debe
cumplir. Cada componente declara: anatomía, variantes, estados,
accesibilidad, y reglas de uso.

---

## Convenciones

- **Anatomía:** las partes que componen el componente, nombradas.
- **Variantes:** opciones que cambian el rol o el peso visual.
- **Tamaños:** `sm` / `md` / `lg`. Default `md`.
- **Estados:** default, hover, focus-visible, active, disabled,
  loading, error.
- **Tokens:** referencia a [foundations.md](./foundations.md).
- **A11y:** roles ARIA, keyboard, focus management.
- **No-hacer:** anti-patrones explícitos.

Componentes recomendados como base de implementación:
[Radix Primitives](https://www.radix-ui.com/primitives) (headless,
accesibles). Estilamos con Tailwind sobre Radix. Para `shadcn/ui`, OK
como punto de partida pero **reescribir tokens** para que use los
nuestros, no los de shadcn.

---

# 1. Primitivos

## Button

### Anatomía

```
[ icon? ] label [ icon-right? ] [ kbd-hint? ]
```

### Variantes

| Variante     | Bg                       | Border             | Color texto     | Uso                                          |
| ------------ | ------------------------ | ------------------ | --------------- | -------------------------------------------- |
| `primary`    | `tinta-700` → `tinta-800` hover | none         | `ink-0`         | Acción principal de página (una por vista)   |
| `secondary`  | `ink-0` → `ink-100` hover | `ink-200` → `ink-300` hover | `ink-900` | Acciones secundarias                  |
| `ghost`      | transparent → `ink-100` hover | none           | `ink-900`       | Acciones terciarias, en toolbars             |
| `link`       | none                     | none               | `tinta-700`     | Acción visualmente igual a un link           |
| `danger`     | `danger-fg` → 90% hover  | none               | `ink-0`         | Acciones destructivas confirmadas            |
| `danger-outline` | transparent → `danger-bg` hover | `danger-fg` | `danger-fg` | Acciones destructivas sin confirmar       |

### Tamaños

| Size  | Height | Padding-x | Font     | Icon  | Radius   |
| ----- | -----: | --------: | -------- | ----- | -------- |
| `sm`  | 28px   | 10px      | `xs` 500 | 14px  | `md` (6) |
| `md`  | 36px   | 14px      | `sm` 500 | 16px  | `md` (6) |
| `lg`  | 44px   | 18px      | `body` 500 | 18px | `md` (6) |

### Estados

- **Default:** según variante.
- **Hover:** según variante. Transición `duration-instant` `ease-out`.
- **Focus-visible:** ring `2px tinta-300`, offset 2px. No reemplaza el
  hover; coexisten.
- **Active:** translateY(0.5px) + ligeramente más oscuro.
- **Disabled:** opacity 0.45, cursor not-allowed, sin hover.
- **Loading:** spinner reemplaza el icono izquierdo; label sigue
  visible; click deshabilitado.

### Kbd hint

Algunos botones (especialmente en toolbars o command palette) muestran
shortcut. Posición: derecha del label, `kbd` component. Solo en `md`
y `lg`. Solo si hay shortcut realmente vinculado.

### A11y

- `<button>` nativo, no `<div>`.
- `aria-label` si solo tiene icono (ver `IconButton`).
- `aria-busy="true"` en loading.
- `aria-disabled="true"` + clase visual, evitar `disabled` puro cuando
  necesitamos tooltip explicativo.

### No-hacer

- No usar `primary` para más de una acción por vista. Si hay dos,
  ambas son `secondary` y una de las dos puede tener icono.
- No usar `danger` para acciones reversibles (ej. archivar). Solo para
  destrucción definitiva.
- No animar el bg con transition lenta (>200ms). Cambios de estado
  deben ser inmediatos.

---

## IconButton

Variante condensada de Button cuando solo hay icono.

| Size  | Box   | Icon | Radius   |
| ----- | ----: | ---- | -------- |
| `sm`  | 28px  | 14px | `md` (6) |
| `md`  | 32px  | 16px | `md` (6) |
| `lg`  | 40px  | 20px | `md` (6) |

Cuadrado, no rectangular. Variantes: las mismas que Button, pero
`ghost` es el default (porque IconButton vive en toolbars).

**A11y:** `aria-label` obligatorio. Tooltip *recomendado* en
desktop — ver `Tooltip`.

---

## Input

### Anatomía

```
[ label? ]
[ leading-icon? ] [ input ] [ trailing-icon? / clear-button? ]
[ help-text / error-text ]
```

### Tamaños

| Size  | Height | Padding-x | Font     |
| ----- | -----: | --------: | -------- |
| `sm`  | 28px   | 10px      | `xs`     |
| `md`  | 36px   | 12px      | `sm`     |
| `lg`  | 44px   | 14px      | `body`   |

### Estados

- **Default:** bg `ink-0`, border `ink-200`, placeholder `ink-400`.
- **Hover:** border `ink-300`.
- **Focus:** border `tinta-500`, ring `2px tinta-300` offset 0.
- **Disabled:** bg `ink-50`, color `ink-400`.
- **Error:** border `danger-fg`, ring red al focus.
- **Success:** border `success-fg` (uso raro, solo después de validar).

### Tipos

- `text`, `email`, `password`, `url`, `search`, `tel`, `number`
- `textarea` — misma anatomía, alto variable (min 80, max 400 con scroll)

### Labels y help text

- **Label:** siempre encima del input, no inline. Font `sm` weight
  500, color `ink-800`, margin-bottom 6px.
- **Help text:** font `xs`, color `ink-500`, margin-top 6px.
- **Error text:** font `xs`, color `danger-fg`, reemplaza help text
  cuando hay error.

### A11y

- Asociar label al input con `htmlFor` / `id`.
- Error text vinculado con `aria-describedby` + `aria-invalid="true"`.
- Si hay icono leading, `aria-hidden`. El icono no es interactivo.
- Si hay clear button trailing, es `<button>` con `aria-label="Limpiar"`.

### No-hacer

- No usar placeholder como label. Es accesibilidad rota.
- No animar bg en focus. Solo border y ring.
- No esconder error text en favor de tooltip. La validación es
  inline visible.

---

## Select / Combobox

Headless: [`@radix-ui/react-select`](https://www.radix-ui.com/primitives/docs/components/select)
para selección simple; [`cmdk`](https://cmdk.paco.me/) para combobox
con búsqueda.

### Anatomía

```
trigger:
  [ label-selected ] [ chevron ]
content (popover):
  [ search-input? ] [ option-list ]
```

### Estilo trigger

Idéntico a `Input` (mismas alturas, paddings, estados). Chevron
`ink-500`, 14px.

### Content popover

- Bg `ink-0`, border `ink-200`, `radius-lg`, `elev-3`.
- Max-height 320px, scroll interno.
- Items: padding `space-2 space-3`, hover `ink-100`, selected
  `tinta-50` + check icon a la derecha.
- Animación: `duration-base` `ease-out`, opacity + translateY(-6px) +
  scale(0.98 → 1).

### A11y

- Radix se encarga del rol `combobox`, `aria-expanded`, navegación con
  flechas, Enter para seleccionar, Esc para cerrar.

---

## Checkbox / Radio / Switch

### Checkbox

- Box 16px (sm) / 18px (md). Radius `sm` (4).
- Default: border `ink-300`, bg `ink-0`.
- Checked: bg `tinta-700`, check icon `ink-0`.
- Focus: ring `2px tinta-300`.
- Indeterminate: bg `tinta-700`, dash icon.

### Radio

- Circle 16px (sm) / 18px (md).
- Checked: dot interno 6px (sm) / 8px (md), color `tinta-700`.

### Switch

- Track 28×16 (sm) / 36×20 (md). Radius `full`.
- Off: bg `ink-300`.
- On: bg `tinta-700`.
- Thumb: bg `ink-0`, sombra sutil.
- Transición: `duration-fast` `ease-out`.

**Cuándo cada uno:**

| Caso                                          | Usar      |
| --------------------------------------------- | --------- |
| Acción inmediata, on/off                      | Switch    |
| Selección múltiple en formulario              | Checkbox  |
| Selección única en formulario                 | Radio     |
| Selección única visualmente prominente        | Tabs o Select |

---

## Card

### Anatomía

```
[ header? ]
  [ title ] [ actions? ]
  [ subtitle? ]
[ media? ]
[ body ]
[ footer? ]
```

### Variantes

| Variante      | Bg          | Border          | Elev      | Uso                                       |
| ------------- | ----------- | --------------- | --------- | ----------------------------------------- |
| `default`     | `ink-0`     | `ink-200`       | `elev-1`  | Cards de listas, dashboard                |
| `elevated`    | `ink-0`     | none            | `elev-2`  | Cards de hover, cards destacados          |
| `inset`       | `ink-50`    | none            | `elev-0`  | Card dentro de card, sección secundaria   |
| `outline`     | transparent | `ink-200`       | `elev-0`  | Empty states, placeholder                 |
| `period`      | `ink-0`     | `ink-200` + banda 4px `period-*` izq | `elev-1` | Source card de un período específico |

### Tamaños / paddings

| Size  | Padding   | Title font |
| ----- | --------- | ---------- |
| `sm`  | 16px      | `h5`       |
| `md`  | 24px      | `h4`       |
| `lg`  | 32px      | `h3`       |

### Estados (cuando es clickable)

- **Hover:** bg sube de `ink-0` a `ink-25` + elev sube un nivel.
  Border de `ink-200` a `ink-300`.
- **Focus-visible:** ring `2px tinta-300`, offset 2px.
- **Active:** elev baja un nivel.

### Reglas

- Radius siempre `radius-lg` (8px). Excepto `lg` que puede ir `radius-xl`.
- Si el card es clickable, **todo** el card es target. Evitar zonas
  muertas.
- Header y body separados por `space-3` (12px) vertical.
- En `period`, la banda izquierda es 4px sólido del color, sin
  gradiente.

---

## Badge / Tag / Chip

### Diferencia

- **Badge:** indicador no-interactivo (estado, conteo).
- **Tag:** etiqueta no-interactiva con texto (categoría, período).
- **Chip:** versión interactiva con remove `×` o click.

### Tamaños

| Size  | Height | Padding-x | Font          | Icon |
| ----- | -----: | --------: | ------------- | ---- |
| `xs`  | 18px   | 6px       | `micro`       | 11px |
| `sm`  | 22px   | 8px       | `xs`          | 12px |
| `md`  | 26px   | 10px      | `sm`          | 14px |

### Variantes

| Variante       | Bg                | Color           | Uso                                          |
| -------------- | ----------------- | --------------- | -------------------------------------------- |
| `solid`        | `ink-800`         | `ink-0`         | Énfasis fuerte (raro)                        |
| `subtle`       | `ink-100`         | `ink-800`       | Default                                      |
| `outline`      | transparent       | `ink-700` + border `ink-300` | Cuando solid sería ruido         |
| `tinta`        | `tinta-100`       | `tinta-700`     | Acento de marca                              |
| `period`       | `period-*` 12%    | `period-*`      | Período histórico (light); en dark, ajustado |
| `category`     | `category-*` 12%  | `category-*`    | Categoría temática                           |
| `success`      | `success-bg`      | `success-fg`    | Verificado, online                           |
| `warning`      | `warning-bg`      | `warning-fg`    | Atención                                     |
| `danger`       | `danger-bg`       | `danger-fg`     | Crítico                                      |

### Radius

- Tags y badges rectangulares: `radius-sm` (4px).
- Badges circulares (conteo): `radius-full`.
- Chips: `radius-full`.

### Anatomía Chip removable

```
[ icon? ] label [ × ]
```

`×` es un IconButton xs, hover bg `ink-200` con opacidad.

---

## Tooltip ⚠ CRÍTICO

El componente que rompe hoy con Ant. Especificación rigurosa.

### Engine

[`@radix-ui/react-tooltip`](https://www.radix-ui.com/primitives/docs/components/tooltip).
**No usar:** custom JS, position libraries propias, Ant Tooltip.

### Anatomía

```
trigger (cualquier elemento)
portal:
  content
    [ arrow ]
    [ text ]
```

Content se renderiza en un Portal a `document.body` para evitar
problemas de overflow/z-index en contenedores con `overflow: hidden`.

### Estilo

- Bg `ink-900` (light) / `ink-200` (dark)
- Color `ink-0` (light) / `ink-1000` (dark)
- Font `xs` weight 500
- Padding `space-1.5 space-2.5` (6 10)
- Radius `radius-md` (6)
- Max-width 280px
- Line-height 1.4
- Arrow 8px, mismo bg

### Posicionamiento

- **Side default:** `top`. Auto-flip si no cabe.
- **Align:** `center`. Auto-shift si trigger está cerca del borde.
- **Side offset:** 6px del trigger.
- **Collision boundary:** viewport. Padding del borde 8px.

### Timing

- **Delay open:** 400ms (no aparecer al pasar rozando).
- **Delay close:** 100ms (cerrar rápido pero no instantáneo).
- **Skip delay duration:** 300ms (si pasás de un tooltip a otro sin
  pausa, el segundo aparece sin delay).
- **Provider de delay:** envolver la app en `<TooltipProvider
  delayDuration={400} skipDelayDuration={300}>`.

### Animación

- Entrada: opacity 0→1 + translateY(4px → 0). `duration-base` (220ms)
  `ease-out`. Origin según side.
- Salida: opacity 1→0. `duration-fast` (150ms) `ease-in`.

### A11y

- Trigger necesita ser focusable (`<button>` o `tabIndex={0}`).
- Tooltip aparece en hover *y* en focus.
- Esc cierra (Radix).
- `aria-describedby` automático en Radix.
- **Nunca** poner información esencial solo en tooltip. Es siempre
  complementario.

### z-index

`z-50` (último nivel). Modales `z-40`, drawers `z-30`. Tooltip siempre
encima.

### Casos especiales

- **Sobre disabled buttons:** envolver el button en un `<span>` con
  `aria-disabled` para que el trigger pueda recibir hover. Disabled
  buttons no reciben eventos.
- **Dentro de Dialog:** Radix maneja el portal correctamente.
- **Mobile (touch):** Tooltip no aparece en touch. Si la información
  es importante en mobile, usar Popover (tap para abrir).

### No-hacer

- No usar tooltip para acciones (eso es Popover).
- No animar el arrow.
- No anidar tooltips.
- No usar tooltip para mostrar más de 2 líneas. Si necesitás más, es
  Popover.

---

## Popover

Diferencia con Tooltip: Popover es **interactivo** (click para abrir,
puede tener inputs/buttons dentro). Tooltip es solo hover/focus,
informativo.

### Engine

[`@radix-ui/react-popover`](https://www.radix-ui.com/primitives/docs/components/popover).

### Estilo

- Bg `ink-0`, border `ink-200`, `radius-lg` (8), `elev-3`.
- Padding interno default: `space-4` (16). Personalizable.
- Max-width 360px (default), max-height 480px con scroll interno.

### Animación

Igual a Tooltip pero `duration-slow` (320ms) y scale(0.96 → 1).

### Cuándo usar Popover vs Dropdown vs Dialog

| Caso                                              | Componente   |
| ------------------------------------------------- | ------------ |
| Lista de opciones de acción                       | Dropdown     |
| Mini-formulario o info expandible                 | Popover      |
| Decisión bloqueante, contexto modal               | Dialog       |
| Pánel auxiliar persistente                        | Drawer       |

---

## Dialog / Modal

### Engine

[`@radix-ui/react-dialog`](https://www.radix-ui.com/primitives/docs/components/dialog).

### Tamaños

| Size   | Max-width | Uso                                  |
| ------ | --------: | ------------------------------------ |
| `sm`   | 400px     | Confirmaciones                       |
| `md`   | 560px     | Formularios cortos, decisiones       |
| `lg`   | 720px     | Formularios largos, contenido rico   |
| `xl`   | 960px     | Vistas casi-fullscreen               |

### Anatomía

```
overlay (scrim)
content
  header
    title (h3) | close-button
    description? (sm, ink-600)
  body
  footer
    actions (secondary, primary)
```

### Estilo

- Overlay: bg `overlay-scrim`.
- Content: bg `ink-0`, `radius-xl` (12), `elev-4`.
- Padding: header `space-6 space-6 space-4`, body `space-6`, footer
  `space-4 space-6 space-6`.
- Footer actions: alineadas a la derecha, gap `space-2`.

### Animación

- Overlay: opacity 0→1, `duration-slow`.
- Content: opacity 0→1 + scale(0.96 → 1), `duration-slow`
  `ease-out`.

### A11y

- Focus se mueve al primer elemento focusable al abrir.
- Focus trap dentro del modal.
- Esc cierra.
- Click en overlay cierra (configurable; en formularios con cambios
  sin guardar, **no**).

### No-hacer

- No anidar modales. Si necesitás una decisión dentro de un modal,
  usar Popover o reemplazar el contenido del modal.
- No abrir modales automáticamente sin acción del usuario, salvo
  errores críticos.

---

## Drawer / Sheet

Panel lateral. Mismo Radix Dialog con animación lateral.

### Lados

- `right` (default) — para detalles, fuentes, edición
- `left` — para navegación auxiliar (raro)
- `bottom` — mobile: confirmaciones, formularios cortos

### Tamaños

| Size   | Ancho (right/left) | Alto (bottom)              |
| ------ | -----------------: | -------------------------- |
| `sm`   | 320px              | 30vh                       |
| `md`   | 440px              | 50vh                       |
| `lg`   | 560px              | 75vh                       |

### Anatomía / estilo

Mismo Dialog. Diferencias:

- Animación: translateX(100% → 0) right, translateY(100% → 0) bottom.
  `duration-slow` `ease-spring`.
- Radius: solo en esquinas internas (`right`: `top-left` y
  `bottom-left`).

### Caso de uso principal

**Source Drawer:** abierto cuando el usuario clickea una citation en
una respuesta. Muestra la fuente completa, snippet contextualizado,
link al documento original. Persiste mientras el usuario sigue
leyendo la respuesta.

---

## Toast

### Engine

[`sonner`](https://sonner.emilkowal.ski/). Renderiza en portal a
bottom-right (desktop), top-center (mobile).

### Variantes

`info`, `success`, `warning`, `danger`. Mismos tokens semánticos.

### Estilo

- Bg `ink-0` (light) / `ink-100` (dark)
- Border-left 4px del color semántico (`success-fg`, etc.)
- `radius-lg`, `elev-3`, padding `space-3 space-4`
- Font `sm`, icono 16px

### Timing

- Auto-dismiss después de 5s (info, success).
- Warning y danger: 7s, con botón close obligatorio.
- Acción opcional (un botón): "Deshacer", "Ver", etc.

### A11y

- `role="status"` para success/info, `role="alert"` para warning/danger.
- Pausa de auto-dismiss en hover/focus.

---

## Tabs

### Engine

[`@radix-ui/react-tabs`](https://www.radix-ui.com/primitives/docs/components/tabs).

### Variantes

| Variante      | Look                                                   | Uso                              |
| ------------- | ------------------------------------------------------ | -------------------------------- |
| `underline`   | Tabs con indicador inferior 2px `tinta-700`           | Default — navegación interna     |
| `pill`        | Pill bg `tinta-50` con texto `tinta-700` para activo  | Selectores compactos             |
| `segmented`   | Grupo con bg `ink-100`, activo bg `ink-0` + sombra     | Toggles tipo "Vista A / Vista B" |

### Estilo `underline` (default)

- Lista horizontal, gap `space-6`, border-bottom `ink-200`.
- Tab inactivo: `ink-600`, font `sm` weight 500.
- Tab hover: `ink-900`.
- Tab activo: `ink-1000`, border-bottom 2px `tinta-700`,
  offset -1px (compensar el border de la lista).
- Animación del indicador: opcional, `duration-base`. Si se anima, usar
  `translateX` no `width`.

### A11y

- Radix maneja `role="tablist"`, navegación con flechas (auto-activate
  o manual).

---

## Breadcrumb

```
Home > Categoría > Subcategoría > Página actual
```

- Separador: `/` o icono `chevron-right` 12px, color `ink-400`.
- Links activos: `ink-700`, underline al hover.
- Página actual (último): `ink-900`, sin link, weight 500.
- Font `sm`.
- En vistas largas, colapsar segmentos intermedios con `…` y popover
  al click.

---

## DropdownMenu

### Engine

[`@radix-ui/react-dropdown-menu`](https://www.radix-ui.com/primitives/docs/components/dropdown-menu).

### Anatomía

```
trigger
content
  group? (label?)
    item [ icon? ] label [ kbd? ]
    item ...
  separator
  submenu trigger?
    submenu content ...
```

### Estilo

Idéntico a Popover (mismo content). Items:

- Height 32px (default), padding-x 12.
- Hover: bg `ink-100`, color `ink-1000`.
- Disabled: opacity 0.45.
- Icon left: 16px, color `ink-600`.
- Kbd right: `kbd` component.
- Danger item: color `danger-fg`, hover bg `danger-bg`.

### A11y

- Radix maneja `role="menu"`, navegación con flechas, Enter, Esc.

---

## Command Palette

### Engine

[`cmdk`](https://cmdk.paco.me/) en un Dialog modal.

### Anatomía

```
dialog
  input (search)
  list
    group (label)
      item [ icon ] label [ shortcut ]
      item ...
    empty state
```

### Estilo

- Dialog `md` (560px), centrado vertical ~25vh from top.
- Input: borderless, `text-h5` size, padding `space-4 space-6`.
- Lista: max-height 60vh, scroll.
- Items: igual a DropdownMenu items pero un poco más altos (36px).
- Atajos visibles a la derecha de cada item.
- Group labels: `text-micro` color `ink-500`, tracking `+0.05em`,
  uppercase.

### Atajo

`cmd+k` (mac) / `ctrl+k` (win/linux). El atajo es **propiedad
exclusiva** del command palette. No usarlo para nada más.

---

## Skeleton

### Variantes

- `line` — para texto en carga (height = line-height de su contexto)
- `block` — para bloques rectangulares
- `circle` — para avatares

### Estilo

- Bg base `ink-100`.
- Shimmer: gradient lineal `ink-100 → ink-50 → ink-100`, animation
  shimmer 1.6s linear infinite.
- En dark: `ink-100 → ink-200 → ink-100`.
- Radius: hereda del contexto, o `radius-sm` por defecto.

### Reglas

- Mostrar skeleton solo si la carga es **> 200ms** esperada.
- Para cargas < 200ms, no mostrar nada (parpadeo molesta más que
  esperar).
- Skeleton debe tener la misma "forma" que el contenido final.
- No animar cambio skeleton → contenido. Reemplazo instantáneo.

---

## Spinner / Progress

### Spinner

- Default 16px, dentro de botón loading.
- Stroke 2, color `currentColor`.
- Animación: rotate 1s linear infinite.

### Progress (lineal)

- Height 4px (sm), 6px (md), 8px (lg).
- Bg track `ink-100`, fill `tinta-700`.
- `radius-full`.
- Estados:
  - Determinate: width = progress%.
  - Indeterminate: stripe 30% deslizándose, animation 1.4s.

---

## Accordion / Collapsible

### Engine

[`@radix-ui/react-accordion`](https://www.radix-ui.com/primitives/docs/components/accordion).

### Estilo

- Item: divider `ink-200` entre items.
- Trigger: padding `space-4 0`, font `sm` weight 500, chevron 16px
  derecha. Hover sin bg, solo color.
- Content: padding-top 0, padding-bottom `space-4`.
- Animación de altura: `duration-base` `ease-out`.

### Reglas

- Solo en contextos donde escondes contenido secundario (FAQ, filtros
  avanzados, settings). No para navegación principal.

---

## Separator

- Horizontal: 1px, color `ink-200`.
- Vertical: 1px, color `ink-200`, height variable.
- Para uso decorativo en hero o entre secciones grandes: 1px, color
  `ink-200`, con tracking visual (línea de 80% de ancho centrada).

---

## Avatar

### Tamaños

| Size   | Box   | Font (initials) |
| ------ | ----: | --------------- |
| `xs`   | 20px  | 10px            |
| `sm`   | 28px  | 12px            |
| `md`   | 36px  | 14px            |
| `lg`   | 48px  | 18px            |
| `xl`   | 64px  | 22px            |

### Estilo

- Radius `radius-full` por default; `radius-md` para "logos
  institucionales".
- Fallback (sin imagen): bg `ink-100`, color `ink-700`, initials 1-2
  chars.
- Ring opcional: 2px `ink-0` cuando se solapan (avatar group).

### Avatar group

Solapamiento -8px, máximo 4 visibles, `+N` indicator.

---

## Kbd

Componente para mostrar shortcuts (`Cmd+K`, `Esc`).

- Font `mono` 10.5px, weight 500.
- Bg `ink-100`, border `ink-200`, color `ink-700`.
- Padding `2px 6px`, radius `radius-sm`.
- Múltiples teclas: separar por `+` con espacio. Ej: `Cmd + K`.

---

# 2. Componentes de Dominio

Componentes que solo tienen sentido en este producto y le dan
identidad.

## PeriodBadge

Badge identitario de período histórico.

### Variantes

- `solid` — bg `period-*` 100%, texto `ink-0`. Para uso prominente en
  títulos de artifact.
- `subtle` (default) — bg `period-*` 12% alpha, texto `period-*`.
  Para listas, cards.
- `outline` — border 1px `period-*`, texto `period-*`. Para uso denso
  en timeline tooltips.

### Tamaños

- `xs` (timeline): 18px height, font micro, label corta (sigla "IND").
- `sm` (cards): 22px height, font xs, label corta o media.
- `md` (drawer): 26px height, font sm, label completa
  ("Independencia").

### Reglas

- Siempre incluye **texto**, no solo color. (Principio 6 de
  accesibilidad.)
- El icono opcional es un símbolo asociado al período (estilo
  glyphs minimalistas) — TBD en `iconography.md` futura.

### Ejemplo de uso

```
[ ☉ Prehispánico ]      ← bg period-pre subtle, icono opcional
[ Constitución 1991 ]   ← bg period-c91 subtle, sin icono
```

---

## CategoryChip

Chip de categoría temática. Similar a PeriodBadge pero:

- Radius `radius-full` siempre (chip, no badge).
- Subtle es default.
- En contextos densos (sidebar de filtros), pueden ser interactivos
  (toggles).

---

## Citation

El componente más identitario del producto.

### Anatomía

Inline en prosa:

```
…la Constitución de 1991 introdujo el concepto de Estado social[42].
```

`[42]` es la citation. Visual:

- Font mono, 0.75em del texto contenedor.
- Color `tinta-700` (light) / `tinta-400` (dark).
- Background `tinta-50` 60% alpha en hover, sutil.
- Padding `0 4px`, radius `radius-sm`.
- Cursor pointer.
- Vertical-align baseline o superscript de 0.3em (preferimos baseline
  con tamaño menor — más legible).

### Estado activo

Cuando el SourceDrawer muestra esta fuente, la citation tiene:

- Background `tinta-100`.
- Outline 1px `tinta-500`.

### Interacción

- **Hover desktop:** Popover aparece con preview de la fuente
  (título + snippet 200 chars + año + autor).
- **Click:** abre `SourceDrawer` con la fuente expandida + snippet en
  contexto + link al documento original.
- **Focus:** popover aparece igual que en hover.
- **Touch (mobile):** un tap muestra el popover; segundo tap navega.

### A11y

- `<button>` semántico (no `<span>`).
- `aria-label="Ver fuente 42"`.
- `aria-expanded` reflejando popover state.

---

## SourceCard

Card que representa una fuente bibliográfica.

### Anatomía

```
[ banda izquierda 4px color period? ]
  header
    [ source-type icon ] [ title (h5 serif) ]
    [ author · year · publisher ]   ← metadata, sm color ink-500
  snippet (body, italic optional, max 4 líneas)
  footer
    [ period-badge ] [ category-chip ] [ → ver documento ]
```

### Tipos de fuente (icon)

- Libro académico
- Artículo de revista
- Documento de archivo (manuscritos)
- Periódico
- Tesis
- Discurso/transcripción
- Mapa
- Imagen
- Audio/video

### Reglas

- Title: Newsreader semibold, `text-h5` (16).
- Snippet: Newsreader regular, `text-sm` (13) con line-height 1.5.
  Si tiene una cita textual del documento, comillas españolas + cursiva
  opcional.
- Card es clickable: hover sube elev, abre el SourceDrawer
  (no nuevo modal).

---

## ConversationBubble

Bubble de mensaje en chat.

### Variantes

- `user`: alineado a la derecha. Bg `ink-100` (light) / `ink-50` (dark).
  Padding `space-4 space-5`. Radius `radius-xl` con `bottom-right`
  reducido a `radius-md` (tail visual sutil sin "globo").
- `assistant`: full width, sin bg, sin radius. Es prosa pura sobre
  el fondo de página. La distinción visual con el user message es la
  posición y la ausencia de bubble.

### Anatomía assistant

```
[ avatar opcional pequeño ]
content (prose-academic full-width up to container-reading)
  prose with citations inline
[ footer: tools-row → copy, regenerate, sources count]
```

### Streaming

- Texto aparece en burst de palabras (no letra a letra).
- Caret titilante al final (`.stream-caret` ya existe en globals.css
  — conservar).
- Citations aparecen cuando el modelo las emite, integradas en flujo.

---

## ResearchHeader

Header de un research artifact (página de respuesta extendida).

### Anatomía

```
[ breadcrumb: Conversaciones › Esta conversación › Artifact ]
title  ← Newsreader, text-h1, ink-1000
subtitle  ← optional, sans, sm, ink-600
[ period-badge ] [ category-chips ] [ date · word-count ]
divider con monte-700 1px (acento editorial)
```

### Reglas

- Title puede ser largo (hasta 3 líneas). No truncar.
- Divider `monte-700` 1px ancho de container-reading (no full).
  Es el único uso prominente del acento secundario.

---

## ProseBlock

Container para prosa académica larga. Wrapper de
`.prose-academic` mejorado con:

- Padding vertical `space-12` (48px).
- Width `container-reading`.
- Tocs lateral (en lg+) sticky en `top: space-8`.
- Footnotes en columna lateral o expandibles inline (configurable).

---

## TimelineEvent / TimelineBand

### TimelineBand

Banda horizontal coloreada que representa un período histórico en una
visualización temporal.

- Color: `period-*` 35% alpha (light) / `period-*` 25% alpha (dark).
- Label encima o dentro: `text-micro` weight 500 color `period-*`.

### TimelineEvent

Punto/dot/card en un timeline.

- Tres densidades:
  - `dot` — solo punto 8px del color del período.
  - `pin` — punto + label inline al hover.
  - `card` — card compacta con titulo + año + descripción 1 línea.

---

## FactBadge

Chip especializado para mostrar un hecho histórico atómico.

```
[ icon 📅 ] [ 1991 ] [ Constitución promulgada ]
```

- Font Plex Sans, año en mono.
- Bg `ink-50`, border `ink-200`, radius `radius-md`.
- Hover: sube elev, abre popover con fuente.

---

## EntityChip

Chip para entidades nombradas (personas, lugares, instituciones).

### Variantes (por tipo)

| Tipo            | Icono              | Color subtle       |
| --------------- | ------------------ | ------------------ |
| Persona         | `user-circle`      | `category-soc`     |
| Lugar           | `map-pin`          | `category-ter`     |
| Institución     | `building-2`       | `category-ins`     |
| Evento          | `calendar`         | `category-his`     |

Click abre popover con bio/info corta + link a entidad completa.

---

# 3. Estrategia Dark Mode

### Filosofía (recap)

Dark mode no es invertir light. Es un par diseñado. Cada componente
debe verse igual de "intencional" en ambos.

### Implementación técnica

1. **Estrategia de clase:** `class="dark"` en `<html>`. Tailwind config
   con `darkMode: 'class'`.
2. **Persistencia:** `next-themes` con `storageKey: "crónica-theme"`.
3. **Sin flash (FOUC):** `next-themes` ya maneja inyección de script
   sincrónico en `<head>`. Mantener.
4. **Tokens duales:** cada CSS variable se define dos veces
   (`:root` y `.dark`). Ver [implementation.md](./implementation.md).
5. **Tres modos:** `light`, `dark`, `system` (default). El system mode
   sigue `prefers-color-scheme`.

### Toggle

Componente `<ThemeToggle>` en el header. Tres estados visuales:

- Sol (light)
- Luna (dark)
- Monitor (system)

Cycle order: light → dark → system → light…

Animación al cambiar: 220ms cross-fade del root background + color.
No transform.

### Componentes que requieren atención especial en dark

| Componente              | Cuidado                                                    |
| ----------------------- | ---------------------------------------------------------- |
| Tooltip                 | Invertir esquema (bg claro, texto oscuro)                  |
| Charts (timeline, graph)| Period colors aclarados, grid lines `ink-200`             |
| Source snippet          | Italic con color `ink-700`, no `ink-500` (más legible)     |
| Code blocks             | Tema syntax oscuro propio (no Prism light en dark)         |
| Images embebidas        | Outline 1px `ink-200` para que no "floten"                 |
| Selección de texto      | `tinta-300` 35% alpha (más visible que en light)           |
| Focus ring              | `tinta-400` (más claro) para contraste contra bg oscuro    |

### Pruebas obligatorias

Cualquier componente nuevo se verifica en:

1. Light + tamaño desktop
2. Light + tamaño mobile
3. Dark + tamaño desktop
4. Dark + tamaño mobile
5. Light + `prefers-reduced-motion`
6. Dark + zoom 200%

Sin estas 6 vistas verificadas, no se merge.

---

# 4. Anti-patrones de componentes

Cosas que **explícitamente no hacemos**, aunque sean comunes en otras
apps.

- **No ilustraciones humanoides amigables** (estilo "blob people").
  Empty states usan iconografía abstracta o, mejor, una frase editorial
  corta.
- **No degradados decorativos** en cards, headers, fondos.
- **No glassmorphism** salvo en el caso *muy* específico de la barra de
  command palette flotando sobre contenido.
- **No emojis en UI** (sí en contenido del usuario o respuestas de la
  IA, no en labels de la app).
- **No animaciones "delightful"** que no aporten información (confetti,
  micro-interacciones decorativas).
- **No skeletons que duren más de 2 segundos** sin algún indicador
  adicional de progreso real.
- **No tooltips para etiquetar botones con label.** El label visible
  siempre gana.
- **No "ghost" inputs** sin border y sin background. Confunden.
- **No tags con remove button en contextos no-removibles**. Si no se
  puede borrar, es Badge, no Chip.
