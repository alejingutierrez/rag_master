# Auditoría UX/UI · Archivo Histórico Digital

> Recorrido página por página. Por cada vista: **20 mejoras visuales**, **20 ajustes funcionales** y **10 cambios de experiencia**.
>
> Fecha: 2026‑05‑23 · Branch: `main` · App Next 16 + Ant Design 6 + Prisma + Cohere v4 + Claude Opus 4.7.

---

## Hallazgos transversales (shell, theming, layout)

Estos problemas afectan a **todas** las páginas. Antes de listar página por página, conviene corregirlos arriba porque resuelven decenas de issues "duplicados" más abajo.

### Visuales (20)
1. **Sider con `position: sticky` sin scroll propio fluido**: cuando el contenido del menú supera 100vh queda inaccesible (en pantalla baja la categoría "Exploración" desaparece). `overflowX: hidden` corta también el indicador de selección.
2. **`AppShell` mezcla 14 iconos del paquete antd duplicados** (e.g. `BookOutlined` se usa para Preguntas y Bibliografía). No hay coherencia: `NodeIndexOutlined` aparece para Hilos y para Grafo.
3. **Header con `backdrop-filter: blur(8px)`** y fondo `rgba(14,14,17,0.85)` produce "smear" sobre tablas/cards al hacer scroll en macOS — el blur es demasiado bajo y se nota mucho ruido cromático.
4. **Logo "A" gradiente violeta** queda fuera de paleta cuando el usuario está en tema claro (sigue siendo indigo→light‑indigo). Falta un mark con personalidad académica.
5. **Tipografía**: tres familias (Inter, Source Serif 4, JetBrains Mono) se cargan pero solo se nota el serif en `.serif-title` y `.prose-academic`. El resto usa Inter genérico.
6. **`fontSize: 14`** como base es correcto en desktop, pero `fontSizeHeading1: 30` se ve pequeño junto a `serif-title` que ya viene del CSS global con 28/22/18. El H1 del dashboard es 32 inline. Inconsistencia.
7. **Cards** usan tres densidades a la vez (`size="small"`, `padding: 12`, `padding: 18`, `padding: 14`) sin sistema claro. Hay grid de cards con padding inconsistente entre Home y Documentos.
8. **Border radius mezclados**: tokens dicen 8/12/6 pero hay hardcodes en `borderRadius: 16` (empty state chat), 10 (action cards), 4 (timeline). No hay escala respetada.
9. **Color violeta usado como acento "intelectual"** se hace plano en dark mode: `#A855F7` para producciones, `#6366F1` para primary, `#7C3AED` en período CNA. Tres violetas casi idénticos compiten.
10. **Sombras**: `boxShadowSecondary` solo se aplica en pop‑ups; las cards en dark mode pierden profundidad por completo (todo flota sobre el mismo plano).
11. **El selected del menú** en light usa `#EEF2FF` con texto `#4338CA` — bien — pero en dark mode usa `rgba(99,102,241,0.16)` con texto `#A5B4FC`, demasiado lavado contra `#0B0B0E`. Hace difícil saber qué está seleccionado.
12. **Breadcrumb tipográfico**: 13px, sin separación visual respecto al título de la página. En pantallas con título grande compite y se confunde.
13. **Iconos del menú a 18px** y el avatar A a 32x32 generan jerarquía rara (el icono pesa más que el título cuando se hace collapse).
14. **Searchbar del sider** parece input pero es un Button con prefix de SearchOutlined, lo que rompe la affordance. El kbd `⌘K` queda apretado contra el borde.
15. **Collapse del sider**: al pasar a 68px de ancho, los `Menu.Item` mantienen padding lateral grande y los iconos no quedan centrados.
16. **Tema "Sistema" en el dropdown** muestra `LaptopOutlined` para auto pero no indica qué resolvió ni hay tooltip explicativo.
17. **Layout `headerPadding: "0 24px"`** en theme pero el header inline tiene `padding: "0 20px"`. Doble verdad.
18. **El contenido `.app-page`** tiene `max-width: 1440`, `app-page-wide: 1680`, `app-page-narrow: 980`. En monitores 4K las cards quedan apiladas a la izquierda; falta un wrapper centrado real.
19. **Mobile (`@media max-width: 768`)** sólo reduce padding a 16px pero no colapsa el sider — en móvil aparece sider de 244px ocupando el 65% del viewport, ilegible.
20. **No hay focus visible** consistente (`:focus-visible` outline) en links/buttons — sólo el ring por defecto de antd, que en dark se vuelve invisible.

### Funcionales (20)
1. **Header `position: sticky` se ve fallido al hacer scroll**: en mi prueba quedó alineado al fondo (probable conflicto con `flex-direction: column` del Layout y el inner sticky). El backdrop‑blur empeora la sensación.
2. **El estado de `collapsed` se rehidrata en `useEffect`** después del primer render → en SSR sale expandido y luego salta a collapsed (CLS visible).
3. **El tema se inicializa con `auto` y `resolveTheme` corre en cliente** → al hidratar suele haber un flash de tema cambiado (de momento `data-theme="dark"` está hardcodeado en `<html>` pero la lógica puede resolver a "light").
4. **`STATIC_ITEMS` del command‑palette** tiene un item "Sistema de hipótesis" que no coincide con el label del sider ("Hipótesis") — confusión al buscar.
5. **`/api/search/global`** se llama con debounce de 200ms pero también se llama al abrir el palette con query="" produciendo un fetch innecesario en cada open.
6. **El input del palette** abre y se enfoca con `setTimeout 50ms`, en un ssr re‑render puede perder foco. Hay reportes de "Cmd+K no enfoca" típicos.
7. **`selectedKey` del menú**: el cálculo escoge la ruta más larga primero, pero `/questions/matriz` y `/questions/generate` no están en `PRIMARY_NAV.children` → no se resaltan nunca en el sider (sólo "Preguntas").
8. **`ROUTE_LABELS`** no contiene rutas dinámicas (`/documents/[id]`, `/threads/[id]`, etc.) → el breadcrumb muestra el `id` truncado a 12 caracteres ("e4a1c2b9d83…"), inútil.
9. **`CommandPalette` no marca la opción "Documentos" cuando el usuario ya está en /documents** ni desactiva entradas correspondientes a la ruta actual.
10. **El listener `Cmd+K`** se registra una vez en `useEffect([], ...)` con la función `setPaletteOpen((v)=>!v)`. En MacOS Safari/Chrome funciona, pero no detecta `Ctrl+K` en Windows si el shift modifier está activo.
11. **`localStorage.getItem("rag-master-sider-collapsed")`** se lee en useEffect, no en useState inicial; ningún try/catch protege contra storage bloqueado (Safari ITP).
12. **El theme provider** no expone "system" como modo real — al hacer match con `matchMedia` no actualiza el `data-theme` para `mode==='auto'`.
13. **Globals.css** no resetea margin/padding en `h1..h6`, así el `.serif-title` hereda margins de antd y aparece con espacio raro arriba en algunas vistas.
14. **`AntdRegistry` + `ConfigProvider` con `hashed: false`** dejan rules globales que pueden chocar con tu `globals.css` (`a { color: inherit }`) — los Links del menú pierden el color subrayado del tema.
15. **El Search del sider** está duplicado funcionalmente con el icono SearchOutlined del header — ambos hacen lo mismo y no hay indicación de cuál usar.
16. **Sin shortcut `?`/`Cmd+/`** para abrir help/keyboard cheatsheet (estándar en Linear, Notion).
17. **El Dropdown del tema** se cierra al elegir, pero no muestra check visual de qué modo está activo (`selectedKeys` está, pero antd no lo refleja en items sin variant).
18. **Sin avatar/iniciales de usuario**, no hay menú de cuenta — la app parece single‑user pero no lo indica.
19. **No hay healthcheck visible**: el `/api/health` existe pero nada en el shell muestra estado de la conexión, AWS, Prisma.
20. **El Header no es accesible por teclado** desde el sider en collapse — tab order salta extraño.

