# Patterns

Patrones de página: cómo se componen los componentes en layouts
completos. Esto define la *experiencia*, no solo los building blocks.

Cada patrón declara: estructura, layout responsive, comportamiento
clave, y reglas de coherencia con el resto del sistema.

---

## App Shell

El esqueleto de toda la app autenticada.

### Estructura

```
┌─────────────────────────────────────────────────┐
│ TopBar (64px)                                   │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ Sidebar  │  Main content (router outlet)        │
│ (240px)  │                                      │
│          │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

### TopBar

- Altura `64px` (token `header-h`).
- Bg `ink-0`, border-bottom 1px `ink-200`.
- Contenido (left → right):
  - Logo / wordmark "Archivo Histórico" (Newsreader semibold)
  - Search trigger (`cmd+k` hint en kbd) — clickable, abre command
    palette
  - Spacer flexible
  - Notifications (icon button con badge si hay nuevas)
  - Theme toggle
  - User menu (avatar + dropdown)

### Sidebar

- Ancho 240px expanded, 64px collapsed. Toggle persistido en
  localStorage.
- Bg `ink-25`, border-right 1px `ink-200`.
- Contenido:
  - **Nuevo (botón primary)** — "Nueva investigación", icon `+`
  - **Navegación principal**:
    - Inicio
    - Conversaciones
    - Líneas de tiempo
    - Mapa
    - Fuentes
    - Notas
  - **Períodos** (expandable section): lista con PeriodBadge xs
  - **Recientes** (últimas 5 conversaciones)
  - **Footer:** Ajustes, Ayuda
- Item activo: bg `tinta-50`, color `tinta-700`, border-left 2px
  `tinta-700`.
- Item hover: bg `ink-100`.

### Main

- Padding según patrón de página específico.
- Background `ink-0`.
- Scroll vertical interno (TopBar y Sidebar fijos).

### Responsive

- `≥ lg (1024px)`: layout completo descrito arriba.
- `md (768–1023px)`: Sidebar siempre colapsada (64px).
- `< md`: Sidebar se vuelve drawer overlay (cerrada por default),
  triggerable desde botón hamburguesa en TopBar.

---

## Dashboard (Home)

La primera vista cuando el usuario abre la app.

### Objetivo

Mostrar de un vistazo: cómo seguir investigando lo que estaba haciendo
+ qué explorar nuevo.

### Estructura

```
container-page (1080px)

  Hero (space-12 top)
    h1: "Buenas tardes" — saludo personalizado
    sub: "¿Qué te interesa investigar hoy?"
    SearchBar grande (auto-focus opcional)

  Section: Continuar
    h3 + Tag count
    Grid 3-col: ConversationCard (snippet de conversación + lastUpdated)

  Section: Explora por período
    h3
    Grid de PeriodBadge md (16 períodos, distribuidos en filas)
    Click → vista de período

  Section: Lectura sugerida
    h3
    Lista vertical: ResearchArtifact cards (cards lg con title serif,
                  excerpt 2 líneas, period+category badges, autor)

  Section: Stats (opcional, deshabitable)
    h3
    Sparklines: actividad últimos 30 días, fuentes consultadas,
                períodos más explorados
```

### Reglas

- Sin "widgets configurables". La estructura es fija; solo el
  contenido cambia.
- El hero ocupa máximo 320px de alto.
- Stats al final, no al inicio. La actividad importa, pero no es lo
  primero que ve un investigador.

---

## Conversation View

La vista principal de uso: chat con el asistente.

### Layouts

**Layout A — Chat full width (default)**

```
container-prose (760px) centrado

  ConversationBubble (user)
  ConversationBubble (assistant)
    inline citations [1] [2]
    sources count footer
  ...
  InputBar (sticky bottom)
```

**Layout B — Chat + Sources Drawer**

Cuando el usuario clickea una Citation:

```
chat (container-prose centrado, 760px)
                                          [ SourceDrawer (440px) ]
                                          [ source content        ]
                                          [ ...                    ]
```

Chat se desplaza hacia la izquierda; SourceDrawer ocupa derecha.
Persistente mientras el usuario lee. Cerrar con `×` o `Esc`.

### Input bar

- Sticky en `bottom: 0`, dentro del container.
- Padding `space-3 space-4`.
- Bg `ink-0` con border-top 1px `ink-200`.
- Componentes:
  - Textarea auto-grow (max 200px), Newsreader 17px, ancho 100%.
  - Botones a la derecha: attach (icon), period filter (chip
    opcional), send (primary button).
  - Toolbar arriba opcional: "Pregunta sobre..." quick filters
    (período, categoría, tipo de fuente).

### Streaming

- Assistant bubble aparece vacío con caret titilante.
- Texto rellena en bursts de palabras.
- Citations aparecen integradas (no al final).
- Auto-scroll al fondo solo si el usuario ya estaba ahí. Si el
  usuario scrolleó arriba, no robar foco; mostrar pill "↓ Nueva
  respuesta" arriba para que pueda volver al fondo manualmente.

### Comportamiento

- Conversación es lista vertical infinita. Scroll inverso (más nuevo
  abajo).
- User bubble alineado derecha, max-width 600px, bg `ink-100`.
- Assistant respuesta full width, sin bubble.
- Cada bubble assistant tiene footer con acciones:
  copiar, regenerar, marcar como notas, "N fuentes →" (abre
  SourceDrawer con todas).

---

## Reading View (Research Artifact)

Vista de un artefacto de investigación: una respuesta larga
"editorializada", con TOC, footnotes, formato editorial completo.

### Estructura

```
TopBar app shell

