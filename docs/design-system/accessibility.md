# Accessibility

Esta no es una sección "agregada al final". La accesibilidad es un
requisito **de diseño**, no de implementación.

Cualquier componente que no cumpla estas reglas no se merge. Las
reglas son prescriptivas: si parece que un caso justifica una
excepción, casi siempre es porque el diseño está mal y necesita
reformularse, no porque la regla deba flexibilizarse.

---

## Contraste

### Mínimos

Según WCAG 2.1 nivel **AA** (mínimo) y **AAA** en lectura larga:

| Caso                              | AA contrast | AAA contrast |
| --------------------------------- | ----------- | ------------ |
| Texto < 18px regular              | 4.5:1       | 7:1          |
| Texto ≥ 18px o ≥ 14px bold        | 3:1         | 4.5:1        |
| Componentes UI (bordes, iconos)   | 3:1         | —            |
| Estados (focus ring vs bg)        | 3:1         | —            |

### Aplicación a tokens

- `ink-1000` sobre `ink-0` (light): contrast >= 18:1 ✓ AAA
- `ink-900` sobre `ink-0`: 14:1 ✓ AAA — texto principal
- `ink-700` sobre `ink-0`: 9:1 ✓ AAA — texto secundario
- `ink-600` sobre `ink-0`: 6.5:1 ✓ AAA — texto secundario fuerte
- `ink-500` sobre `ink-0`: 4.6:1 ✓ AA — captions, **límite**
- `ink-400` sobre `ink-0`: 3.0:1 — solo para iconos disabled o
  decorativos
- `tinta-700` (`#1E3A5F`) sobre `ink-0`: 11:1 ✓ AAA
- `tinta-700` sobre `tinta-50`: 9:1 ✓ AAA — link sobre bg accent

### Period colors en dark mode

Los `period-*` ajustados para dark están calculados para mantener AA
sobre `ink-0` dark (`#0A0B0D`). Cualquier modificación al período
debe re-validar contrast.

### Test obligatorio

Antes de cualquier merge:

1. Verificar contrast con DevTools (Lighthouse → Accessibility).
2. Probar con extensiones tipo Stark o WAVE.
3. Si el texto va sobre un color de período, **siempre** validar manual.

---

## Foco visible

### Regla cero

**Nunca remover el outline.** Lo estilizamos, no lo borramos.

### Estilo del focus ring

- 2px sólido de color `tinta-300` (light) / `tinta-400` (dark)
- offset 2px desde el elemento
- radius hereda del elemento + 2px

### `:focus` vs `:focus-visible`

- Usar `:focus-visible` para mostrar el ring **solo en navegación por
  teclado**. Click con mouse no muestra ring (evita ruido visual).
- Excepción: inputs (`<input>`, `<textarea>`, `<select>`) muestran
  el ring también en `:focus` (con o sin teclado), porque el usuario
  necesita saber "estoy escribiendo aquí".

### Componentes especiales

- **Buttons en card clickable:** el card es el target focusable. Los
  buttons internos del card también son focusables, pero el ring del
  card no compite con el ring del button (jerarquía: outer primero,
  inner después).
- **Lists con keyboard navigation** (combobox, menus): roving
  `tabIndex`. Solo el item activo es Tab-able; las flechas mueven el
  foco entre items.

---

## Keyboard

### Navegación general

| Tecla         | Acción                                                |
| ------------- | ----------------------------------------------------- |
| `Tab`         | Mover al siguiente focusable                          |
| `Shift+Tab`   | Mover al anterior                                     |
| `Enter`       | Activar (botones, links)                              |
| `Space`       | Activar buttons, toggle checkboxes/switches            |
| `Esc`         | Cerrar modal, popover, drawer, command palette        |
| `Arrow keys`  | Navegar dentro de listas (menu, combobox, tabs)       |
| `Home/End`    | Primer/último de la lista                             |

### Shortcuts globales

| Shortcut         | Acción                                              |
| ---------------- | --------------------------------------------------- |
| `Cmd/Ctrl + K`   | Abrir Command Palette                               |
| `Cmd/Ctrl + N`   | Nueva conversación                                  |
| `Cmd/Ctrl + /`   | Mostrar diálogo de shortcuts                        |
| `Cmd/Ctrl + B`   | Toggle sidebar                                      |
| `Cmd/Ctrl + J`   | Toggle theme                                        |
| `g + h`          | Ir a Home                                           |
| `g + c`          | Ir a Conversaciones                                 |
| `g + t`          | Ir a Línea de tiempo                                |
| `/`              | Foco al search                                      |
| `?`              | Abrir help                                          |

### Reglas

- Ningún shortcut intercepta combinaciones del sistema operativo
  (`Cmd+W`, `Cmd+T`, `Cmd+R`, etc.).
- Shortcuts mostrados visualmente en menus, command palette y dialog
  de ayuda. Nunca shortcut "secreto".
- `Esc` siempre cierra el overlay más reciente. Layering: tooltip <
  popover < dropdown < drawer < dialog.

### Focus trap

Aplica en: Dialog, Drawer, Command Palette.

- Al abrir: focus se mueve al primer elemento focusable (o al
  `autoFocus` declarado).
- Tab dentro del overlay nunca sale.
- Al cerrar: focus vuelve al elemento que abrió el overlay.

---

## Screen readers

### Roles ARIA

- Usar elementos semánticos primero (`<button>`, `<nav>`, `<article>`,
  `<aside>`, `<main>`, `<header>`, `<footer>`). ARIA solo cuando no
  hay equivalente HTML.
- Radix maneja los roles correctos en componentes (`role="dialog"`,
  `role="menu"`, etc.). No reasignar.