### Experiencia (10)
1. La taxonomía del menú (Repositorio / Investigación / Producción / Exploración) está bien, pero el orden de "Investigación" debería ser **Preguntas → Consultar → Hipótesis → Deep Research** (de más rápido y barato a más caro), no al revés.
2. **El comando palette debería tener acciones**, no solo navegación: "Generar preguntas para X", "Producir respuesta…", "Cargar PDFs".
3. **Falta una "vista de notificaciones"** persistente: el AntdApp con `placement: "bottomRight"` deja mensajes efímeros, pero procesos largos (deep research 2‑5 min, enrich batch, embeddings) se pierden si el usuario cambia de página.
4. **No hay onboarding ni vacío inicial**: si llegas con 0 documentos el sider está lleno de opciones que no funcionan. Hace falta un wizard de primer uso.
5. **El collapse del sider** debería recordarse a nivel sesión + por dispositivo (mobile siempre collapsed por defecto).
6. **Modo lectura/foco**: una opción para esconder sider y header (`f` o `Cmd+\`) sería natural en chat, en documento y en producción detalle.
7. **El tema "auto" debería ofrecer también "noche académica"** (un sepia oscuro tibio) para sesiones de lectura larga — coherente con el branding académico.
8. **Atajos globales mínimos** que faltan: `g d` ir a documentos, `g c` ir a chat, `g h` home, `c` crear, estilo Linear/GitHub.
9. **Search global** debería desbordar a búsqueda semántica si no hay matches textuales — hoy solo hace LIKE.
10. **Sticky de breadcrumb + acciones del header** : cuando hago scroll en una vista larga (producción detalle), debería quedar fijo para poder seguir copiando/exportando.

---

## 1. `/` — Inicio (Dashboard)

Archivo: `src/app/page.tsx`. Componentes: `StatCard`, `ActionCard`, `ProgressMetric`, `StatusTag`, `ActivitySparkline`, `PeriodDistributionBar`.

### 20 mejoras visuales
1. El H1 "Archivo Histórico Digital" (`fontSize: 32`) compite con el subtítulo "Plataforma de investigación" en uppercase tracking; jerarquía invertida — el subtítulo se lee primero.
2. Los 4 KPI cards usan paletas distintas (`primary`, `#10B981`, `#F59E0B`, `#A855F7`) pero sin sistema: "Producciones" en violeta no comunica nada que el resto sí; mejor neutralizar a un solo color y diferenciar con iconografía.
3. El delta `+N 7d` aparece como Tag verde minúsculo (10px) que se pierde al lado del valor 24px. Conviene mostrarlo arriba derecha de la card con flecha.
4. `Statistic` de antd renderiza `value` con `font-family` distinto al título (Inter) — el número grande luce alineado a línea base diferente.
5. Las "Acciones rápidas" están en columna izquierda (lg=8) mientras "Documentos recientes" toma 16 a la derecha. En 1440px se siente desbalanceado — 6 items uno encima del otro vs lista densa.
6. El Card "Actividad — últimos 14 días" mezcla iconos antd (`RiseOutlined`) con texto del título y se ven mal alineados verticalmente.
7. La sparkline SVG no muestra eje Y; sin etiquetas el lector no sabe la magnitud — solo ve líneas relativas.
8. La sparkline tiene 3 series superpuestas (docs, preguntas, producciones) pero el gradiente fill las hace ilegibles cuando coinciden.
9. La leyenda de la sparkline (Documentos `total` · …) está encima de la gráfica con totals; conviene moverla a la esquina superior derecha con counts pequeñitos.
10. "Progreso del corpus" usa 3 barras de progreso con detalles "450 de 553" — debería ser un tile con número grande + barra mini, no listado vertical largo.
11. La barra de "Distribución por período histórico" tiene 14 segmentos coloridos sin separación entre ellos; los colores cálidos (PRE/CON/COL) se funden en una mancha marrón.
12. Bajo la barra hay un grid `repeat(auto-fill, minmax(160px, 1fr))` con cada periodo; en 1280 quedan 7 columnas → la primera fila se ve incompleta. En 1440 quedan 8.
13. Los chips de período en el grid usan `${color}14` (8% opacity) y `${color}33` (20% opacity) sin estructura; visualmente parecen "deshabilitados".
14. El `count: 0` se muestra con `opacity: 0.55` pero el conteo "0" no se imprime — debería decir "Sin preguntas" en lugar de quedar mudo.
15. "Acciones rápidas" tiene 6 cards con flecha `ArrowRightOutlined` a la derecha; el icono pesa más que el texto en algunas (Hipótesis, Deep Research).
16. Los iconos de acción usan colores arbitrarios (`#0891B2` cyan en Enriquecer, `#EC4899` rosa en Timeline) — divergen del sistema y no codifican nada.
17. "Documentos recientes" lista 5 ítems con tags `enriched` ✓ purple y `StatusTag` — pero los dos colorean igual ("READY" verde, "enriched" purple) y no hay clave visual.
18. La tipografía mono se usa sólo para el contador de chunks, pero el `pageCount` y `_count.questions` aparecen en sans — falta consistencia.
19. La grid "Preguntas recientes" y "Producciones recientes" tiene height auto, así una columna corta deja hueco vertical contra la otra alta.
20. El border‑left de 2px en las preguntas/producciones recientes no se ve en dark mode contra `colorBgContainer: #111114` — se necesita 3px o más contraste.

### 20 ajustes funcionales / bugs
1. `useEffect` que hace `fetch("/api/dashboard")` no maneja error: si la API falla, se queda en `loading=false` con `data=null`, y los componentes muestran `0`/empty con tono normal, no error.
2. `completionPct` divide `completedDeliverables / questions` — si una pregunta tiene 5 producciones completas, la métrica sobrepasa 100%. No hay clamp.
3. `enrichmentPct` no usa `data?` correctamente en la línea `data!.stats.enrichedDocs` — uso de non‑null en estado posiblemente null.
4. `deltas7d` puede ser undefined si la API no lo devuelve; `data?.deltas7d.docs` lanzaría `Cannot read properties of undefined`.
5. Sparkline: `data.flatMap(...)` se ejecuta aunque `data.length === 0` (manejado), pero `Math.max(1, ...empty)` devuelve 1; las series quedan planas y se ve la grilla vacía.
6. `PeriodDistributionBar` usa `total = sum(data.count)` para % de cada segmento; si total = 0, los `Tooltip`/`Link` no aparecen pero el div container vacío (28px) sigue mostrando un "track" vacío sin mensaje.
7. Los segmentos del barchart son `<Link href="/questions?periodo=CODE">` con `width: 0%` cuando hay 0 ítems → genera links sin área clickeable y rompe el orden tab.
8. El click en cualquier período abre `/questions?periodo=CODE` pero la ruta no filtra automáticamente porque el filtro inicial usa `searchParams.get("periodo")` pero el component pone `{filters.periodo}` desde estado local — primera carga puede no aplicar.
9. "Periodos cubiertos" calcula `distribution.periodos.filter(...).length / PERIOD_OPTIONS.length` — incluye `TRANS` (transversal) que distorsiona la métrica.
10. `recentDocuments` se renderiza con `Link href={'/documents/${doc.id}'}` pero el link wrapping aplica también al icono y al statusTag — el botón "Enriquecer" inside un Link rompe el evento.
11. `getDocumentDisplayName(doc)` se llama 2 veces por item (en `ellipsis Text` y `Tooltip`); duplicación de cómputos en cada re‑render.
12. La actividad (`activity`) se asume `Array<{day, docs, questions, deliverables}>` pero la API puede devolver menos días si no hay datos; el grid del eje X mostraría intervalos extraños.
13. `recentQuestions.map((q) => …)` no incluye key en el `<Space>` interior con tags; warning de React.
14. Si una pregunta no tiene `categoriaCode`/`periodoCode` válido, `getPeriodColor`/`getCategoryColor` retornan fallback `#6B7280` — pero el borde y los tags se ven igual, sin indicador de "sin clasificación".
15. `recentDeliverables` muestra `p.templateId` crudo como tag (e.g. `mini-ensayo`) — debería mostrar nombre humano del template.
16. `Empty.PRESENTED_IMAGE_SIMPLE` se usa en 3 lugares; el icono es genérico, no encaja con el tono académico (un libro/archivo sería mejor).
17. No hay refresco automático del dashboard — si subes un PDF en `/upload`, el dashboard no actualiza al volver hasta que recargues.
18. `StatCard` recibe `loading` prop y muestra el skeleton de antd, pero cuando los datos llegan parcialmente, el card vuelve sin animación de fade — flash visible.
19. El responsive `Col xs={12} md={6}` da 4 cards en md+ pero en pantallas 1024‑1280 las cards quedan apretadas con la sparkline (col 16) abajo, sin que se reordenen.
20. `useState<DashboardData | null>(null)` significa que los progress bars muestran 0% durante 200‑500ms antes de tener datos — flash de "todo a 0".

### 10 cambios de experiencia
1. El dashboard debería **respetar las últimas acciones del usuario** — un componente "Reanudar" que enlace al último chat, última producción en GENERATING, último PDF subido.
2. Reemplazar la sparkline genérica por **timeline de eventos**: hoy 14 días "blob" no comunica nada. Una lista de "Subiste X, Generaste Y, etc." con timestamps es más útil.
3. La distribución por período debería ofrecer **comparativa**: "este mes vs anterior", o "tu corpus vs promedio académico" (si hay benchmark).
4. Las "Acciones rápidas" deberían ser **dinámicas por contexto**: si no hay documentos enriquecidos, "Enriquecer" arriba; si hay 0 producciones, "Producir primera respuesta" destacada.
5. **Cards de "lagunas de cobertura"**: detectar 3‑5 cells del heatmap período×categoría con 0 preguntas y proponer generar preguntas allí.
6. **Métrica de costo**: la app llama Cohere v4 + Claude Opus 4.7 — debería estimar coste mensual aproximado (chunks vectorizados × $0.x, producciones × tokens, etc.).
7. **Health del corpus**: mostrar si los embeddings están al día, si hay documentos en `PROCESSING` colgados >1h, si Cohere/AWS responden bien.
8. **Acceso rápido a templates favoritos**: si el usuario usa "mini‑ensayo" en el 80% de chats, debería verse top of dashboard.
9. **"Empieza aquí"** persistente hasta que el usuario complete: subir PDF → enriquecer → generar preguntas → producir respuesta. Es un onboarding cuyo progreso se ve en la home.
10. **Search en vivo desde el dashboard** (sin tener que abrir Cmd+K): un input grande arriba que haga preview de matches mientras tipeas.

---

## 2. `/upload` — Cargar PDFs

Archivo: `src/app/upload/page.tsx`. Pipeline: hashing → upload S3 → process → embedding (poll).

### 20 mejoras visuales
1. Header "Cargar PDFs" con `Title level={2}` y `Paragraph` describiendo chunk 3000/750 — el texto es muy técnico para la entrada.
2. El `Dragger` ocupa una card pero el `InboxOutlined` está en 48px solo — se ve enano en el dropzone grande.
3. La hint del dragger menciona "concurrencia 2" — jerga interna sin contexto.
4. El bloque de stats (4 columnas: En cola/Listos/Duplicados/Chunks totales) está en una Card aparte arriba del listado; cuando hay 1 archivo procesándose, las stats se ven vacías.
5. Los stats usan `Statistic` de antd con `valueStyle: fontSize 22` — los 4 números a la misma altura son llanos, sin íconos diferenciadores.
6. Tags `chunks` por archivo no llevan el formato `1,234`; aparecen como `1234 chunks` (sin separador miles).
7. Cada `FileRow` tiene borde izquierdo de 3px coloreado por estado — pero los 5 colores (PENDING gris, PROCESSING azul, READY verde, ERROR rojo, DUPLICATE warning) saturan visualmente cuando subes 20 archivos.
8. El `Steps` por archivo muestra 6 pasos (En cola, Hash, S3, Chunking, Embeddings, Listo). Es mucho ruido por fila — cada upload se ve enorme.
9. Steps se renderiza incluso cuando el archivo está READY — debería colapsar a una vista compacta tras éxito.
10. El status text usa `color: statusColor` y muestra `LoadingOutlined` al lado — pero el spinner es del mismo tono y se diluye.
11. La barra de progreso de embeddings es `size="small"` con `strokeColor: token.colorPrimary` — pero no hay porcentaje ni texto numérico junto a ella.
12. El botón principal "Subir y procesar N archivos" cambia su label dinámicamente — bueno, pero el icono pasa de `CloudUploadOutlined` a `LoadingOutlined` y se ve menos llamativo.
13. Botón "Detener" es secundario pero está al lado del primary "Procesando..." que está disabled — se ven mismas dimensiones, confusión.
14. Botón "Limpiar" usa `ClearOutlined`; en dark se ve casi invisible.
15. El `Alert` de éxito ("3 archivos procesados") ocupa ancho completo y empuja la lista de archivos hacia abajo — debería ser un toast.
16. El border‑left de 3px en cards no se respeta en el `Statistic` arriba — inconsistencia de "estado".
17. El `Tag` "{chunkCount} chunks" no tiene icono ni color, se ve indistinto al de "duplicate".
18. Cuando un archivo es duplicado, el mensaje "Ya existe en el sistema como X" trunca al ancho del card, pero la X es un nombre largo de archivo — necesita `Text ellipsis tooltip`.
19. El Empty state ("Arrastra archivos arriba para comenzar") aparece dentro de una Card grande aún sin archivos; visualmente parece otra dropzone — confunde.
20. En móvil (375px) los stats 4 columnas se reducen a 2 (xs=12), pero los 4 valores grandes se apilan en 2 filas — pierde sentido visual.

### 20 ajustes funcionales / bugs
1. `computeFileHash` lee todo el archivo en memoria con `arrayBuffer()` — PDFs de 100MB+ cuelgan el navegador en Chrome móvil.
2. `CONCURRENCY = 2` hardcoded sin UI; al subir 20 PDFs el usuario espera 10 ciclos secuenciales sin saberlo.
3. `POLLING_INTERVAL = 4000` + `POLLING_TIMEOUT = 20min`. Si el embedding tarda más, el archivo aparece como `success` con mensaje "continuando en background" — pero ya no hay forma de actualizar su estado en esta pantalla.
4. `fetchWithRetry` no aborta si el usuario detiene (`abortRef.current = true`) en medio de un retry — la promise sigue.
5. `abortRef.current = true` no llama `controller.abort()` de los fetches activos, solo previene futuros. Quien esté en medio de upload S3 se completa de todos modos.
6. La verificación de duplicados se hace **solo después del hash**, no antes del archivo grande — si tienes 5 GB de PDFs duplicados, se calcula SHA‑256 de 5 GB sin avisar.
7. El `beforeUpload` filtra por `file.type === "application/pdf"` pero macOS a veces no manda content‑type correcto — archivos válidos se ignoran sin mensaje.
8. `setStates((prev) => …)` en `beforeUpload` filtra duplicados por `name|size`, pero dos archivos con mismo nombre y tamaño pero contenido distinto se ignoran sin avisar.
9. `message.info(${count} duplicados ya en la lista)` aparece en bottomRight — se pierde si el usuario está mirando el dragger.
10. El polling no maneja "504 Gateway Timeout" de Vercel/AWS (60s edge) — `++consecutiveErrors` los cuenta hasta 10 antes de degradar.
11. Si la API `/api/documents` falla en `POST` (process), el state queda en `processing` indefinidamente porque no hay timeout antes del catch.
12. `data.document._count?.chunks ?? 0` se confía en la respuesta — si la API devuelve `_count: undefined`, el progreso de embeddings dice "0/0".
13. El "Steps" muestra hasta "success" con `current: stepIdx` pero cuando hay un retry desde error, el stepIdx vuelve a "queued" — saltos visuales raros.
14. La hash duplicate check `sessionHashesRef` se limpia con `handleClear`, pero un archivo subido con éxito sigue marcado como duplicado al re‑drop sin clear.
15. El listener `pollingInterval` no se limpia en `unmount` si hay archivos en curso — leak de timers si navegas durante upload.
16. `formatBytes` (`fileSize`) no aparece — la columna usa cálculo inline `(state.file.size / 1024 / 1024).toFixed(2) MB` y deja "0.04 MB" para 40KB.
17. La página entera está en `app-page-narrow` (max‑width 980) — limita visualización con muchos archivos; sin opción de modo "compacto".
18. Una vez `success`, no hay link "Abrir documento" en la fila — el usuario debe ir a `/documents` manualmente.
19. No se loguea el `documentId` en la card de éxito, así que si algo va mal después no hay handle.
20. El error state muestra `state.message` solo en `Text colorError` — no se ofrece ver logs ni mostrar más detalle (e.g. error HTTP code, stack).

### 10 cambios de experiencia
1. **Cola visualmente prioritizable**: con muchos archivos, drag‑to‑reorder o "subir primero" / "saltar".
2. **Modo silencioso**: tras el primer éxito, ocultar el dragger y mostrar lista compacta con counter.
3. **Estimación de tiempo total**: en base al número de chunks y velocidad observada, "ETA: ~12 min".
4. **Continuidad cross‑page**: si abandono `/upload` para ir a `/documents`, los uploads deberían seguir en un widget global con progreso.
5. **Auto‑enrich**: opción "Enriquecer automáticamente tras subir" — hoy hay que ir a `/enrich` después.
6. **Detección de fragmentos**: si el PDF tiene índice/TOC, ofrecer chunking semántico vs fixed 3000.
7. **Restaurar sesión**: si refresco con uploads en curso, perder todo. Persistir progreso en localStorage por fileHash.
8. **Validación previa**: leer la primera página y mostrar título/autor antes de subir, para confirmar.
9. **Drag‑and‑drop desde Finder/Explorer al sider**: hoy solo en la zona del dragger.
10. **Cargar desde URL/Box/S3**: hoy solo File API; los corpus académicos suelen estar en repositorios.

---

## 3. `/documents` — Documentos

Archivo: `src/app/documents/page.tsx`. Tabla + Grid view, filtros, paginación, modal eliminar.

### 20 mejoras visuales
1. Header con "Documentos" + `Paragraph` "Corpus vectorizado. N documentos." y botones "Enriquecer" + "Cargar más" — el badge de cantidad debería estar dentro del título, no como párrafo.
2. Filtros (search, status, enrichment, recargar, view toggle) están en una Card pero quedan en una fila apretada con `Space wrap`; el `Segmented` queda al final de línea, lejos del resto.
3. El `Segmented` para table/grid no etiqueta — solo iconos, hay que adivinar cuál es cuál.
4. La tabla usa `<Table scroll={{ x: 900 }}>` — en 1440px no hace falta scroll horizontal, pero la columna "Documento" ocupa 360px fijos y el resto se reparte mal.
5. Cada fila tiene un cuadrado 36x36 con icono `FileTextOutlined` coloreado por periodo — el rectángulo se ve apagado contra fondos similares.
6. El nombre del documento usa `Text strong ellipsis` con Tooltip, pero el autor + period tag debajo agrega 3 líneas a la celda — la altura de fila se inflaciona a 64+ px.
7. La columna "Chunks" muestra número crudo en mono — sin separador miles ("12500" en vez de "12,500").
8. La columna "Páginas" sin sufijo "pp" — comparada con "Chunks" se confunde.
9. La columna "Tamaño" con `formatBytes` muestra "1.23 MB" pero la columna es 110px — texto se ve apretado.
10. Tag "Enriquecido" usa `purple` cuando true y `default` cuando false — el `Tag` para false es solo un guion ("—") sin color, parece celda vacía.
11. La columna "Cargado" muestra "15 May" sin año visible (solo en tooltip); confusión con docs antiguos.
12. La columna de acciones tiene `EyeOutlined` y `DeleteOutlined` lado a lado — ambos en type="text", iguales en tamaño. Eliminar en rojo es agresivo.
13. El `pagination` muestra "X documentos" con `showTotal` pero no destaca la página actual cuando hay muchos (la barra azul de antd se pierde).
14. El `pageSizeOptions: ["10","20","50","100"]` por defecto 20; en pantalla baja se ven sólo 8 filas — desperdicio.
15. La vista **grid** usa cards con `borderTop: 3px solid color` por periodo — pero los cards quedan a 260px mínimo con `minmax(260px, 1fr)` y el contenido se desborda con autor + tag + chunks + buttons.
16. El **chip de período** en grid tiene `background: ${color}1A` y `color: color` — en dark se ve casi negro sobre negro para periodos oscuros (PRE, COL).
17. Las cards del grid tienen `hoverable` pero el hover effect de antd añade sombra que se nota poco.
18. Title del card en grid: `style={{ minHeight: 38 }}` — fuerza altura para alinear, pero genera espacio raro si el título es 1 línea.
19. El `Space split={<Text type="secondary">·</Text>}` para "chunks·pp·MB" se ve atascado y los dots se ven mal alineados verticalmente.
20. Los botones del card "Ver" y "Delete" están en `Space justifyContent: flex-end` — descolocados, "Ver" debería estar a la izquierda como acción principal.

### 20 ajustes funcionales / bugs
1. `fetchDocuments` depende de `[page, pageSize, statusFilter, enrichedFilter]` pero el `search` no — la búsqueda solo filtra localmente. Documentos fuera de la página actual no aparecen en la búsqueda.
2. El auto‑refresh se dispara cada 5s si hay alguno `PROCESSING`. Pero si todos están READY, no auto‑refresca aunque hayas iniciado un enriquecimiento o eliminado externamente.
3. La búsqueda local ignora acentos (`Á` vs `a`) — los documentos con título "Colombia: La Violencia" no aparecen al buscar "violencia".
4. `metadata.author?.toLowerCase().includes(q)` — si `author` es undefined falla porque optional chaining no captura el error de método sobre undefined → OK, retorna undefined; pero `boolean(undefined) === false` correcto. Sin embargo el filter NO incluye keywords ni resumen.
5. `getDocumentDisplayName` se llama 2x por fila + Tooltip — costoso con 500 docs.
6. `handleDelete` no muestra una preview de qué se va a eliminar — solo nombre y advertencia genérica.
7. El delete usa `fetch DELETE` pero no maneja error 404/500 — el `message.error` solo aparece si throw, pero `await fetch` no throw en HTTP error.
8. Al eliminar, `fetchDocuments` refresca pero no resetea la paginación — puedes quedar en página 5 vacía.
9. Filtro `enrichedFilter` se manda como string "true"/"false" — el backend debe parsear bool correctamente, error‑prone.
10. Filtros vía `URLSearchParams` no se reflejan en la URL del browser; refrescar pierde estado.
11. El query parameter `documentId` no existe en esta página (se usa en `/questions` y `/enrich`), pero hay link a `?focus=` no implementado — link muerto.
12. `setPage` no reset al cambiar filtros → si estás en página 3 de 5 docs filtrados y cambias filtro a 2 docs totales, página 3 está vacía.
13. La tabla `pagination` cambia `total` correctamente pero `dataSource={filtered}` usa la versión filtrada localmente — la paginación no se sincroniza con el filtro local.
14. `dayjs(d).format("DD MMM")` localiza en inglés si `dayjs` no está configurado a es — verificar locale.
15. `Tag color={cfg.color}` para estado usa colors antd ("processing", "success") pero `cfg.icon` se pasa al tag con el icono; el tag con icono + label se ve más alto que sin icono — alturas distintas en columna estado.
16. Sin selección múltiple — no puedes eliminar 20 documentos a la vez ni hacer batch enrich desde aquí.
17. El "Ver detalle" abre `/documents/{id}` pero el botón es un `<Tooltip><Link><Button/></Link></Tooltip>` — el tooltip puede no aparecer porque el Link consume el hover.
18. No hay sort por "Enriquecido" — solo por chunks/pages/size/date.
19. El `enrichedFilter` solo tiene 2 opciones; falta "Solo con resumen", "Solo con autor", "Solo con periodo".
20. `loading` se gestiona con `setLoading(true)` antes de fetch — pero el state se rerendera con datos viejos durante el spinner, no hay skeleton de tabla limpio.

### 10 cambios de experiencia
1. **Bulk operations**: checkbox column para seleccionar varios documentos y enriquecer/eliminar/generar preguntas en lote.
2. **Vista de tarjeta con preview de primer chunk** — muchas veces el filename no es descriptivo; mostrar 2 líneas del primer chunk ayudaría.
3. **Filtros guardados** (saved searches): "Pendientes de enriquecer 2024", "Documentos del XIX", etc.
4. **Sort por relevancia semántica**: si hay query, ordenar por embedding similarity en lugar de createdAt.
5. **Quick actions** en hover: pin a workspace, copy id, regenerate preview, sin abrir el detalle.
6. **Vista de calendario / línea de tiempo de uploads** — sería útil para ver cuándo subiste qué.
7. **Filtros por chunk count range**: docs grandes (>500 chunks) vs cortos.
8. **Tags personalizadas** del usuario sobre cada doc (independiente de la metadata IA).
9. **Comparación side‑by‑side**: marcar 2‑3 docs y abrirlos en split view.
10. **Histórico de versiones / reprocesos** — qué cambió, cuándo, cuántos chunks ganó/perdió.

---

## 4. `/documents/[id]` — Detalle de Documento

Archivo: `src/app/documents/[id]/page.tsx`. Tabs: Resumen, Lectura inmersiva, Chunks.

### 20 mejoras visuales
1. El "hero card" con borde izquierdo de 4px (color del período) + cuadro 64x64 + título + tags toma ~180px de altura — domina la pantalla a costa del contenido.
2. El cuadro 64x64 con `FileTextOutlined` es repetitivo (mismo icono que en lista), sin distinción específica del documento.
3. Los botones de acciones (Enriquecer, Ver preguntas, Reprocesar, Eliminar) están en `Space wrap` arriba derecha, sin jerarquía visual entre primario y destructivo.
4. El botón "Eliminar" usa danger pero rojo intenso — en una vista de detalle, debería estar en un menú overflow.
5. Las 4 stat cards bajo el hero (Páginas/Chunks/Tamaño/Cargado) son redundantes con la lista de documentos.
6. La fecha "Cargado" muestra "15 MAY 25" en card mientras el hero ya tendría que tener esa info.
7. Los `Tabs` "Resumen / Lectura inmersiva / Chunks" — los iconos a la izquierda de cada label están en el mismo tono que el texto, no destacan.
8. La tab `Chunks` muestra el contador como Tag pegado al label — chico y pierde valor.
9. La tab "Resumen" (overview) tiene una Card con `background: token.colorFillQuaternary` para el summary — buena idea, pero el texto en `serif 15px line-height 1.7` queda con margen vertical insuficiente.
10. Bajo el resumen, dos Cards "Bibliografía" / "Clasificación" en columnas — los labels (Autor, Editorial, ISBN…) usan `text-secondary 12px` y el valor `colorText` — la jerarquía visual está bien pero falta divider entre filas.
11. Las "Palabras clave" aparecen como tags genéricos sin color/agrupación.
12. Si no hay summary, el `Alert type="info"` con link "Enriquecer ahora" tiene tono azul antd que choca con el resto académico.
13. La "Lectura inmersiva" muestra `Segmented` arriba con dos modos — pero el segmented es solo "Por página/Continuo", sin "Modo lectura" (full‑screen).
14. En modo "Por página", cada Card representa una página; el título del card incluye `Tag pegado` con "Página N" y conteo de chunks — duplicación, mejor en un solo subtítulo.
15. En modo "Continuo", el separador entre páginas (`Tag con línea + texto "Página N" + línea`) es estético pero gris claro y se pierde en dark.
16. Los párrafos del `prose-academic` tienen `max-width: 760` en continuo pero el card padre no centra correctamente — texto a la izquierda.
17. La tab "Chunks" muestra cards con `Title chunkIndex + ` + extra con 3 tags (#index, p.N, charSize) — el header de la card está sobrecargado.
18. El `Highlight` para search dentro de chunks usa `${colorWarning}33` (amarillo translúcido) — funciona en light, pero en dark sobre `colorBgContainer #111114` se ve marrón mate.
19. `Paragraph ellipsis rows: 6 expandable` muestra "Mostrar más" pero el botón es minúsculo, sin afford visual.
20. El skeleton inicial es genérico (3 bloques) sin reflejar el layout real — mejor un skeleton específico (hero, stats, tabs).

### 20 ajustes funcionales / bugs
1. `fetch('/api/documents/${id}')` no maneja 404 — `data.document` puede ser null pero se asume objeto.
2. El auto‑refresh para `PROCESSING` se hace cada 3s sin backoff exponencial — costoso en docs con problemas.
3. El cleanup del interval depende de `[doc?.status, id]` — cambiar de doc rápido (volver+abrir) puede dejar intervals huérfanos.
4. `chunksByPage` no ordena chunks por `chunkIndex` dentro de la página — solo agrupa.
5. `filteredChunks` se calcula por `useMemo` pero se itera todo el array; en docs con 5000 chunks el filtro local es lento.
6. La búsqueda dentro de chunks es case‑insensitive con `.toLowerCase().includes(q)` — sin matching difuso ni con acentos.
7. `Highlight` recompila la regex con escape — OK, pero `re.test(p)` dentro del map cambia el `lastIndex` del regex global → bug silencioso en algunos navegadores.
8. `handleReprocess` confirma y dispara POST, pero el state local `doc` no muestra inmediatamente "PROCESSING" — el usuario no sabe que algo pasa hasta el siguiente refresh.
9. `handleDelete` confirma y redirecciona a `/documents`, pero no invalida la caché de la lista — al volver, el doc puede seguir apareciendo (race).
10. La tab Reading mode no recuerda última selección (mode by-page vs continuous) entre visitas.
11. El extra del Card de chunk (`Tag chunkSize: 3000 ch`) — pero el `chunkSize` que se muestra es la config (3000), no el tamaño real del chunk (que varía).
12. El "Ver preguntas" abre `/questions?documentId={id}` pero no comunica si hay 0 preguntas — link a vista vacía.
13. El "Generar bibliografía" no está en este detalle, solo en `/producciones/[id]` — debería estar en documento también.
14. No se muestra error si el documento es `ERROR` — el `doc.error` aparece como Alert sólo si está poblado, pero el contenido (chunks) no se desactiva.
15. Si el doc tiene 0 chunks, las tabs Reading/Chunks muestran Empty pero el contador del tab dice "0" — should hide tab.
16. La URL `s3Url` se trae al cliente pero no se muestra/usa — si el usuario quiere ver el PDF original no puede.
17. El `keywords` array se renderiza con `<Tag key={k}>` — si hay duplicados, warning de React por key.
18. `MetaList` filtra `v !== undefined && v !== null && v !== ""` pero no filtra `0` o `false` — `pageCount: 0` aparece como "0", correcto, pero `isbn: 0` se vería.
19. No hay export del documento (download original PDF, .md de chunks, etc.).
20. El botón "Volver" usa `router.back()` — si entraste por link directo, sale fuera de la app (no a `/documents`).

### 10 cambios de experiencia
1. **Side‑by‑side**: abrir el PDF original (S3 URL) en panel derecho mientras lees chunks a la izquierda — comparar parsing.
2. **Marcadores y anotaciones**: poder destacar fragmentos clave dentro de chunks y compartirlos en producciones.
3. **Linked questions**: si el doc tiene preguntas asociadas, mostrar 3‑5 con teaser en la tab overview, no solo botón "Ver preguntas".
4. **Linked productions**: igual para producciones.
5. **Versionado de metadata**: si cambias el autor/título, registrar historia.
6. **Comparador inline**: 2 modos lectura, podría sumar "diff" entre chunks (cuando reprocesas).
7. **Search across docs**: buscar dentro de chunks debería poder extenderse a otros docs ("¿esta frase aparece en otro libro?").
8. **Quick chat**: pequeño chat lateral que solo busca dentro de este doc.
9. **Export tabla de chunks** como CSV con embeddings (para análisis offline).
10. **Indicador de salud del doc**: chunks con overlap correcto, pages alineadas, sin gaps; si algo falla, sugerir reprocess.

---

## 5. `/enrich` — Enriquecer

Archivo: `src/app/enrich/page.tsx`. Layout: lista izquierda + editor derecha; batch IA; manual.

### 20 mejoras visuales
1. La cobertura % "26%" arriba en un Statistic grande está bien, pero al lado el botón "Enriquecer N con IA" es del mismo tamaño y se compite por foco.
2. La barra de progreso de cobertura es `strokeColor: token.colorPrimary` sin variación; cuando ya hay 90% el color es igual que al 5%, sin sensación de completitud.
3. La columna izquierda lista documentos con `borderLeft: 3px solid color` selected y trans/transparent unselected — los items "no enriquecidos" no tienen color, ven planos.
4. Selección muestra `colorFillSecondary` background — en dark casi imperceptible.
5. El ícono `FileTextOutlined` de cada item usa color del período si está enriquecido — pero pendientes usan `colorTextTertiary`, igual al texto secundario.
6. El indicador `CheckCircleFilled` verde para enriquecido se ve a la derecha; pendientes muestran Tag "—" — debería ser `LoadingOutlined` con tooltip o icono `?`.
7. El input de búsqueda y el select de filtro están apilados sin labels — el select dice "Todos (N)" pero el input no tiene placeholder claro.
8. El `Collapse ghost` para Bibliografía/Clasificación/Resumen no muestra divisores entre secciones — todo se mezcla.
9. Los `Form.Item` usan label arriba (vertical) pero los `Input` ocupan toda la fila — campos como ISBN (Col xs={8}) quedan demasiado anchos.
10. El TextArea de "Resumen" usa `font-family: var(--font-serif)` — consistente, pero `rows={5}` puede no ser suficiente; se necesita auto‑grow.
11. Las "Palabras clave" usan `Space.Compact` para "input + Añadir" — el botón "Añadir" tiene `PlusOutlined` pero no se ve obvio.
12. Tags de keyword con `closable` y `closeIcon: <CloseOutlined />` tienen padding interno y se ven inflados.
13. El `Alert info` arriba del form ("Usa Enriquecer con IA…") tiene un botón inline "Enriquecer con IA" — duplica con el botón batch.
14. El header del editor combina avatar/icono + título + Tag enriquecido — el `Space vertical size={0}` no separa visualmente.
15. La columna izquierda muestra "Chunks: N" como secondary text — pero no se ve "pages count" ni período.
16. El `maxHeight: 600` del list con `overflowY: auto` deja ver solo ~12 docs — luego scroll dentro del card; mejor virtualizado.
17. El "Pendientes (N)" y "Enriquecidos (N)" del select tienen los counts redundantes con el segmented superior.
18. No hay indicador visual durante batch enrichment, solo el botón en loading state — el usuario no sabe cuántos van.
19. El editor no muestra qué se cambió desde la última versión — sin diff.
20. Tooltip "Total de páginas" en form no tiene aria‑label, solo placeholder.

### 20 ajustes funcionales / bugs
1. `runBatchEnrich` itera secuencial con `for` + `await fetch` — para 200 docs es lentísimo, no paraleliza.
2. Si un enrich falla, el `catch` está vacío `/* keep going */` — el contador `success` sube falsamente porque no se incrementa, pero el usuario no sabe cuántos fallaron.
3. `setBatchRunning(false)` se llama al final aunque no haya terminado el último — race si la app se cierra.
4. `loadDocs` después del batch refresca toda la lista — pero la selección se mantiene; el usuario puede estar viendo doc en cache obsoleta.
5. El editor recibe `key={detail.id}` para reset al cambiar doc — pero `form.setFieldsValue` en `useEffect [doc.id]` también — doble inicialización.
6. `keywords` se mantiene en state local separado del form — si el usuario edita y cambia doc sin guardar, el state local sobrescribe al siguiente doc.
7. `handleSave` envía `{ metadata: payload }` con todos los campos — sobrescribe campos no mostrados (e.g. `primaryCategory` si el form no lo expone).
8. `handleAI` POST a `/api/documents/${id}/enrich` sin body — la API debe inferir; pero no hay endpoint para "re‑enrich" si ya está enriquecido.
9. No hay confirmación si `handleAI` sobrescribe metadata existente — pierdes ediciones manuales.
10. `params.get("docId")` se usa una vez al montar, pero si cambias query param sin recargar (navegación SPA), no actualiza.
11. El search filtra `getDocumentDisplayName + filename` pero no `metadata.author` ni `keywords` — limitado.
12. `setSelectedId(null)` se llama solo desde el botón de cerrar del editor; cerrar tab del browser deja el query param.
13. El select de Periodo/Categoría usa `optionFilterProp="label"` — el label es "Nombre (Rango)" o "Nombre" — algunas búsquedas no encuentran por código.
14. `publicationYear` input type=number — pero los años pueden ser "1820‑1830" (rango), texto no aceptado.
15. `pageCount` en el form a veces conflicta con el `pageCount` real del PDF — sin warning si difieren.
16. No hay validación de ISBN (longitud, checksum).
17. El `addKw` permite añadir keywords vacíos con strings con solo espacios después del trim — `if (k && ...)` falla solo si k="".
18. La lista no notifica si tras un save un documento sale/entra del filter "Pendientes" — la UI no se reconcilia.
19. Sin shortcut de teclado para guardar (Cmd+S).
20. Sin "Aplicar a todos los seleccionados" — no hay multiselect para hacer bulk patch metadata.

### 10 cambios de experiencia
1. **Comparar IA vs manual**: cuando IA enriquece, mostrar diff con cambios sugeridos en lugar de pisar.
2. **Modo cola**: enriquecer en background sin bloquear UI; status bar persistente.
3. **Auto‑detect period** desde fecha de publicación + tema textual — sugerencias con confianza %.
4. **Importar metadata externa**: by ISBN → BibTeX desde Crossref/OpenLibrary.
5. **Templates de enrich**: para libros de Historia X siempre poner período Y; presets.
6. **Validación cruzada**: si título tiene "1948" pero el período dice "Conquista", warning.
7. **Bulk edit selector**: ya hay batch IA, falta bulk manual ("aplicar autor a 10 docs").
8. **Historial / undo**: si IA arruinó metadata, poder revertir a versión anterior.
9. **Notas internas**: campo libre del enrichador para anotar (no expuesto en UI pública).
10. **Plantilla de "ficha bibliográfica"**: poder exportar la metadata como `.bib` o `.ris` desde aquí.

---

## 6. `/chat` — Consultar

Archivo: `src/app/chat/page.tsx`. RAG híbrido con citas, templates, drawer de fuentes.

### 20 mejoras visuales
1. La barra superior con `MessageOutlined` 20px + título "Consultar el corpus" + subtitulo "RAG híbrido con citas · Claude Opus 4.7" — el subtítulo en 11px se pierde.
2. El selector de template `width: 280` es ancho pero al mostrar "icono + nombre" queda con espacio sobrante; opciones se ven dispersas.
3. El select agrupa por categoría con `optGroup label` — pero las etiquetas usan `CATEGORY_LABELS` directamente, sin estilo.
4. El botón "Fuentes (N)" pasa a "Fuentes (N/M)" cuando hay diferencia entre `totalChunksUsed` y `citations.length` — confunde al usuario.
5. El botón "Comparar" link a `/compare` está al lado de Fuentes — ambos iconos similares, función diferente.
6. El empty state tiene un icono 64x64 con `MessageOutlined` 28px y un título "¿Qué quieres investigar?" — bien, pero los 4 starters son cards con `Text 13px` y se ven planos.
7. Cards de starter sin diferenciación: no se ve cuál pertenece a qué template/período.
8. La bubble del usuario tiene `background: ${colorPrimary}10` y border `${colorPrimary}33` — en dark mode casi invisible (10% sobre #111).
9. La bubble del bot usa `colorBgContainer` y border `colorBorder` — sólido, pero los textos pueden ser largos y un avatar grande a la izquierda comprime el ancho.
10. El avatar del bot usa `#A855F722` con `#A855F7` (purple) — fuera de paleta primary.
11. El streaming muestra un cursor `2x16 colorPrimary` al final — pero no parpadea (no hay animation CSS).
12. El cursor de streaming aparece justo al texto, sin espacio — se confunde con la última letra.
13. El input de pregunta es `TextArea autoSize minRows: 2` — el botón "Send" al lado tiene `height: auto` y queda muchas veces medio cortado.
14. El placeholder cita el nombre del template entre comillas — el texto es muy largo para el área.
15. El hint debajo del input ("⏎ enviar · ⇧⏎ nueva línea · …30-90s con thinking…") es buena info pero queda en 11px gris.
16. Citas inline como tag `#1` ámbar — visualmente bien, pero al hacer click abre el drawer y el lector pierde el contexto.
17. El Drawer "Fuentes citadas" a la derecha con 520px — sobre desktop 1280, deja chat con 760 — la conversación se aprieta.
18. La CitationCard muestra `documentFilename` con `ellipsis` — los nombres tipo "Yolanda-Ceron-La-cara-amable…" se cortan a la mitad.
19. El segundo drawer (cita expandida) a 620px de ancho — abre encima del primero, layering raro.
20. El botón "Abrir documento" en cita expandida es Link inline — pierde el resto del drawer si haces click.

### 20 ajustes funcionales / bugs
1. El `useEffect` para auto‑scroll a `messagesEndRef` se dispara cada vez que cambia `streamingText` — durante streaming hace cientos de scrolls/segundo, lag perceptible.
2. El polling de chat `/api/chat/${id}` cada 2s no usa AbortController — si navegas a otro chat, el viejo poll sigue.
3. El typewriter effect `setInterval 25ms` con `i = Math.min(i+40, full.length)` no respeta velocidad de lectura; respuestas largas se muestran demasiado rápido.
4. El typewriter no termina si `streaming` falla a mitad — `clearInterval(typeTimerRef.current!)` con `!` puede no haber sido seteado.
5. `selectedTemplateId` está en state pero no persiste entre visitas — siempre vuelve al `DEFAULT_TEMPLATE_ID`.
6. El input de pregunta no valida mínimo 4 palabras — el placeholder dice "Mínimo 4 palabras significativas" pero no se enforces.
7. `messages` se mantiene en memoria local — refresh y pierdes todo, no hay link compartible (excepto si miras `id` de chat).
8. `setCitations([])` se llama justo antes de fetch — la cita anterior desaparece durante el "thinking" sin razón.
9. El error de fetch muestra `(err as { error?: string }).error || "Error al procesar la pregunta."` — si el server devuelve `{detail: ...}` no se muestra.
10. El template se guarda con el mensaje (`templateId: selectedTemplateId`) pero al cambiar template a mitad de pregunta, se pierde la asociación al render.
11. `data.totalChunksUsed` y `data.chunks` se asumen presentes — si el server devuelve formato distinto, fail silencioso.
12. El drawer de fuentes muestra `Citations[i]` pero al `setSelectedCitation(citations[idx - 1])` puede ir fuera de rango (citas inline `[#15]` con solo 10 citas reales).
13. La cita expandida muestra `selectedCitation.documentFilename` pero el filename puede ser undefined si el chunk fue de un doc eliminado.
14. `chunks` array no incluye `documentId` siempre — Link "Abrir documento" puede ir a `/documents/undefined`.
15. El input no se limpia si presionas Enter con value (se limpia bien), pero si presionas Send con shift Enter accidentalmente entra newline.
16. `handleCopy` copia el markdown raw (con `[#N]` literal) — pegar en Notion deja sintaxis intacta, no renderizada.
17. El streaming cursor aparece dentro del prose-academic pero el render del markdown lo trata como inline span — saltos de línea raros si el último char fue \n.
18. `useCitations` hook se llama dentro del map de mensajes — viola reglas de hooks (es función, no hook, pero el linter podría confundirse).
19. No hay ratelimit visible — usuarios pueden disparar 10 preguntas seguidas y la app no las encola.
20. Sin historial de chat — cada conversación es nueva; antes había `/api/chat/history` pero no se conecta a UI.

### 10 cambios de experiencia
1. **Historial de chats**: panel lateral con conversaciones pasadas (commit f15232e indica que existían "hilos").
2. **Anclar fuentes**: poder marcar 2‑3 citas como "ya las vi" y filtrarlas.
3. **Re‑ask con otro template**: botón "Probar con Ensayo Largo" debajo de la respuesta.
4. **Compartir conversación**: URL única por chat.
5. **Modo "follow-up"**: continuar conversación con contexto (hoy cada pregunta es independiente).
6. **Detección de comparativas**: si el usuario pregunta "compara X vs Y", auto‑sugerir el comparador.
7. **Indicador de calidad de respuesta**: tras generar, sugerir "¿Aceptas esta respuesta?" para feed a fine‑tuning.
8. **Sub‑búsquedas**: dentro de la respuesta, click derecho en una palabra → "buscar en corpus".
9. **Streaming verdadero**: hoy es typewriter sobre respuesta completa; usar SSE real desde el modelo.
10. **Templates personalizados**: poder duplicar uno y editar el prompt sin tocar código.

---

## 7. `/deep-research` — Deep Research

Archivo: `src/app/deep-research/page.tsx`. Agente con planning + subqueries en paralelo + síntesis.

### 20 mejoras visuales
1. El emoji 🚀 (`RocketOutlined`) en el título sugiere "lanzamiento" pero la operación tarda 2‑5 min — connotación incorrecta.
2. El Paragraph descriptivo es largo (3 oraciones); debería ser un Alert con info abajo del título.
3. El TextArea de pregunta tiene `minRows: 3` — para una pregunta de tesis es poco, debería abrir grande por defecto.
4. El botón "Iniciar Deep Research" es `type="primary"` con `ThunderboltOutlined` — el thunderbolt evoca rapidez, contradice los 2‑5 min.
5. El tooltip "Opus 4.7 con thinking extendido + 5 subqueries en paralelo" indica jerga interna — usuario académico no sabe qué es "thinking extendido".
6. El `Steps` del pipeline (Planificar/Búsqueda/Síntesis/Completado) — los iconos van en items pero `current` salta entre estados sin animación.
7. El status `error` colorea todo el Steps de rojo — el step "completado" puede pasar a rojo aunque ya estaba done.
8. El "Plan" Card muestra el thinking del modelo en italic gris — sin marcar como "razonamiento interno" formal.
9. La sección "Subqueries (N)" usa pequeñas cards con `#index` + texto + Tag de status — los Tags pequeños sin alineación vertical.
10. Cuando todas las subqueries están "buscando", se ven 5 cards en azul "processing" — efecto disco.
11. El Tag "N fragmentos" en azul aparece solo tras done — falta indicador durante search.
12. El Card "Síntesis" tiene `padding: "28px 32px"` y `prose-academic` dentro — bien, pero el título "Síntesis" en `Card title` está pegado al borde, sin respiración.
13. El Empty state ("Plantea una pregunta…") aparece solo cuando stage === idle — ocupa espacio incluso si el usuario ya escribió.
14. No hay diferenciación visual entre el plan (gris claro) y la síntesis (academia) — ambos podrían intercambiarse.
15. La pregunta original del usuario no se muestra arriba de la síntesis — solo en el TextArea editable.
16. El streaming `answer_delta` se acumula en `setAnswer` pero no hay cursor de typing.
17. El alert de error es genérico, sin guías de "qué intentar".
18. Sin indicador de costo estimado o tiempo restante.
19. El layout es `app-page-wide` (1680) pero el contenido principal queda apretado verticalmente — uso pobre del ancho.
20. Sin tema visual de "research mode" (sepia, lectura larga) — la pantalla se ve igual que el chat.

### 20 ajustes funcionales / bugs
1. El stream SSE se parsea con `buf.split('\n')` y `lines.pop()` — si un evento llega partido entre chunks, puede haber pérdida.
2. `if (ev.type === "step")` mapea "planning" y "synthesizing" pero no "executing" — debería caer naturalmente, pero el código asume `setStage("executing")` solo en evento `plan`.
3. `ev.plan.subqueries.map((q: string) => ...)` confía en que el server devuelve string[]; si manda objects, crash silencioso.
4. `answer_delta` se concatena sin trim — saltos de línea pueden duplicarse.
5. No hay cancelación del stream desde UI — si el usuario quiere parar, debe cerrar la pestaña.
6. El error `ev.error.message` se setea pero el estado `running` se mantiene true hasta finally — visualmente loading + error juntos.
7. Si el server cierra la conexión sin `complete`, queda en stage "synthesizing" indefinido.
8. `setSubqueries((sq) => sq.map(...))` por índice — si el servidor manda eventos out‑of‑order (ev.index 3 antes que 1), puede actualizar wrong slot.
9. La pregunta no se persiste — refresh y pierdes todo.
10. Sin save de research previo — cada vez es one‑shot, no se guarda en `/producciones`.
11. El Card "Plan" no se cierra/colapsa cuando termina; sigue ocupando espacio.
12. Las subqueries individuales no se pueden expandir para ver qué chunks encontraron.
13. El reader del stream `reader.read()` no maneja `ReadableStream` cerrado por timeout (Vercel 60s) — common issue.
14. `running` no se setea false en algunos error paths — botón sigue loading.
15. No hay validación de mínimo 12 chars antes de llamar a `message.warning` — el `disabled` del botón lo previene, pero el warning aparece si el usuario tipea y luego borra.
16. Sin retry si el plan falla.
17. La pregunta puede contener "[", ")", caracteres especiales que rompen el JSON.stringify si hay errores.
18. El `ReactMarkdown` sin sanitizer puede renderizar HTML — security.
19. Sin export del resultado a producciones.
20. El stream no muestra metadata de la respuesta (modelo usado, tokens, costo).

### 10 cambios de experiencia
1. **Guardar como producción**: convertir el resultado en deliverable con un click.
2. **Historial de research**: lista lateral de research pasados con búsqueda.
3. **Compartir/exportar**: link público (read‑only) o PDF directo.
4. **Plan editable**: el usuario debería poder corregir/añadir subqueries antes de ejecutar.
5. **Branching**: desde una respuesta, generar nuevas subpreguntas (research recursivo).
6. **Comparar research**: ejecutar 2 veces y diff (variedad).
7. **Modo "guided"**: el usuario responde 3 preguntas para refinar el research antes de lanzar.
8. **Costo + ETA real**: cobre con datos históricos.
9. **Citas pinned**: marcar 5 citas favoritas de las subqueries para que la síntesis las priorice.
10. **Research templates**: tesis, paper, ensayo argumentativo — con prompts pre‑hechos.

---

## 8. `/hypothesis` — Sistema de hipótesis

Archivo: `src/app/hypothesis/page.tsx`. Dual RAG (en favor / en contra).

### 20 mejoras visuales
1. El bullet 💡 `BulbOutlined` en el título es genérico; un símbolo de balanza sería más representativo.
2. Las palabras "a favor" y "en contra" usan `colorSuccess` y `colorError` — verde/rojo dicotómico, sin matices.
3. Las dos columnas usan `borderTop: 3px solid` — verde y rojo en el mismo viewport satura.
4. Las cards de cada lado tienen `minHeight: 380` — siempre forzadas a altura grande, incluso si están idle.
5. El Empty state "Sin ejecutar" usa el mismo icono ambos lados.
6. Spinner de loading sin label de "esto tarda 30-60s".
7. El `Tag {citations.length} fuentes` en color del lado se ve bien pero pequeño.
8. La respuesta usa `prose-academic` con `fontSize: 14` — más chico que en `/chat` (14.5px) inconsistencia.
9. No hay separación visual entre las dos columnas en mobile (lg=12 cada una, en xs apilan, sin divider).
10. La pregunta original del usuario no aparece encima de los resultados — pierde contexto.
11. El TextArea de hipótesis tiene placeholder largo y específico ("El Frente Nacional…") que ocupa 2 líneas.
12. El botón "Buscar evidencia" usa Rocket — mismo icono que Deep Research, confuso.
13. El subtítulo descriptivo está formado por **texto con `<Text strong color>`** inline — colores verdes/rojos en headline, ruido visual.
14. La descripción "Se ejecutan dos consultas RAG en paralelo. ~30–60s." está al lado del botón principal — el botón es grande, el texto chico.
15. Los iconos `CheckCircleFilled` y `CloseCircleFilled` en headers de columna son los mismos del status — connotación ambigua.
16. Cards de respuesta no tienen scroll interno cuando los textos son largos — la página entera scrollea.
17. Sin breadcrumb visual entre la pregunta y los dos lados — el cerebro no asocia.
18. Sin export "como producción", no hay forma de guardar.
19. La paleta verde‑rojo no es accesible (daltonismo); falta un símbolo de "pro/contra".
20. Sin animación al cambiar de loading a complete.

### 20 ajustes funcionales / bugs
1. `runSide` corre las dos consultas en paralelo (`Promise.all`) — pero `setIsRunning` se desactiva con `checkDone` que itera cada 1s revisando `pollers === null`, no es robusto.
2. El pollerRef tiene typing `MutableRefObject<ReturnType<typeof setInterval> | null>` — pero React 19 strict deprecated `MutableRefObject` para uso interno.
3. Si una de las dos consultas falla, la otra sigue, y el loading global no se quita hasta que `setRunning` toque false manualmente.
4. La hipótesis se manda como prompt textual con `${h}` interpolado — caracteres especiales (comillas, saltos) rompen el formato.
5. El templateId `mini-ensayo` hardcoded — no opcionable.
6. `topK: 100, similarityThreshold: 0.25` mismos valores que chat — no afinables aquí.
7. La validación `if (h.length < 10)` es por chars, no palabras — "abcdefghij" pasa.
8. El error de red muestra `"Error de red"` constante — sin detalle.
9. El polling intervala 2s sin backoff — si el endpoint tarda 60s, son 30 polls innecesarios.
10. `data.chunks` se setea solo al inicio — si el server actualiza chunks durante streaming, no se reflejan.
11. No se diferencian las chunks de "a favor" vs "en contra" — pueden ser las mismas y el lector no lo sabe.
12. Sin export combinado (un solo PDF con ambos lados).
13. Sin guardado como producción de hypothesis tipo "balanceada".
14. La pregunta de hipótesis no se logea en historia.
15. No hay forma de re‑ejecutar solo un lado.
16. Sin botón "Resumir ambos lados en un veredicto" (el caso ideal de hypothesis testing).
17. Si el usuario edita la hipótesis mientras corre, no cancela ni avisa.
18. Las dos respuestas se renderizan con `ReactMarkdown` sin sanitización.
19. La página entra en loop si el server devuelve `status: "PROCESSING"` siempre (sin transición a COMPLETE/ERROR).
20. Sin keyboard shortcut (Cmd+Enter para enviar).

### 10 cambios de experiencia
1. **Veredicto sintético**: tras tener ambas respuestas, generar un "balance" final.
2. **Hipótesis guardadas**: lista lateral de hipótesis exploradas.
3. **Refinar hipótesis**: sugerencias para reformular más precisa.
4. **Encadenar con tesis**: si una hipótesis se confirma, crear automáticamente otra que la extienda.
5. **Comparar con literatura**: si la hipótesis es famosa, mostrar consenso académico (si hay base externa).
6. **Visualización**: barra de "peso de evidencia" — % a favor vs contra basado en número y similarity de citas.
7. **Steel‑manning**: opción de "argumenta la mejor versión del lado contrario, no la débil".
8. **Multi‑hipótesis**: 3‑4 hipótesis competidoras a la vez.
9. **Modo socrático**: el sistema te pregunta de vuelta para refinar.
10. **Mostrar prompt usado** (transparencia académica).

---

## 9. `/questions` — Preguntas

Archivo: `src/app/questions/page.tsx`. Lista filtrable + agrupada por período/categoría.

### 20 mejoras visuales
1. El header con botones "Matriz", "Producir N pendientes", "Generar preguntas" en wrap — 3 botones primarios competing.
2. La cuenta `Total / Sin producción / Parciales / Completas` en 4 cards iguales — pero los colores (warning/primary/success) son arbitrarios.
3. Los filters (search/doc/periodo/categoria/sort/view) están en Card horizontal — `Space wrap` los apila en pantallas chicas con orden raro.
4. El `Sort` select tiene 5 opciones (Cronológico/Por periodo/Por categoría/Por subcategoría/Recientes) — too many, no hay default obvio.
5. La pestaña activa "Todas/Sin producción/Parciales/Completas" arriba del listado se ve igual que el filtro de estado — duplicación.
6. Cada `QuestionRow` tiene `borderLeft: 3px solid periodColor` — pero la categoría no se codifica visualmente, solo tag.
7. El número de pregunta `questionNumber` en mono con bg gris dentro de un span — se ve apretado.
8. Los Tags de período y categoría usan `${color}1A` opacidad — en dark mode no contrastan.
9. El tag de subcategoría (cuando existe) usa `defaultBg` plano — se nota ajeno al color period/categoria.
10. La justificación se muestra solo en vista cards, no en list — feature oculta.
11. El derecho de la row tiene `Tag con CheckCircleFilled + N producciones` — `default` color cuando N=0 y `success` cuando >0; mejor un counter más visual.
12. El Link a documento usa `filename.slice(0, 24)` — corta arbitraria, sin tooltip.
13. El "Producir" button es `type="text"` chiquito — la acción principal en cada row se pierde.
14. Sticky header de grupo `top: 64` (debajo del header global) con `borderBottom: 2px solid color` — pero el `background: colorBgLayout` no respeta padding lateral.
15. La sticky bar de grupo no muestra el conteo de "preguntas con producción" — solo total.
16. La Pagination al final está centrada — pero el `showTotal` muestra "X preguntas" no "X de Y".
17. Sin indicador de loading mientras se cambia filtro — solo `Skeleton` global.
18. La búsqueda no resalta matches en los resultados.
19. El segmented list/cards no tiene labels — solo iconos.
20. En mobile (xs), las cards se apilan pero el header se desborda por la cantidad de botones.

### 20 ajustes funcionales / bugs
1. `useEffect` para stats no se vuelve a ejecutar tras crear nuevas preguntas — refresh manual necesario.
2. `setPendingCount` se setea una vez al montar — no se actualiza si se generan producciones.
3. `fetchQuestions` depende de `[filters, stateFilter, page]` pero `URLSearchParams` no se persiste en la URL — refresh pierde estado.
4. El sort "cronologico" agrupa por período pero no ordena cronológicamente dentro del período — orden es por `questionNumber`.
5. El `grouped` se calcula con `Object.entries(grouped)` — el orden de claves en JS no garantiza orden cronológico (depende de iteration order de Object.entries).
6. Si el `documentId` filter está activo pero el doc fue eliminado externamente, queda con un id muerto en URL.
7. El `params.get("focus")` no se usa nunca — el `?focus=questionId` del command palette no abre la pregunta.
8. `Pagination` setea `setPage(p)` pero no scrollea al top — quedas en medio.
9. `setPage(1)` en useEffect de filters reset, pero `setStateFilter` también — el effect tiene chance de race.
10. Sin debounce en el input de search — cada keystroke dispara fetch.
11. La pestaña Tabs y el state filter son redundantes — hay 2 maneras de filtrar por estado.
12. El sticky group header se queda fijo encima de cada grupo cuando scrolleas — pero al final del grupo se solapa con el siguiente header.
13. El badge `CheckCircleFilled` en el tag muestra `success` cuando hay producciones, pero podría haber muchas con status ERROR — `deliverableCount` incluye errores.
14. Las preguntas con `categoriaCode` desconocido (no en `CATEGORY_OPTIONS`) caen en `getCategoryColor` fallback gris — sin alerta.
15. El "Producir" button enlaza a `/questions/matriz?focus=questionId` pero la matriz no implementa `focus` — link parcial.
16. Sin selección múltiple para "marcar como completadas" o "encolar batch".
17. No hay forma de **editar una pregunta** existente — solo regenerar.
18. La justificación se muestra completa con `expandable` — but no hay "ver completo en modal" alternativo.
19. No se puede archivar/ocultar una pregunta — todas siempre visibles.
20. Stats se cargan en `useEffect[]` solo una vez — desincronizado del listado real.

### 10 cambios de experiencia
1. **Editor inline de pregunta**: poder retocar la wording sin regenerar todo.
2. **Bulk select**: marcar 5 preguntas → producir todas con un template, o reclasificar.
3. **Sugerir reclasificación**: si una pregunta tiene período "PRE" pero el texto menciona "siglo XX", warning.
4. **Vista de "huérfanas"**: preguntas sin documento asociado.
5. **Duplicate detection**: marcar preguntas semánticamente similares para fusión.
6. **Rate/star**: el usuario marca preguntas favoritas para priorizar producciones.
7. **Notas privadas** por pregunta.
8. **Export**: exportar listas filtradas a CSV/Word.
9. **Vista "Burbujas"**: clusterización visual por período/categoría como Voronoi.
10. **Preguntas relacionadas**: cuando abres una, ver 3 más cercanas por embedding.

---

## 10. `/questions/matriz` — Matriz de producción

Archivo: `src/app/questions/matriz/page.tsx`. Tabla pregunta × template; selección bulk.

### 20 mejoras visuales
1. La tabla HTML pura `<table>` con borderCollapse separate y borderSpacing 4 — diferente de Ant Table — incoherencia visual.
2. Los headers de columna (templates) usan `writingMode: vertical-rl` no implementado — solo se usa `Tooltip` con icono. Los labels horizontales debajo del icono se truncan a ~80px.
3. Cada celda 38x38px con icono `ClockCircle/Sync/CheckCircle/CloseCircle` — los íconos son del mismo tamaño, color por estado.
4. Las filas tienen `background: ${primary}08` cuando selected — opacidad muy baja para destacar.
5. Las celdas "producibles" (selected Q + selected T + cell empty/error) se tintan con `${primary}1A` — pero el verde/rojo del icono dentro compite.
6. Los Tags de período/categoría debajo del texto de pregunta son pequeños, no separan visualmente.
7. La columna "Total N/M" en mono gris sin barra de progreso — mejor mini bar.
8. El header de tabla `background: colorFillQuaternary` casi imperceptible — debería ser más oscuro/distinto.
9. Sin separador visual entre header y body cuando scrolleas.
10. El badge `cellsToGenerate` en el botón usa `offset: [-6, 6]` — se ve flotando.
11. Sin total de celdas seleccionadas vs total disponible.
12. Sin checkbox "all" por template (columna).
13. La tab activa "Todas/Sin producción/Parciales/Completas" replica el Tabs de /questions — duplicación.
14. Sin tooltip en columna "Total" explicando qué significa N/M.
15. La tabla es estática (no virtualizada) — con 500 preguntas × 10 templates = 5000 celdas, scrolleo lento.
16. Sin freeze de la primera columna (pregunta) al hacer scroll horizontal.
17. El segmented filter por documento es un select arriba, separado del tab — flujo roto.
18. El botón "Recargar" no muestra loading inline.
19. El Empty state es genérico.
20. Sin contador visual de "X preguntas, Y templates" en algún lugar.

### 20 ajustes funcionales / bugs
1. `selectedQs` y `selectedTpls` son `Set<string>` — no se persisten al cambiar filtros (se borran).
2. El cellsToGenerate calculation itera selectedQs × selectedTpls en cada render — O(N×M) sin memo (memo está, pero las refs cambian).
3. `submit` envía `questionIds + templateIds` al endpoint sin pasar las celdas específicas — el backend asume "cruza todas las combinaciones aplicables".
4. Si el backend ya tenía algunas celdas COMPLETE, el bulk‑generate las omite — pero el counter de submit puede contar mal.
5. `setTimeout(fetchMatrix, 1500)` después de submit — arbitrario, no respeta el ritmo real de generación.
6. Sin polling tras submit — el usuario debe `Recargar` manualmente para ver progreso.
7. La celda con `cell?.status === "GENERATING"` muestra spinner indefinido — sin timeout.
8. `setSelectedQs(new Set())` se vacía al cambiar documentId — pero también al cambiar stateFilter, lo que puede sorprender.
9. La selección no se preserva entre páginas (no hay paginación, pero si hay >100 filas no es usable).
10. Sin shortcut "select all visible".
11. El `Checkbox` row tiene `indeterminate` solo en header — no hay tristate visual claro.
12. Si el endpoint `bulk-generate` devuelve `{queued: N, errors: M}`, el UI solo dice "Encolado (N)" — sin reportar M.
13. No hay forma de cancelar un batch en curso.
14. Las celdas linkadas a `/producciones/${id}` cuando COMPLETE pierden el icono check al hover.
15. Sin diff entre "completa hace 1 hora" y "completa hace 1 mes" — todo se ve igual.
16. El sortBy no existe — orden es el que devuelve el server (presumiblemente createdAt asc).
17. Sin filtro por categoría/periodo en la matriz — solo por documento.
18. Sin búsqueda dentro de la matriz.
19. El Tabs y el Select de doc combinados — su ordering tras Recargar es inconsistente.
20. La columna `Total` cuenta solo COMPLETE — preguntas con muchos errors aparecen como 0.

### 10 cambios de experiencia
1. **Matriz como mapa de calor**: en lugar de checks, intensidad por densidad de producción.
2. **Plantillas de bulk**: "Tesis básica = 3 templates por pregunta", presets.
3. **Recomendar combinaciones**: si una pregunta es "Mini ensayo" + completa, sugerir "Ensayo largo".
4. **Mostrar costo estimado** antes de enviar el bulk.
5. **Vista "por template"**: pivotar la matriz para ver completion por template.
6. **Drag‑select** de rango de celdas.
7. **Export matriz** como CSV (estado por pregunta x template).
8. **Replanificar errores**: botón "reintentar todos los errores".
9. **Programar generación**: encolar para ejecutar en horas valle.
10. **Aliase y favoritos** de templates (10 templates es mucho — el usuario usa 2‑3).

---

## 11. `/questions/generate` — Generar preguntas

Archivo: `src/app/questions/generate/page.tsx`. Streaming SSE de preguntas por documento.

### 20 mejoras visuales
1. El select de documento muestra `✓ /○` prefijo según tenga preguntas — visualmente confuso al lado del nombre.
2. El "N adaptativo" como número grande indigo (28px mono) a la derecha — descontexto, parece error.
3. La Card del doc seleccionado tiene `background: colorFillQuaternary` — bien, pero `gutter={16} align="middle"` deja el bloque "N adaptativo" desbalanceado.
4. Las 3 cards (Disponibles/Con preguntas/Pendientes) usan colores mixed (default/success/warning) — coherente con doc page pero arbitrario.
5. El Empty state "Sin documentos listos" tiene link inline "Sube un PDF" — separado del CTA principal.
6. El `Steps` vertical con 4 pasos muestra `direction="vertical"` — los items en columna se ven correctos pero el indicador "current" no destaca.
7. El progreso (`Progress percent`) sin `showInfo` no muestra el %.
8. Cada `GeneratedQuestion` aparece en Card con borderLeft del período — bien, pero apilados verticalmente se ven monótonos.
9. El streaming muestra todas las preguntas a medida que llegan — ok, pero sin animación de fade‑in.
10. Sin separación entre "progreso" y "preguntas generadas" — todo en una sola columna.
11. El error Alert es `type="warning"` (no error) — color amarillo no comunica fallo claro.
12. El success Alert ("N preguntas generadas correctamente") con botón inline "Ver todas →" — texto poco visible.
13. El botón "Regenerar" / "Generar" cambia label dinámicamente — pero el icono es el mismo Rocket.
14. La Card "Progreso" siempre visible una vez iniciado — incluso cuando termina, dificulta el scroll.
15. Sin indicador de tiempo (estimated).
16. La pregunta original (lo que vas a generar) no se muestra como input — solo el doc seleccionado.
17. Sin preview del prompt que se va a usar (transparencia).
18. Sin opción de elegir N manualmente — solo "adaptativo".
19. Sin previewing del primer chunk del doc para confirmar contenido.
20. El layout `app-page` (1440) deja mucho espacio lateral sin uso.

### 20 ajustes funcionales / bugs
1. `loadDocs` hace `Promise.all` sobre todos los docs llamando `/api/documents/${id}/questions` por cada uno — pesado (300 docs = 300 requests).
2. Si la API tarda en responder, el `loading` se queda true mucho tiempo — usuario ve skeleton de la página entera.
3. El select muestra `enriched._count.questions` pero la cuenta puede estar desfasada de la realidad si se generan en otra pestaña.
4. `computeTargetCount` se llama solo en cliente — sin validación cruzada con server (el server decide el N real).
5. `verifyAfterFailure` hace GET para chequear si hay preguntas creadas tras fail — pero si el error fue antes de crear cualquiera, devuelve falso aunque sea "stream cerrado prematuramente".
6. El stream parsing usa `lines.pop()` para buffer — eventos pueden cortarse entre chunks.
7. `setProgress((p) => …)` no es atómico — múltiples eventos `progress` rápidos pueden perder updates.
8. `STEPS_DEF` array de 4 items pero el `current: progress.length` puede ser > 4 si el server manda steps no listados.
9. El `progress.find((p) => p.step === s.step)?.done` no usa el último estado — siempre el primero match.
10. `ev.type === "question"` no maneja `ev.question` undefined.
11. `setQuestions((p) => [...p, ...])` reordena si los eventos llegan out of order.
12. `loadDocs()` después de complete refresca todos los docs — pesado.
13. El error "Stream interrumpido. Verifica recargando" es genérico — sin info del paso donde falló.
14. Sin retry automático del stream.
15. Sin botón "Detener" en curso.
16. Si el usuario cambia de doc selected mid-stream, el stream sigue para el doc anterior.
17. El error no distingue 401/403 (auth) de 500 (server).
18. Sin export de las preguntas justo generadas.
19. La URL no se actualiza con `?documentId=` tras seleccionar — refresh pierde.
20. Sin estimación de tiempo basada en chunks (e.g. "10s por chunk × N chunks").

### 10 cambios de experiencia
1. **Multi-doc generation**: generar para 5 docs a la vez con progreso visible.
2. **Filtrar por época/categoría**: limitar el set de preguntas (e.g. "solo política XIX").
3. **Editar prompt**: para usuarios avanzados, mostrar y editar el prompt.
4. **Comparar con otra IA**: hot-swap entre Claude/GPT.
5. **Sugerir preguntas faltantes**: tras generar, comparar con cobertura del corpus completo.
6. **Continuar generando**: si N=50 y quieres 70, "generar 20 más complementarias".
7. **Templates de generación**: "preguntas tipo tesis", "preguntas tipo examen".
8. **Review batch antes de guardar**: previsualizar y descartar antes de persistir.
9. **Notificación push** cuando termine (procesos de 10+ min).
10. **Reintento parcial**: si solo fallaron 5 de 50, regenerar solo esas.

---

## 12. `/threads` — Hilos de investigación

Archivo: `src/app/threads/page.tsx`. CRUD local (localStorage) de hilos.

### 20 mejoras visuales
1. Header con icono `NodeIndexOutlined` — mismo del Grafo, confunde.
2. La descripción "Almacenamiento local" es buena info pero el usuario no sabe si pierde datos al cambiar de navegador.
3. Las cards de hilo tienen `actions=[<Link>]` con flecha — el action toma todo el footer; el botón delete está en `extra` del title — split raro.
4. Cada card muestra dos Tags `N preguntas / N producciones` en fontSize 10 — chicos.
5. Sin avatar/imagen para diferenciar hilos.
6. Sin progreso (% completado del hilo).
7. Title del card es solo `Text strong` sin icono.
8. Sin colorización por categoría/tema.
9. Description con `ellipsis: rows 2` — corta pero sin tooltip ver completa.
10. Sin fecha de creación visible en card (solo en local).
11. La grid layout `xs=24, md=12, lg=8` da 3 columnas máximo — desperdicia ancho.
12. Sin badge/indicador "nuevo" para hilos sin tocar.
13. El modal "Nuevo hilo" tiene 2 fields (título, descripción) sin opción de plantilla.
14. Sin orden/sort: cronológico, alfabético, por actividad.
15. Sin filtros (todos/activos/archivados).
16. Botón "Nuevo hilo" siempre primary verde indigo, sin distinción visual.
17. Sin indicador "almacenamiento local" en cada card — el usuario podría asumir cloud.
18. El Empty inicial es card grande con CTA chico.
19. El delete con confirmación es modal estándar; no hay undo.
20. Sin pin/favoritos.

### 20 ajustes funcionales / bugs
1. `loadThreads()` lee de localStorage sin try/catch en algunos paths — error silencioso.
2. `saveThreads` no maneja QuotaExceededError.
3. `useEffect(() => { setThreads(loadThreads()); setLoading(false); }, [])` — `loading` siempre quita después de 1ms, skeleton solo se ve un flash.
4. `id` generado con `Math.random().toString(36).slice(2)` — no colisión‑proof.
5. No hay sync con backend — refresh en otra máquina perdés todo.
6. `removeThread` con confirm modal pero el cancel no resetea estado.
7. Sin reorder (drag‑drop) de hilos.
8. Sin rename inline.
9. Sin import/export de hilos (JSON).
10. El contador `t.steps.filter(s => s.type === "question").length` se recalcula por render.
11. Sin protección contra localStorage corrupto (JSON parse fail).
12. Sin migration de schema si cambia la estructura.
13. La validación form (`{ required: true }`) sin mensaje custom.
14. `message.success` en bottomRight, fuera de foco.
15. Sin búsqueda dentro de hilos.
16. Sin filtro por preguntas/producciones referenciadas.
17. Sin notificación si un hilo referencia una pregunta/producción eliminada.
18. Sin compartir hilo (export link).
19. Sin templates de hilo (e.g. "investigación de tesis", "ensayo argumentativo").
20. La descripción no soporta Markdown.

### 10 cambios de experiencia
1. **Hilos como flujos**: visualizar como un canvas con pasos enlazados.
2. **Mover steps entre hilos**.
3. **Auto-suggest next step**: "tu último paso fue una pregunta, ¿añadir producción?".
4. **Hilos compartidos**: cuando hay multi-user, colaborar.
5. **Hilos privados vs públicos** (preparado para multi-user).
6. **Resumir hilo**: IA genera narrativa del hilo entero.
7. **Versionado** y branching (alternar caminos).
8. **Exportar hilo como ensayo**: combinar pasos en un MD largo.
9. **Citas globales del hilo**: agregar todas las citas usadas.
10. **Tagging** de hilos por área de investigación.

---

## 13. `/threads/[id]` — Detalle de hilo

Archivo: `src/app/threads/[id]/page.tsx`. Timeline + modal añadir paso.

### 20 mejoras visuales
1. El Title del hilo es `level={2}` (24px) — pequeño para vista de detalle.
2. La descripción usa `Paragraph` sin estilo especial — se mezcla con el resto del contenido.
3. El botón "Añadir paso" está en `justifyContent: flex-end` — solo, sin contexto.
4. El `Timeline` de antd usa `dot` con iconos según `type` — pero los iconos son `BookOutlined (preg)/ AppstoreOutlined (prod)/ EditOutlined (note)` — los mismos del header global, confuso.
5. Cada step es una `Card size="small"` dentro de Timeline child — mucha anidación visual.
6. Tag del step con colors `orange/purple/blue` por tipo — pero los colores no aparecen en el dot.
7. El delete button del step es `type="text" danger` con `DeleteOutlined` — pequeño y oculto.
8. El "type" tag dice "question/production/note" en inglés — debería traducirse.
9. Para `question`, muestra pregunta + link "Ver pregunta →" — el link es chiquito y arriba del card.
10. Para `production`, solo muestra "Ver producción →" sin teaser del contenido — useless.
11. Para `note`, render Markdown con `prose-academic` — bien, pero sin distinción visual de notas vs preguntas.
12. Sin reorder de steps (drag-drop).
13. Sin numeración visual de pasos.
14. Sin total counter "X pasos".
15. Sin tiempo entre pasos (timestamp).
16. El form del modal es vertical pero los campos cambian según type — sin transition.
17. Para añadir question, el select solo busca por `pregunta.slice(0, 80)` — preguntas largas se cortan en dropdown.
18. Sin pre-select del último doc/pregunta usados.
19. Sin keyboard shortcut para añadir paso.
20. El layout es `app-page` (1440) pero el timeline está apretado a la izquierda.

### 20 ajustes funcionales / bugs
1. `use(params)` — uso del nuevo hook de Next.js puede romper si la API change.
2. `questions` se fetcha de `/api/questions?limit=200` sin filtros — first 200, puede no incluir la referenciada.
3. Si la pregunta o producción referenciada fue eliminada externamente, el step queda con `refId` muerto.
4. El `Step` interface tiene `refId` opcional, pero algunos paths asumen presente.
5. `persist` actualiza localStorage cada cambio — sin debounce, race con saveThreads en otra pestaña.
6. Sin lock/conflict si abres el mismo hilo en 2 ventanas.
7. `removeStep` no confirma — un click y borrado.
8. Sin undo.
9. El `note` se persiste como markdown raw — sin sanitization.
10. La pregunta seleccionada en el modal usa `value: q.id` pero el `label` es ellipsis — al volver al modal no muestra elección original.
11. Para "ID de producción" en input libre — usuario debe copiar/pegar id, error-prone.
12. Sin validación de que el ID exista.
13. La timeline no soporta `type === 'production'` con `id` válido visualmente — solo link.
14. El loading inicial no aparece si carga rápido.
15. Sin breadcrumb (volver a la list).
16. `loadThreads()` se llama 3 veces (mount + persist + render) — innecesario.
17. Sin lazy load del listado de preguntas.
18. `saveThreads(all)` reescribe TODO el array — costoso si hay muchos hilos.
19. Sin migration al cambiar schema.
20. Sin error boundary si el JSON está corrupto.

### 10 cambios de experiencia
1. **Steps como cards drag‑drop**: reorden visual.
2. **Vista tipo Miro/canvas**: hilos como flujos visuales.
3. **Templates de hilo**: "thesis", "report", "investigation".
4. **Encadenar visualmente**: cuando una pregunta tiene producción, marcarlo en timeline.
5. **Búsqueda en steps**.
6. **Inline edit** de notas sin modal.
7. **Resumen del hilo**: IA genera párrafo descriptivo.
8. **Export como Markdown** del hilo entero.
9. **Notificaciones**: cuando se completa una producción referenciada en el hilo.
10. **Cita persistente**: los citations de productions ancladas deben acumularse en una sección "bibliografía del hilo".

---

## 14. `/workspaces` — Workspaces

Archivo: `src/app/workspaces/page.tsx`. CRUD local de workspaces (pinned docs/qs/prods + notes).

### 20 mejoras visuales
1. Header con icono `ReadOutlined` — bueno, pero el mismo icono se usó en `Workspaces` del sider — consistencia ok.
2. Description larga: "Agrupa documentos, preguntas y producciones de un proyecto…" — wordy.
3. Las cards usan grid 3 columnas (lg=8) — bien, pero el `actions=[Button "Abrir"]` ocupa demasiado espacio horizontal.
4. Tags `N docs / N preguntas / N prods` en fontSize 10 — illegible.
5. Sin icono distintivo por workspace.
6. Sin progress bar de avance.
7. Sin tag/etiqueta de área (tesis/research/etc.).
8. La fecha "Actualizado X" en colorTextTertiary 11px — pierde.
9. Sin orden custom.
10. Sin filter.
11. Sin búsqueda.
12. Sin pin/favs.
13. Sin reciente al top.
14. Sin distinción local vs cloud (porque es local solo).
15. Empty state tipo card grande con CTA pequeño.
16. Sin export JSON.
17. Sin import.
18. Sin templates ("workspace para tesis", "workspace para paper").
19. Modal "Nuevo" simple: name + description.
20. Sin keyboard shortcut "n" para crear.

### 20 ajustes funcionales / bugs
1. Mismo problema que threads: localStorage como single source of truth.
2. Sin sync.
3. `Math.random().toString(36).slice(2)` para id — no único.
4. `saveWS` sin try/catch quota.
5. `loadWS` parse sin try/catch en algunos paths.
6. Sin lock multi-tab.
7. `setWs(loadWS()); setLoading(false)` always rapid — skeleton es flash.
8. Sin tracking de updatedAt en pin/unpin (solo se actualiza desde detail).
9. Sin contador de notes (la card no muestra si hay notas).
10. Si docs/questions/productions referenciados son eliminados, el counter queda inflado.
11. Sin clear all.
12. Sin merge de workspaces.
13. Sin duplicate workspace (clone).
14. Sin rename desde la lista.
15. Sin order persistente.
16. La validación `{ required: true }` mensaje genérico.
17. Sin URL deeplink al workspace (refresh OK, pero no link compartido).
18. Sin export bib del workspace (todas las citas).
19. Sin actividad reciente (qué se pinneó/cambió).
20. Sin compartir entre usuarios (preparado para multi-user).

### 10 cambios de experiencia
1. **Workspaces como folders en sidebar global**: cuando estás en un ws, todo el corpus se filtra a sus items pinned.
2. **Vista de "tablero"** estilo kanban con cols: documentos / preguntas / producciones / notas.
3. **Auto‑pin**: cuando creas una producción dentro del workspace, se pinea automáticamente.
4. **Notas como editor Markdown grande** con preview lado a lado.
5. **Workspace public link** (read‑only).
6. **Templates** ("tesis maestría", "policy brief", etc.).
7. **Time tracking**: cuántas horas en cada workspace.
8. **Multi‑user/collab** (futuro).
9. **AI summary del workspace**: resumir todo el material pinned.
10. **Export final**: PDF compilando notes + producciones + bibliografía.

---

## 15. `/workspaces/[id]` — Detalle de workspace

Archivo: `src/app/workspaces/[id]/page.tsx`. Tabs (docs/qs/prods/notes).

### 20 mejoras visuales
1. Tabs 4 (docs/preguntas/producciones/notas) con counts en label — bien.
2. Icono + texto en cada tab — los iconos no se distinguen ("FileText", "Book", "Appstore", "Edit").
3. Las cards de cada item pinneado son `size="small"` con `Space justify-content: between` — links a la izquierda, delete a la derecha; estructura repetitiva.
4. El delete `type="text" danger` — pequeño.
5. Sin reorder de pins (orden por insertion).
6. Sin agrupar por época o categoría dentro de cada tab.
7. Botón "Anclar X" arriba de la lista — siempre visible pero se mezcla con la lista.
8. El modal de anclar es un Select simple — sin previews de los items.
9. La pestaña "Notas" tiene `extra` con botón "Editar" — pero cuando editas, los botones (Guardar/Cancelar) están en extra arriba — alejados del TextArea grande abajo.
10. Sin syntax highlight en Markdown notes.
11. Sin word count en notes.
12. Sin autosave (solo manual).
13. El layout `app-page` (1440) deja mucho espacio.
14. Sin sidebar de "workspaces list" para cambiar rápido entre ws.
15. La descripción del ws aparece bajo el title sin estilo de quote.
16. Sin breadcrumb.
17. El Empty de cada tab dice "Sin documentos anclados" — sin CTA destacado.
18. Sin filtro/búsqueda dentro de los pinned.
19. Sin distinción visual de items pinned hace mucho vs recientes.
20. Sin progress general del workspace.

### 20 ajustes funcionales / bugs
1. `Promise.all` para fetch de docs/qs/prods — sin error handling.
2. `setDocs(d.documents)`, `setQuestions(d.questions)`, `setProductions(d.deliverables)` — las APIs deben mantener esos campos.
3. Los items pinned se filtran client-side (`docs.filter(d => ws.pinned.documents.includes(d.id))`) — si el doc no está en los primeros 300, no aparece.
4. Si un item pinned se elimina externamente, sigue en el array pinned (dangling ref).
5. Sin chequeo de existencia al añadir pin.
6. `togglePin` añade/quita en mismo botón — pero el botón solo dice "Anclar" (no toggle).
7. `editingNotes` state local, no se persiste hasta save explícito.
8. Sin warning al salir con cambios sin guardar.
9. `notes` puede ser muy largo — sin límite.
10. Las notes Markdown renderizan sin sanitize.
11. `persist` actualiza `updatedAt` cada cambio — bien.
12. Sin lock multi-tab.
13. El modal de Pin se cierra al `onOk` aunque selected sea undefined — comportamiento confuso.
14. Sin multi-select en el pin modal.
15. Sin búsqueda por contenido (solo por nombre).
16. Las preguntas pinned no muestran período/categoría — solo texto.
17. Las producciones pinned no muestran template/estado.
18. Sin link del doc → "Ver chunks" / "Ver preguntas" desde el card pinned.
19. Sin acción "Producir" desde una pregunta pinned (atajo).
20. Sin export del workspace completo.

### 10 cambios de experiencia
1. **Notes split-view**: edit + preview Markdown.
2. **Notes con citation autocomplete**: tipear `[[` para sugerir items pinned como cita.
3. **AI assist en notes**: "resume estos 3 docs pinned".
4. **Drag&drop** pin entre tabs.
5. **Quick chat dentro del workspace**: chat que solo consulta items pinned.
6. **Vista "Outline"**: el workspace como esquema editable.
7. **Compilar a producción**: convertir notes + items en un MD/Word.
8. **Snapshot/version**: guardar estado del ws para volver.
9. **Comentarios** (multi-user).
10. **Auto-organizar por época/categoría**.

---

## 16. `/producciones` — Producciones

Archivo: `src/app/producciones/page.tsx`. Lista de deliverables con filtros, grid/list.

### 20 mejoras visuales
1. El badge "N producciones" en el subtítulo se mezcla con la descripción.
2. Los filtros (search + category + template + source + segmented) en `Space wrap` se desordenan en pantallas medianas.
3. Los templates en select muestran "🧾 nombre" — el emoji compite con la elección.
4. Los Tags `source: chat / batch` usan `geekblue/purple` — confunden con period/category.
5. Las cards grid tienen `borderTop: 3px solid periodColor` y `height: 100%` — heights iguales son bien.
6. Cada card muestra template name + source badge arriba — separados a derecha-izquierda.
7. La pregunta (title) usa `font-family serif 13.5px line-height 1.55 ellipsis 3 rows` — 3 líneas máximo, pierde info en preguntas largas.
8. El answerPreview en 12px gris — pequeño.
9. Tags de período/categoría en fontSize 10 al final — chips minúsculos.
10. Tag "generando" appears with `colorProcessing` — pero el card aún se ve activo (mismo borde).
11. Fecha (DD MMM YY · HH:mm) en gris 11px — perdida.
12. Modo lista (`view==='list'`) — cards horizontales 12px padding, info similar pero apretada.
13. Sin diferenciación visual entre completed/in-progress/error/empty.
14. Sin progress bar para producciones en GENERATING.
15. Pagination simple sin sizer.
16. Sin counter visible de cuántas hay por categoría.
17. Modal "Nueva producción" tiene fields question + templateId — sin preview del prompt.
18. Sin keyboard shortcut "n".
19. Layout `app-page-wide` (1680) — bien.
20. Sin avatar/imagen por template (más que el emoji).

### 20 ajustes funcionales / bugs
1. `fetchItems` filtra category client-side — si la página actual no incluye los de esa category, no aparecen.
2. Search también client-side — limita.
3. No hay invalidation tras `New production` — `fetchItems()` se llama después de modal cierre pero antes de que el GENERATING aparezca en DB.
4. Sin polling de items en GENERATING.
5. Sin batch operations (cancel multiple, delete).
6. `item.answerPreview` puede no estar — defaults a empty.
7. `item.question?.document` puede ser undefined — `.document.id` falla.
8. Filtro `source` con value "chat"/"batch" — si la API espera otros valores (e.g. "ad_hoc"), fail.
9. `setPage` no resetea al cambiar filter.
10. Pagination muestra `total: data.pagination.total` pero el `filtered.length` puede diferir — UX confusa.
11. Sin sort options.
12. Sin selección.
13. Sin export.
14. Sin link a la pregunta originante.
15. La preview text puede tener markdown raw (asteriscos) — feo.
16. `Math.min(Limit, total)` en showTotal — incorrecto.
17. Sin estado vacío con CTA destacado.
18. Sin notificación cuando se completa un GENERATING.
19. Sin url-deeplinks de filtros.
20. Sin throttle del search.

### 10 cambios de experiencia
1. **Vista cronológica** estilo feed reciente con destacados.
2. **Comparar producciones** lado a lado.
3. **Marcar favoritas / archivar**.
4. **Tags personalizados** por user.
5. **Batch export** (varias producciones a un solo PDF).
6. **Vista "por pregunta"**: agrupar las múltiples producciones de una misma pregunta.
7. **Search semántico** dentro de respuestas (no LIKE).
8. **Ratings**: el usuario califica calidad (feedback loop).
9. **Compartir** producción específica.
10. **Insertar en hilo/workspace** desde aquí.

---

## 17. `/producciones/[id]` — Detalle de producción

Archivo: `src/app/producciones/[id]/page.tsx`. Texto principal + acciones + contexto + drawer fuentes.

### 20 mejoras visuales
1. Layout 2 columnas (17 + 7) — la columna principal con texto académico, derecha con acciones.
2. El título de la producción es la pregunta (`<Title level={2}>` serif) — bien.
3. Sobre el título, 3‑5 tags (template/period/category/status) en `Space wrap` — fila densa.
4. El template tag tiene el emoji + nombre dentro — gran tag con icon, se ve más grande que los otros.
5. La línea "wordcount · sources · timestamp · model" en una sola text secondary — info densa.
6. El card principal del contenido `padding: 32 36px` — buenos margenes, pero la transición con el card header arriba es brusca.
7. Las citaciones inline (#N) usan `cursor: pointer` + abren el drawer entero — sería mejor hover preview.
8. El drawer de fuentes a 560px — overlap con la columna derecha.
9. La columna derecha tiene 2 cards: Acciones + Contexto — apilados, sin labels claros.
10. Botones de la card Acciones (Copiar, Exportar dropdown, Ver fuentes, Generar bibliografía) — todos full width, mismo size — sin jerarquía.
11. El Dropdown "Exportar como..." muestra items "md/docx/pdf" sin íconos — minimalismo excesivo.
12. La card Contexto tiene labels en uppercase 11px tracking — bien, pero los valores debajo (Tag source, mono modelo) no se diferencian de otras stats.
13. El modelo se muestra como `data.modelUsed.replace("us.anthropic.", "")` — string técnico.
14. Sin barra de progreso si está GENERATING.
15. Si está GENERATING + sin answer, muestra Spin grande centrado — bien, pero sin label de progreso.
16. Tipografía del título inconsistente con el contenido (sans vs serif within prose).
17. Sin "go back to question" prominente.
18. Sin breadcrumb (Producciones / Esta producción).
19. Sin botón de edit (la producción no es editable directamente).
20. Sin sharing UI.

### 20 ajustes funcionales / bugs
1. El polling cada 3s mientras GENERATING — sin backoff.
2. `clipboardWriteText(data.answer)` — copia markdown raw con `[#N]` notation.
3. Export download usa `a.click()` — Safari mobile bloquea sin gesture.
4. El download file name `(data.question?.pregunta ?? "produccion").slice(0, 50).replace(/[^\w\s]/g, "")` — pierde acentos.
5. Sin progress de export (e.g. PDF render puede tardar).
6. Sin error retry para export.
7. `data.chunksUsed` puede tener entries con todo undefined — el drawer muestra entries vacías.
8. La citation click abre el drawer — pero no destaca cual cita específica.
9. Si la pregunta `document.id` es undefined, el Link va a `/documents/undefined`.
10. Sin export del prompt usado.
11. Sin re-generación de la misma producción con otro template.
12. Sin diff entre versiones (si se regeneró).
13. `data.modelUsed` puede no estar — defaults a "".
14. Sin tracking de "veces leído / abierto".
15. `wordCount` calculado en cliente — para textos largos lag.
16. ReactMarkdown sin sanitize.
17. El highlight regex no escapa correctamente texto de búsqueda con caracteres especiales.
18. Sin link a workspace donde está pinned.
19. Sin opción de pegar el contenido en chat para continuar.
20. Sin print-friendly CSS.

### 10 cambios de experiencia
1. **Modo lectura**: hide everything but the content.
2. **Anotaciones**: poder destacar/comentar inline.
3. **Versionado**: regenerar y comparar.
4. **Citations always visible**: en columna lateral, no en drawer.
5. **AI follow-up**: chat sobre la producción.
6. **Translate**: a inglés o variante regional.
7. **Calidad rating** con feedback loop.
8. **Compartir public link** read-only.
9. **Detección de claims polémicos**: marcar afirmaciones que merecen verificación adicional.
10. **Generate citations bibtex** desde aquí.

---

## 18. `/compare` — Comparador de templates

Archivo: `src/app/compare/page.tsx`. Misma pregunta, hasta 3 templates en columnas.

### 20 mejoras visuales
1. Layout 3 columnas con `lg={24/templates.length}` — si tienes 2, son lg=12; si 3, lg=8. En 1280px, lg=8 = 320px de ancho cada col — chiquito para texto académico.
2. Cada `ResultColumn` es card con header (icono + nombre + descripción) — el description (`tpl?.description`) puede ser largo y se desborda.
3. El extra del card (citas count + copy button) solo visible cuando complete — antes vacío.
4. El `maxHeight: 640` del scroll interno — fija pero a veces la respuesta es más larga; user debe scrollear dentro de cada columna.
5. Los Tags removables (close icon `DeleteOutlined`) — el delete está minúsculo.
6. El select "Añadir template" tiene `PlusOutlined` en placeholder — value undefined siempre, parece bug.
7. `Button "Comparar"` primary — al lado de tags + add select, se aprieta.
8. Sin indicación de "diff" entre las respuestas.
9. Sin highlight de partes coincidentes/divergentes.
10. Sin scrollbar visual en columnas.
11. El Loading dentro de cada columna es Spin chico — sin label.
12. Sin progress por columna.
13. Cada columna usa `prose-academic 13.5px` — más chico que en chat (14.5).
14. Sin export del comparativo.
15. Sin share link.
16. Sin save as workspace step.
17. Empty state "Añade al menos un template para comparar" — fuera de card, en página completa.
18. Sin sample questions sugeridas.
19. Sin tooltip explicando cada template.
20. Sin keyboard shortcut.

### 20 ajustes funcionales / bugs
1. `Promise.all` dispara los 3 fetches en paralelo — sin throttling, puede pegar al server.
2. Los pollers son `Record<string, intervalId>` — si dispatch 2 veces rápido, leaks.
3. `setIsRunning(false)` se llama en `checkDone` interval, no inmediato — race conditions.
4. Si una columna falla, las otras siguen pero no hay retry independiente.
5. Sin cancel button per column.
6. El template removable hace `setTemplates(filter)` — si el running, el poller sigue (no se cleara).
7. Sin URL state (refresh pierde la query y comparación).
8. Sin save de comparación.
9. La copy en cada columna copia raw markdown — pierde formato visual.
10. La descripción del template puede ser undefined.
11. `templates.length === 0` muestra Empty — pero el usuario puede atascarse sin templates.
12. Sin reorder (drag) de columnas.
13. Sin selector "modo lado a lado vs stack vertical".
14. La pregunta solo tiene 2-6 rows max — para preguntas largas, atascado.
15. Sin re-run después de error.
16. La pregunta no se guarda en historia.
17. Cada template ejecuta una llamada `/api/chat` separada — costo 3x sin un endpoint batch.
18. Sin metadata por columna (model used, tokens, etc.).
19. Sin export comparado.
20. Sin ratings per column.

### 10 cambios de experiencia
1. **Diff view**: resaltar lo que dice un template y otros no.
2. **Best of**: marcar como "favorita" y guardar como producción.
3. **Combine**: fusionar partes de cada respuesta en un MD final.
4. **Up to 5 templates**, no 3.
5. **Vertical stack** además de horizontal.
6. **Compare across models**: misma pregunta, mismo template, GPT vs Claude.
7. **Same template, different chunk sizes**: comparar estrategias RAG.
8. **History**: comparaciones pasadas.
9. **Auto-grade**: IA evalúa cuál es mejor.
10. **Vote pubic**: si la app es colaborativa, votación.

---

## 19. `/bibliography` — Bibliografía

Archivo: `src/app/bibliography/page.tsx`. Cita en APA/Chicago, download txt/bib.

### 20 mejoras visuales
1. Header con `BookOutlined` + título — el icono es el mismo que /questions en el sidebar.
2. La descripción varía si hay `?deliverable=id` o no — explicar mejor.
3. El Segmented APA / Chicago al lado del Reload — separados sin label.
4. La Card de acciones (Copy/.txt/.bib) — 3 botones iguales.
5. Las entries de bibliografía se ven como párrafos con `padding-left: 24, text-indent: -24` (hanging indent) — bien académico, pero falta línea separadora.
6. Sin numeración.
7. Sin agrupar por tipo (libros/articles/web).
8. Sin filtros (por autor, año).
9. Sin búsqueda.
10. La fuente serif 14px 1.7 — correcta para impresión, pero se ve grande en web.
11. Sin estilo de "primera línea sangrada" como impresión.
12. Sin distinción visual entre la cita y un párrafo normal.
13. Empty state genérico.
14. Sin avisar si las citas vienen de chunks incompletos.
15. Sin avatar/icono de cada cita.
16. Sin link a documento original.
17. Sin export a Word/PDF.
18. Sin preview del .bib.
19. Sin estadística "Citas únicas: N".
20. Sin keyboard shortcut "c" copy all.

### 20 ajustes funcionales / bugs
1. `fetch /api/bibliography` depende de `style` y `deliverableId` — si el server no soporta `deliverable` filter, falla.
2. Sin paginación — todas las citas a la vez.
3. Sin caching client-side.
4. `data.formatted.join("\n\n")` — formato puede tener escapes.
5. Download usa `Blob + URL.createObjectURL` — Safari iOS no permite download de Blob sin user gesture frequently.
6. `.bib` generation hardcoded a `@book{...}` — todas las refs como libros aunque sean articles/web.
7. Sin handling de archivos sin autor (anonymous).
8. Sin distinción entre referencias del corpus y referencias citadas en producciones.
9. El raw `c.raw` se ignora — solo se muestra `formatted`.
10. Sin sort options (autor/año/título).
11. Sin filter por estilo bibliográfico custom (MLA, Harvard).
12. Sin actualización si cambia el corpus.
13. Sin export con BibTeX completo (escape de characters).
14. Sin RIS, EndNote formats.
15. Sin DOIs aunque existan.
16. La copia incluye trailing newlines.
17. Sin contador "N referencias copiadas" persistente.
18. El downloadBib genera key naïvo `firstWord+year+i` — colisión en grandes corpus.
19. Sin warning si las referencias tienen campos vacíos críticos.
20. Sin merge de citas duplicadas.

### 10 cambios de experiencia
1. **Editor de bibliografía**: corregir manualmente entries antes de export.
2. **Sync con Zotero/Mendeley**: integración directa.
3. **Detect duplicates** (mismo libro citado dos veces).
4. **Suggest fixes**: si una cita tiene "?" en lugar de año, sugerir buscar.
5. **Add manually**: añadir refs que no estén en el corpus.
6. **Citation graph**: ver qué producción cita qué fuente.
7. **Coverage**: % del corpus efectivamente citado.
8. **Export según journal**: Nature, APA Psychology, Chicago Manual.
9. **Multilingual**: bibliografía en inglés vs español según uso.
10. **DOIs auto-fetch** desde Crossref.

---

## 20. `/timeline` — Línea de tiempo

Archivo: `src/app/timeline/page.tsx`. Barras verticales por período, click → detalle.

### 20 mejoras visuales
1. El header con `RadarChartOutlined` — radar es engañoso para timeline.
2. La descripción menciona "anillos" pero no hay anillos en la viz — confuso.
3. El gráfico es horizontal scroll con `minWidth: 1100` — en 1280 cabe, en 1024 scroll.
4. 14 barras (PERIOD_OPTIONS sin TRANS) — espaciado fijo 8px gap, no se adapta.
5. Cada barra `height: 220px` container con bar interior proporcional — el bottom de la container queda vacío para barras chicas (ven flotantes).
6. El gradient `linear-gradient(to top, color, color88)` — se ve plano.
7. Cuando seleccionada: border 2px + box-shadow 4px ${color}33 — destaca, pero el shadow desborda al vecino.
8. El conteo (qCount) aparece dentro de la barra solo si height > 15% — desigual.
9. El text shadow `0 1px 2px rgba(0,0,0,0.3)` sobre el conteo blanco — works en barras de período colores oscuros, mal en período claros.
10. Bajo la barra, un divider `height: 1px, background: color, margin: 8px 0` — pero solo el ancho de la barra; rompe el rhythm.
11. El range `rango` (e.g. "1819-1830") en mono 10px — chico.
12. El nombre del período se trunca a `split(" ").slice(0, 3).join(" ")` — ej "Posconflicto y..." sin context.
13. Sin scale visible.
14. Sin filtros (toggle docs/preguntas/producciones).
15. La leyenda dice "Preguntas (altura)" pero el cuadrado es color primary (indigo) — no representa los colors per period.
16. Click en barra abre detalle abajo — pero el detalle es otra card con 3 stats — duplicación de info.
17. El detail card title incluye Tag del período (size grande) + texto rango.
18. Las 3 stats (Preguntas/Documentos/Producciones) idénticas en estilo — sin distinción.
19. Sin export.
20. Sin Empty state cuando todos los counts son 0.

### 20 ajustes funcionales / bugs
1. `chronological` excluye TRANS pero el sort no es cronológico real — es el orden de PERIOD_OPTIONS array.
2. `maxCount` = `Math.max(1, ...)` previene divide-by-zero — pero si todos los counts son 0, max=1 y todas las barras quedan al 0%.
3. Sin animación al seleccionar.
4. El `Link` a `/questions?periodo=CODE` puede no aplicar el filtro si el query parser no respeta el case del code.
5. Sin acción desde el detalle "ver documentos del período".
6. Sin tracking de cambios temporales (cómo creció X en el tiempo).
7. La data se carga una vez en `useEffect` — sin refresh button visible.
8. Sin paramétricos para visualizar otras métricas (docs/prods).
9. Click toggle (selected/null) — confuso si quieres comparar 2 periodos.
10. Sin multi-select.
11. Sin tooltip en el divider color.
12. El bar interior con `min-height: 4` y `height: ${max(4, heightPct)}%` — el % es del max, no de un absolute scale.
13. Sin export PNG/SVG.
14. Sin embed code.
15. Sin compare modo (dos timelines).
16. Sin zoom in.
17. Sin filtro de date range customizable.
18. Sin animation entry.
19. Sin keyboard nav (arrow left/right entre periodos).
20. Sin mostrar TRANS como bucket lateral.

### 10 cambios de experiencia
1. **Modo "river chart"**: stream graph estilo NYT con bandas por categoría.
2. **Brushing**: arrastrar para seleccionar rango y filter resto de la app.
3. **Eventos históricos clave**: superponer marcadores (1948 Bogotazo, 1991 Constitución).
4. **Sliders interactivos**: filtrar timeline a 1900‑1950.
5. **Animation play**: año por año revelar.
6. **Compare con otro corpus**.
7. **Embed/share**: link al período seleccionado.
8. **Audio narration**: descripción IA del período.
9. **Photos/Documents**: si hay imágenes del período, mostrarlas.
10. **Vista lineal sin barras**: timeline horizontal con events stamps.

---

## 21. `/graph` — Grafo de conexiones

Archivo: `src/app/graph/page.tsx`. SVG layout determinista por anillos.

### 20 mejoras visuales
1. Layout deterministic con anillos — predecible pero rígido; muchos nodos se solapan.
2. La SVG `viewBox 0 0 900 700` fija — no responsive bien en pantallas grandes.
3. `background: colorFillQuaternary` en SVG — apenas distingue del page bg.
4. Edges con `strokeWidth 0.5, strokeOpacity 0.3` — casi invisibles.
5. Edge highlighted `strokeWidth 1.8 colorPrimary` — destaca pero solo on hover.
6. Nodos: circles con `fillOpacity 0.75-0.85` — los colors saturan.
7. Tamaño de nodos varía por tipo: period 14, document 11, question 7+size, production 5 — diferencia pequeña.
8. Sin labels permanentes para questions/productions (solo on hover) — el grafo sin hover es ilegible.
9. Period/category labels siempre visibles, fontSize 10 — chicos para uno tan grande.
10. Sin agrupación visual por tipo (cluster).
11. Sin filtros por categoría/período (solo por tipo).
12. Sin búsqueda dentro del grafo.
13. Sin zoom/pan.
14. Sin export.
15. La card de "hovered node info" abajo del SVG — visible solo si hovered; aparece/desaparece sin animación.
16. El info card es chico, sin imagen/preview.
17. Sin minimap.
18. Sin contadores generales.
19. Sin leyenda completa (solo checkboxes con dot color, sin contar items por tipo).
20. Sin distinción visual entre nodos hubs (muchas connexiones) y leaves.

### 20 ajustes funcionales / bugs
1. `layoutNodes` se ejecuta en cada render que cambia filtered — costoso con 500 nodos.
2. `useMemo` ayuda, pero `productions.forEach((n) => positioned.set(...))` usa `Math.random` — non-deterministic, cada render mueve productions.
3. Los productions sin incoming edge se posicionan random por debajo del centro — desordena.
4. No hay collision detection — nodes se solapan cuando hay muchos.
5. El hover detection sin debounce — moveos rápidos lag.
6. `hoverConnected` recalcula en cada hover — O(E).
7. Sin keyboard nav.
8. Sin click action sobre nodo (solo hover muestra info).
9. El click del checkbox toggle filter — pero no preserve selection across.
10. Sin URL state.
11. Sin save de configuraciones.
12. Sin animation cuando cambia filter (sudden change).
13. `nodes.filter((n) => n.type === "period")` se itera 5 veces (uno por tipo) — inefficient.
14. Sin lazy load.
15. Sin chunking de edges (todos se renderizan).
16. SVG sin viewBox responsive a width — fijo 900x700, escalado por CSS.
17. Sin exportar el grafo a JSON.
18. Sin importar otro grafo.
19. Sin error handling si la API falla.
20. El `data.edges` filter por nodeIds — pero si nodos se eliminan, edges quedan.

### 10 cambios de experiencia
1. **Layout fuerza dinámico** (d3-force/cola): nodos se acomodan según peso.
2. **Click a navegar**: doc → /documents/id.
3. **Filtros multiples**: solo nodos con > N conexiones.
4. **Buscar y centrar** en un nodo.
5. **Highlight paths**: pregunta → producción → cita.
6. **Modo "vecindario"**: zoom a un nodo y sus conexiones.
7. **Time evolution**: animar grafo según fecha.
8. **Layout por categoría/período** togglable.
9. **Export grafo** SVG/PNG.
10. **Embed widget** para compartir.

---

## 22. `/coverage` — Heatmap de cobertura

Archivo: `src/app/coverage/page.tsx`. Tabla período×categoría.

### 20 mejoras visuales
1. Tabla HTML pura — diferente de Ant Table.
2. Headers con `writingMode: vertical-rl` + rotate(180) — vertical, pero los nombres largos se cortan.
3. Cells 38x38px con background degradado `${periodColor}xxx, ${categoryColor}xxx` — el gradient diagonal genera artefactos visuales.
4. La intensity opacity en hex `(intensity * 255).toString(16).padStart(2, "0")` — para values 0‑1, el resultado es opacidad 0 a ff — el "0" se ve igual que vacío.
5. Las celdas con count 0 tienen `border: 1px dashed` — buena distinction pero el dashed se ve débil.
6. El conteo de cada celda en mono blanco — `intensity > 0.5` blanco, else colorText — abrupto.
7. Sin escala visual (heatmap leyenda).
8. Headers de filas (categorías) con `borderLeft: 3px solid color` y `background: colorFillQuaternary` — se ven separados pero también pueden parecer celdas vacías.
9. El `borderSpacing: 4` entre celdas — bien, pero deja gaps entre la tabla y los headers.
10. Sin separación entre el segmented (questions/deliverables) y el heatmap.
11. La descripción "Las celdas vacías son lagunas…" se pierde.
12. La sección "Lagunas detectadas" abajo del heatmap muestra solo 30 Tags con border dashed — muchas y duplicadas.
13. Tags de lagunas con `background: transparent` — se ven sin fondo, contradictoriamente.
14. Sin filtros (filter by category, period range).
15. Sin export del heatmap.
16. Sin alternativa de visualización.
17. Min-width 1100px obliga scroll en pantallas medianas.
18. Sin animation al cambiar entre questions/deliverables.
19. Sin tooltip explicando la fórmula del color (períodoColor + categoryColor blended).
20. Sin scale slider (e.g. mostrar solo valores > 5).

### 20 ajustes funcionales / bugs
1. `cellMap` se calcula en useMemo OK, pero `maxVal` en otro useMemo — depend on cellMap, doble compute.
2. El gradient toHex `(intensity * 200)` para categoryColor — pero `200` vs `255` diferente — inconsistente.
3. La celda link `/questions?periodo=X&categoria=Y` aplica filtro pero la página puede no respetarlo.
4. Sin sort de filas/columnas (alfabético, por count).
5. Sin export CSV.
6. Sin print-friendly.
7. La "Lagunas detectadas" usa `gaps.slice(0, 30)` arbitrario.
8. Si gaps.length === 0, muestra "Cobertura completa" — pero podría haber filas/cols con count 1, vista incompleta.
9. Sin alert si una categoría/período tiene 0 contenido en todas las cells.
10. Sin filtros por categoría (mostrar solo CON, POL).
11. Sin filter por período range.
12. Sin sticky headers.
13. Sin highlight on hover row/col.
14. Sin keyboard nav (arrows entre celdas).
15. Sin click context menu en celda.
16. Sin batch action (generar preguntas para 5 lagunas).
17. Sin metric switch ("relative" — % of total per period).
18. Sin compare 2 períodos.
19. La paleta de gradientes no es accessible.
20. Sin label de filas/columnas resumen (total per row/col).

### 10 cambios de experiencia
1. **Click en celda → modal**: ver las preguntas/producciones, no solo redirect.
2. **Gap-filler AI**: botón "Generar preguntas para esta laguna".
3. **Multiple metrics**: switch entre questions, deliverables, completion ratio.
4. **Normalize**: row %, col %, global %.
5. **Compare two corpora**.
6. **Time slider**: cobertura al final de 2024 vs 2025.
7. **Goal setting**: meta de 10 preguntas por celda; mostrar progreso.
8. **Suggest categorías**: si una categoría está sobrerepresentada en un período, sugerir otra.
9. **Export visual** (PNG).
10. **Embed** en otra página.

---

## 23. `/entities` — Entidades

Archivo: `src/app/entities/page.tsx`. NER heurístico (regex sobre capitalizadas).

### 20 mejoras visuales
1. Alert "Implementación heurística" con disclaimer — bien informa, pero ocupa espacio.
2. Header con `UserOutlined` — el mismo icono que en otros contextos de "person".
3. La descripción menciona "tamaño = frecuencia" pero el `fontSize` varía de 12 a 24 — diferencia chica, poco visible.
4. Cards con `borderLeft: 3px solid typeColor` (indigo/green/violet) — los 3 tipos compitiendo.
5. Cada card muestra ícono + nombre (variable fontSize) + Tag con count — alignment Issues.
6. Tag count en `${typeColor}1A` background con `${typeColor}` text — apenas visible en dark.
7. "N docs · N pp" en gris 11px — pequeño.
8. Botón "Consultar →" link a `/chat?q=NOMBRE` — pero `?q=` no parece soportado en el chat.
9. Sin grouping por tipo en la lista.
10. Sin filter avanzado (rango de mentions).
11. Sin sort (alfabético/por mentions).
12. Sin visualización tipo cloud.
13. Sin connection graph entre entidades.
14. Sin lazy load de muchas entidades.
15. Sin avatar/imagen de entidades famosas.
16. Sin link al doc donde aparece más veces.
17. Sin sample chunk donde apareció.
18. Sin highlight en chunks de los documentos.
19. Sin badges para entidades muy frecuentes.
20. Sin time distribution (cuándo se menciona X).

### 20 ajustes funcionales / bugs
1. `/api/entities?limit=200&minMentions=3&sample=400` hardcoded — sin UI para ajustar.
2. La heurística NER es regex sobre capitalizadas — false positives masivos ("Por", "Como", "La" si capitalizan).
3. Sin disambiguation (Bolívar persona vs Bolívar lugar).
4. Sin merge de variantes ("Simón Bolívar", "S. Bolívar", "el Libertador").
5. Sin filter por document.
6. Sin filter por period.
7. Search local sin fuzzy.
8. Sin lazy load — todos los 200 a la vez.
9. `maxMentions` calc no respeta filter — siempre el max global.
10. Sin pagination.
11. Sin sort options.
12. Sin export.
13. Sin link "ver chunks donde aparece".
14. Sin link a una página "entidad/[name]".
15. Sin distinción entre entidad y mention (poly-noun).
16. La heurística no detecta acentos correctamente — "Bolivar" vs "Bolívar".
17. Sin caching client-side.
18. Sin diff cuando recargas.
19. Sin batch action "merge selected".
20. Sin sort by docCount o pageCount.

### 10 cambios de experiencia
1. **Integrar NER real**: spaCy es o Claude prompt structured.
2. **Página por entidad**: timeline de menciones, docs donde aparece, citas relevantes.
3. **Knowledge graph**: relaciones entre entidades (Bolívar — Santander — Páez).
4. **Entity disambiguation UI**: el usuario corrige merges manualmente.
5. **Add entity manually**.
6. **Translation**: nombres en otros idiomas.
7. **Filter por tipo + período + categoría combinado**.
8. **Wordcloud visualization**.
9. **Search en doc por entidad**.
10. **Exportar lista a CSV/JSON**.

---

## Anexos rápidos

### Issues a nivel API/datos (afectan UI pero no son strictly UI)
- Múltiples endpoints (`/api/dashboard`, `/api/timeline`, `/api/coverage`) cargan datos similares — un dataset unificado evitaría inconsistencias.
- `Math.random()` para IDs en localStorage (threads/workspaces) no es robusto si se sincroniza con cloud en el futuro.
- Las 3 vistas con datos persistentes en `localStorage` (threads/workspaces/sider/theme) no comparten un wrapper común — fácil colisión de keys.

### Mejoras visuales accesibles y de marca
- Diseñar un sistema de iconos exclusivo (mark) en vez de Ant icons genéricos.
- Crear escala tipográfica explícita (12/13/14/16/20/24/32) y banearlos como tokens — hoy hay inline `fontSize: 11, 12.5, 13.5, 14.5` etc.
- Definir spacing scale (4/8/12/16/24/32) y ocupar tokens en lugar de números mágicos.
- Auditar contraste (WCAG AA) — varios casos detectados arriba (selected en dark, tags `color1A`, etc.).

### Quick wins (1 día)
1. Arreglar el `position: sticky` del header (`overflow: clip` en `<Layout>` interno o un `top: 0` con `z-index` mayor).
2. `selectedKey` del menú aceptar rutas anidadas (`/questions/matriz`, `/questions/generate`).
3. `ROUTE_LABELS` con regex para ids dinámicos → breadcrumb útil.
4. Locale dayjs a `es` global.
5. Reset `setPage(1)` al cambiar filtros en todas las páginas listas.
6. Mover descripciones largas debajo del header como `Alert` colapsable.
7. Hacer `setProgress` con functional update consistente.
8. Cleanup intervals en unmount en todas las páginas (chat, hypothesis, compare, document detail, production detail).
9. Add `URLSearchParams` state persist a `/documents`, `/questions`, `/producciones`.
10. Standardize `Empty image` a uno propio.

### Quick wins (1 semana)
1. Diseñar tema "Académico oscuro" (sepia profundo) y switch en theme provider.
2. Build "global activity widget" (toast persistente) para procesos largos.
3. Implementar polling cross-page con SSE/WS para producciones en GENERATING.
4. NER real para `/entities`.
5. Cobertura percent‑normalize en `/coverage`.
6. Cancel buttons en operaciones largas.
7. Export PDF de producciones con mejor render (CSS print).
8. Sincronización opcional localStorage → cloud (threads/workspaces).
9. Bulk selection y bulk ops en `/documents`, `/questions`, `/producciones`.
10. Keyboard shortcuts (`g d`, `g c`, `n`, `?`).

---

> **Total de hallazgos**: ≈ 50 × 23 = **1.150 ítems**. Priorización: corregir primero los **transversales** (shell, theming, sticky header, breadcrumb dinámico, persistencia de filtros vía URL) — eso resuelve decenas de ítems "duplicados" en páginas individuales.