container-reading (680px) centrada

  ResearchHeader
    Breadcrumb
    title h1 (Newsreader, hasta 3 líneas)
    subtitle (sans, body, ink-600)
    [ PeriodBadge md ] [ CategoryChip ] [ date · words · sources ]
    divider monte-700

  ProseBlock
    prose-academic completa
    h2/h3 internos
    citations inline
    blockquotes
    imágenes con caption (caption Newsreader italic, sm, ink-600)

  Footer del artifact
    "Fuentes consultadas (N)"
    SourceList (cards verticales)
    divider
    "Conversación origen → [link]"

TOC lateral (sticky en lg+)
  - Posicionado a la derecha del container-reading
  - Ancho 220px, lista de h2/h3 con active state según scroll
  - Font sm, color ink-600, active ink-1000 + border-left tinta-700
```

### Responsive

- `≥ xl`: TOC visible a la derecha.
- `lg, md`: TOC accesible por botón flotante que abre Popover.
- `< md`: sin TOC, breadcrumb compacto.

### Reglas

- Sin sidebar de app shell en esta vista. El Reading View tiene
  TopBar simple (logo + close button + share button) y main full.
  Es una vista contemplativa.
- Modo "lectura sin distracciones": botón en TopBar oculta también
  TopBar (solo close + share quedan flotantes con bg blur).

---

## Timeline View

Visualización temporal de eventos, fuentes, períodos.

### Estructura

```
container-canvas (full width)

  Header (space-8 padding-x)
    h2: "Línea de tiempo"
    Filtros (chips removibles): período, categoría, rango
    View toggle: [ Compacta | Detallada | Densa ]
    Search inline

  Timeline canvas (~600px alto)
    Eje horizontal: años
    Bandas de fondo: TimelineBand por período
    Eventos: TimelineEvent
      - Density "compacta" → solo dots
      - Density "detallada" → pins con labels al hover
      - Density "densa" → cards al pasar
    Mini-map abajo (overview navegable)

  Detail Drawer (al click en evento)
    SourceCard expandida
    "Contexto: este evento y los 3 cercanos en el tiempo"
```

### Reglas

- Eje X: años. Si rango > 200 años, escala logarítmica opcional.
- Bandas (períodos) siempre visibles como contexto cromático,
  incluso filtrando eventos.
- Densidad de eventos: nunca más de 1 evento cada 8px horizontales.
  Si hay overlap, agrupar en un cluster que expande al click.

### Performance

- Timeline es la vista más cara visualmente. Lazy-load eventos por
  viewport. Virtualizar si > 500 eventos.
- Sin animaciones decorativas en scroll. Pan/zoom con cursor o teclado
  (`←/→` para pan, `+/-` para zoom).

---

## Graph View

Visualización en grafo: entidades (personas, lugares, eventos,
documentos) conectadas por relaciones.

### Estructura

```
container-canvas

  Header
    h2: "Grafo de relaciones"
    Filtros: tipo de entidad, período, profundidad de relación
    Layout toggle: [ Fuerza | Jerárquico | Cronológico ]

  Canvas
    Nodos: avatares según tipo de entidad
      - Persona: círculo con initials
      - Lugar: pin geo-shape
      - Documento: cuadro
      - Evento: rombo
      Color del borde: period del que pertenece.
    Aristas: líneas finas ink-300, weight según relación strength.
    Nodos seleccionados: ring tinta-500, glow sutil.

  Panel lateral (derecha, ancho 360)
    Entidad seleccionada
      - Bio/info
      - Conexiones (lista con counts)
      - "Ir a vista de entidad"