### Landmarks

Cada vista declara:

- `<header>` (TopBar)
- `<nav aria-label="Principal">` (Sidebar)
- `<main>` (contenido)
- `<aside aria-label="Fuentes">` cuando hay SourceDrawer abierto

### Etiquetas

- Iconos solos: `aria-label="Acción"`.
- Botón con icono + label: `aria-hidden="true"` en el icono.
- Inputs: `<label>` asociado con `htmlFor`/`id`. No `placeholder` como
  label.
- Imágenes decorativas: `alt=""`. Imágenes informativas: alt
  descriptivo.
- Avatares con initials: `aria-label="Avatar de {nombre}"`.

### Live regions

- **Toasts:** `role="status"` para success/info, `role="alert"` para
  warning/danger.
- **Streaming response:** `aria-live="polite"` en el container del
  bubble assistant. NO `assertive` (sería invasivo).
- **Loading states:** `aria-busy="true"` en el contenedor de la zona
  cargando.

### Texto oculto pero leído

Cuando un componente tiene contexto visual que un screen reader pierde
(ej. icono que indica "expandir"), usar:

```
<span class="sr-only">Expandir sección</span>
```

`.sr-only`: clase Tailwind built-in, oculta visualmente pero accesible
a screen readers.

---

## Color y significado

**El color nunca es el único portador de información.**

### Aplicación

- **PeriodBadge** siempre tiene label de texto, no solo color.
- **Estados de validación:** error tiene texto + color + icono.
- **Charts (timeline, graph):** además de color, formas distintas o
  patterns para distinguir.
- **Links:** además de color (`tinta-700`), siempre `underline`.

### Daltonismo

Las paletas se chequearon contra simuladores de deuteranopia y
protanopia (más comunes). Los `period-*` mantienen distinciones
suficientes con luminancia, no solo hue. En charts complejos, agregar
patrones secundarios.

---

## Motion

### `prefers-reduced-motion`

Cuando el usuario tiene `prefers-reduced-motion: reduce`:

- Todas las duraciones bajan a 50–80ms (lo mínimo perceptible).
- Transformaciones (translate, scale, rotate) se reemplazan por
  opacity-only.
- Animaciones decorativas (shimmer, caret blink) **se mantienen**
  porque transmiten información de estado (cargando, escribiendo).
- Animaciones de overlay (dialog, drawer) se vuelven instantáneas.

### Aplicación CSS

```
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  /* Excepciones para feedback de estado: */
  .shimmer, .stream-caret { animation-duration: revert !important; }
}
```

---

## Tamaños y zoom

### Zoom de navegador

La app debe ser usable hasta **zoom 200%** sin scroll horizontal en
viewports comunes.

- Layouts: usar `rem` para padding y márgenes (heredan del root
  font-size).
- Containers: `max-width` en px es OK; al 200% el contenido sigue
  cabiendo.
- Sidebar: en zoom alto se vuelve drawer.

### Touch targets

Mínimo **44×44px** (recomendación WCAG 2.5.5).

- IconButton `sm` (28px) debe vivir dentro de un contenedor con
  padding extendido, para que el área de toque efectiva sea 44px.
- En mobile, todos los IconButton son `md` (32px) con 6px padding =
  44px efectivo.

---

## Internacionalización (l10n)

Aunque arrancamos en español, el sistema debe ser i18n-ready.

### Texto

- Todo el copy de UI viene de un dictionary, no hardcoded.
- No concatenar strings. Usar interpolación con placeholders.
- Pluralización: usar la API estándar de i18n (ICU MessageFormat).

### Layout

- Usar `gap`, `margin-inline-start/end`, `padding-inline-*` (lógicos)
  en lugar de `left/right` para soportar RTL en el futuro.
- No asumir longitud de palabras. Probar con strings 40% más largos
  (alemán) y muy cortos.

### Fechas y números

- Fechas: ISO en datos, formato local en UI (`Intl.DateTimeFormat`).
- Números: `Intl.NumberFormat` con `es-CO` locale.
- Años históricos: 4 dígitos, "a.C." después del número si BC.

---

## Tooltips: lo que no son

Recordatorio porque es donde más se rompe la accesibilidad:

- **Tooltips no son labels.** Si un botón solo tiene icono, su
  `aria-label` lo identifica. El tooltip lo *complementa*, no lo
  reemplaza.
- **Tooltips no funcionan en touch.** Cualquier información esencial
  debe estar en otro lugar. Tooltip es bonus desktop.
- **Tooltips deben aparecer en focus.** Hover-only es accesibilidad
  rota. Radix lo maneja correctamente — no romperlo.

---

## Checklist por componente

Pasos a verificar antes de declarar un componente "listo":

- [ ] Cumple contrast AA en light y dark.
- [ ] Es navegable solo con teclado.
- [ ] Tiene focus visible en `:focus-visible`.
- [ ] Está etiquetado para screen readers.
- [ ] Funciona en zoom 200%.
- [ ] Funciona con `prefers-reduced-motion`.
- [ ] Si tiene color como señal, también tiene texto/icono.
- [ ] Touch targets son ≥44px en mobile.
- [ ] No depende solo de hover/tooltip para información esencial.

---

## Recursos

Para implementadores: tener instalado y usar regularmente.

- **Lighthouse** (Chrome DevTools): auditoría accessibility automática.
- **axe DevTools** (extensión): detección manual y por componente.
- **Stark** (Figma plugin o extensión): contrast checks rápidos.
- **VoiceOver** (Mac, gratis): probar navegación screen reader.
- **NVDA** (Windows, gratis): screen reader más usado.