```

### Reglas

- Layout default: fuerza dirigida (force-directed). Estabilizar
  rápido (<2s) en grafos < 200 nodos.
- Click en nodo → panel derecho actualiza. Doble-click → vista de
  entidad completa.
- Zoom min 0.3x, max 3x.

---

## Search Results

Cuando el usuario busca desde TopBar o desde una vista filtrada.

### Estructura

```
container-page

  Header
    h2: "Resultados para «{query}»"
    [N resultados · M conversaciones · K fuentes · J entidades]
    Filtros sticky (tipos, períodos, categorías, fechas)

  Tabs
    Todo | Conversaciones | Fuentes | Entidades | Líneas de tiempo

  Result list
    Cada result-card según tipo:
      - Conversación: snippet de inicio + última actividad
      - Fuente: SourceCard
      - Entidad: EntityCard con conteo de relaciones
      - Timeline: nombre + rango temporal + cluster preview
    Highlights del query: bg warning-bg sutil, color warning-fg.

  Pagination o "Cargar más"
```

### Comportamiento

- Búsqueda full-text con highlight contextual de snippets.
- Empty: ver § Empty States.
- Filtros aplicados se muestran como chips removibles arriba de la
  lista.

---

## Empty States

Estados sin contenido.

### Anatomía

```
                  [ icono abstracto 64px, ink-400 ]

                       Título h4 ink-900
              Descripción sm ink-600 (max 2 líneas)

                    [ CTA primary opcional ]
```

### Reglas

- **Icono:** Lucide simple, no ilustración. Color `ink-400`. Cuando
  hay error, color `danger-fg` 50% alpha.
- **Título:** una línea, voz directa. NO preguntas (ej. "Sin
  resultados" sí; "¿No encontraste nada?" no).
- **Descripción:** una o dos frases. Editorial, no infantil.
  Ej: "Esta conversación todavía no tiene mensajes. Empieza
  preguntando por un período o una persona."
- **CTA:** opcional. Solo si hay una acción clara *única* que el
  usuario podría tomar.

### Variantes por contexto

- **Lista vacía (primera vez):** título + descripción + CTA crear.
- **Búsqueda sin resultados:** título "Sin resultados" + sugerencia
  ("Probá con menos filtros") + acción "Limpiar filtros".
- **Error de red:** título "No pudimos cargar esto" + descripción
  "Revisá la conexión y reintentá" + botón "Reintentar".
- **Acceso denegado:** título + descripción + link a soporte.
- **404:** título "Esta página no existe" + link "Volver al inicio".

### Anti-patrones

- ❌ "Oops! 😅 ¡Algo salió mal!"
- ❌ Ilustración de astronauta flotando
- ❌ Botones secundarios múltiples ("Volver" + "Reintentar" + "Reportar")

---

## Mobile Layouts

`< 640px` (`< sm`).

### Cambios estructurales

- App Shell: Sidebar → hamburguesa que abre drawer (`left`, `md`
  size).
- TopBar: hamburguesa + logo compacto + search icon button + theme
  toggle + user.
- Search no muestra el input en TopBar; ese tap abre el command
  palette en mobile como sheet bottom.
- Dashboard: cards en columna única, padding `space-4`.
- Conversation: input bar más alto (44px send button). Citations
  abren SourceDrawer como sheet bottom (no side).
- Reading View: TOC oculto, breadcrumb compacto, padding lateral
  `space-4`.
- Timeline / Graph: en mobile son **view-only**. Pan + zoom funcionan,
  pero edición compleja redirige a tablet/desktop con mensaje
  amable.

### Touch targets

Todos los elementos interactivos tienen un área de toque mínima de
**44×44px** (recomendación WCAG 2.5.5). Para iconos pequeños (16px),
agregar padding invisible.

---

## Settings

Página de configuración.

### Estructura

```
container-page

  h1: Ajustes
  Tabs: [ Cuenta · Apariencia · Datos · Atajos · Acerca de ]

  Tab content:
    Section: subtitle + descripción
      Setting row:
        label + helper text (left)
        control (right): Switch / Select / etc.
    Section: ...
```

### Pestañas mínimas

- **Cuenta:** email, nombre, idioma (es/en).
- **Apariencia:** tema (light/dark/system), tamaño de texto, densidad.
- **Datos:** exportar, importar, borrar.
- **Atajos:** lista de keyboard shortcuts (search dialog dedicado).
- **Acerca de:** versión, créditos, link a documentación.

---

## Coherencia entre patrones

Reglas que aplican a TODOS los patrones:

1. **Una sola acción primaria por vista.** Si hay dos botones
   "primarios", uno se vuelve secondary.
2. **Breadcrumb cuando hay profundidad > 1.** Sin breadcrumb en
   dashboards o vistas raíz.
3. **Loading state explícito** para cualquier vista cuya carga supere
   200ms.
4. **Estado vacío contemplado** desde el diseño, no como afterthought.
5. **Sin scroll horizontal** salvo en visualizaciones explícitamente
   horizontales (timeline, grafo).
6. **Padding lateral coherente:** `space-8` (32) en desktop,
   `space-4` (16) en mobile. Excepción: full canvas views.
7. **El ancho de lectura siempre se respeta.** Si un patrón contiene
   prosa, se centra en `container-reading` aunque el resto sea más
   ancho.
