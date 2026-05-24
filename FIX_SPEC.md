# FIX_SPEC — Plan de remediación de UX_AUDIT

> Spec ejecutable derivado de `UX_AUDIT.md`. Resuelve primero **transversales** (1 cambio → decenas de issues resueltos), luego bugs críticos por página, luego mejoras de experiencia.
>
> Convención: cada ítem tiene **(F)** funcional, **(V)** visual, **(X)** experiencia.

## Fases

### Fase 1 — Transversales (shell, layout, theme, runtime)

1. **Sticky header roto al scroll** (F).
   - Síntoma: al hacer scroll, el header `position: sticky` aparece al fondo del viewport.
   - Causa: el `<Layout>` interno hijo del root es flex column con altura igual a su contenido, y el sticky calcula su offset relativo a su contenedor flex; al desbordar la página, queda atrapado.
   - Fix: convertir el header en `position: fixed` con left/right calculados desde el sider width, o forzar `min-height: 100vh` y `align-self: stretch` correcto. Implementación elegida: layout columnar con header SIN sticky pero como hijo directo del body flex via wrapper, controlado vía CSS variables.
   - Test: scroll 2000px en dashboard, verificar header siempre arriba.

2. **`selectedKey` no resalta rutas anidadas** (F).
   - `/questions/matriz` y `/questions/generate` no marcan `Preguntas` en sider.
   - Fix: el matching ya hace `pathname.startsWith(k + "/")` — el problema es que `ROUTE_LABELS` incluye keys hijas más largas (`/questions/matriz`) que no existen en `PRIMARY_NAV`. Filtrar candidates de `selectedKey` solo contra rutas que EXISTEN en `PRIMARY_NAV.children`.

3. **Breadcrumb muestra ids truncados** (F).
   - `/documents/[id]` → "Inicio / Documentos / e4a1c2b9…"
   - Fix: detectar segmentos cuyo padre es una ruta dinámica conocida y mostrar "Detalle" o el título del recurso si está en cache.

4. **dayjs no localizado a ES** (V).
   - "DD MMM" muestra "May" en lugar de "may".
   - Fix: importar `dayjs/locale/es` en un módulo singleton y configurar al cargar app.

5. **Cleanup de intervals en todas las páginas** (F).
   - chat/page.tsx, hypothesis/page.tsx, compare/page.tsx, documents/[id]/page.tsx, producciones/[id]/page.tsx, documents/page.tsx (auto-refresh).
   - Fix: añadir `AbortController` en fetches y cleanup en useEffect return.

6. **Filtros sin persistencia en URL** (F).
   - `/documents`, `/questions`, `/producciones` filtros se pierden al refrescar.
   - Fix: hook `useUrlState` que sincronice query params con state.

7. **Empty states inconsistentes** (V).
   - `Empty.PRESENTED_IMAGE_SIMPLE` usado por todos lados, genérico.
   - Fix: componente `<EmptyAcademic>` con icono propio del corpus + CTA contextual.

8. **CommandPalette: label "Sistema de hipótesis" ≠ sider "Hipótesis"** (F).
   - Fix: alinear labels.

9. **localStorage sin try/catch en threads/workspaces** (F).
   - Fix: helper `safeJSONStorage` con try/catch + quota detection.

10. **Sider `overflowX: hidden`** corta indicador selected (V).
    - Fix: usar `overflow: hidden auto` solo en eje Y.

11. **Race con `mode='auto'` theme + flash** (F).
    - Fix: leer el theme en script blocking en `<head>` antes del hydrate o usar `next-themes`-style cookie.

12. **`completionPct` puede exceder 100%** (F).
    - Fix: `Math.min(100, …)`.

13. **`enrichmentPct` accede `data!.stats` con bang sobre potencial null** (F).
    - Fix: nullguard.

14. **`deltas7d` undefined puede romper render** (F).
    - Fix: defaults a 0.

15. **`Empty image` propio + estilo académico** (V).

16. **Sider colapsable: persist tab-correct + mobile-default-collapsed** (X).

17. **Token CSS de spacing/typography como source of truth** (V).
    - Fix: `--space-*`, `--text-*` en globals.css y usarlas en lugar de px inline.

18. **`getDocumentDisplayName` se llama muchas veces por render** (F).
    - Fix: memoización a nivel de fila.

19. **Auto-refresh genérico en `/documents` no respeta enrich** (F).
    - Fix: refresh también si hay un enrich en curso.

20. **Atajos globales mínimos** (X).
    - `?` abre ayuda, `g d`, `g c`, `g h`, `n` crear, `/` search.

### Fase 2 — Bugs críticos por página

Solo los **5 más graves por página** (la lista completa está en `UX_AUDIT.md`).

#### `/` Inicio
- Errores 4xx/5xx silenciosos del dashboard API.
- Clamp 0..100 en porcentajes.
- Border-left 2px → 3px en preguntas/producciones recientes.
- Recents sin nombre humano del template.
- Excluir TRANS de "Períodos cubiertos".

#### `/upload`
- Warning sobre archivos grandes antes de hash.
- AbortController real al "Detener".
- Polling timeout que NO marca success si no terminó.
- Link "Abrir documento" al completar.
- Persistir progreso para evitar pérdida en refresh.

#### `/documents`
- Search remoto (parametro `search` al backend) en lugar de local.
- Search insensible a acentos.
- Reset paginación al cambiar filtro.
- URL state.
- Bulk select básico (eliminar masivo).

#### `/documents/[id]`
- 404 handling.
- Persist reading mode local.
- Botón "Volver" robusto (fallback a `/documents` si no hay history).
- Sin tab "Reading" si 0 chunks.
- Botón "Generar bibliografía" en detail.

#### `/enrich`
- Batch enrich en paralelo controlado (Promise.all + concurrency).
- Confirmación al sobrescribir metadata existente.
- Sync URL state.
- Multi-select.
- Save shortcut Cmd+S.

#### `/chat`
- Throttle de scroll durante streaming.
- AbortController para poll y typewriter.
- Persist selected template.
- Historial visible (drawer izquierdo con últimos chats).
- Mensaje de error con detail.

#### `/deep-research`
- Botón cancelar.
- Persist research (auto-save como producción).
- Validation antes de fetch.
- Stream parser robusto a chunks partidos.

#### `/hypothesis`
- Loading state global atado al estado de ambas columnas.
- Save as production.
- Re-run lado individual.
- Mostrar la hipótesis arriba de los resultados.

#### `/questions`
- URL state.
- Debounce search.
- Sticky group header sin solape.
- Bulk select.
- `?focus=id` abre la pregunta.

#### `/questions/matriz`
- Polling tras submit.
- Freeze primera columna en scroll horizontal.
- Filters por categoría/periodo.
- Cancel batch.

#### `/questions/generate`
- Limit en API `/api/documents/{id}/questions` para reducir Promise.all de 300 reqs.
- Detener.
- Tiempo estimado.
- Re-run parcial.

#### `/threads` y `/threads/[id]`
- Try/catch en localStorage.
- Reorder steps (drag).
- Sin confirmación destructive on click.
- Undo.

#### `/workspaces` y `/workspaces/[id]`
- Try/catch.
- Avisar cambios sin guardar (notes).
- Multi-select pin.
- Filter por nombre.

#### `/producciones`
- Polling de items en GENERATING.
- Search remote.
- URL state.
- Bulk.

#### `/producciones/[id]`
- Hover preview en citas (no abrir drawer entero).
- Progress en GENERATING.
- Print CSS.

#### `/compare`
- AbortController por columna.
- Persist URL.
- Hasta 5 templates (no 3).
- Combine mode.

#### `/bibliography`
- Filtros (autor/año).
- Search.
- Numeración.
- Export DOCX/PDF.

#### `/timeline`
- Multi-period selection.
- Toggle métrica.
- Animation entry.

#### `/graph`
- Click navega.
- URL state.
- Zoom/pan (al menos básico).

#### `/coverage`
- Click en celda → modal con preguntas.
- Sticky headers.
- Sort.

#### `/entities`
- Pagination/lazy.
- Reset filtros.
- Link a chunks.
- Sort options.

### Fase 3 — Experiencia
- **Activity widget global**: toast persistente para procesos largos.
- **Modo lectura**: keyboard `f` hide sider+header.
- **Keyboard shortcuts** globales.
- **Bulk operations** estandarizadas (componente reusable).

### Fase 4 — Build, test, deploy
- `npm run build` debe pasar.
- Browser smoke test en `/`, `/documents`, `/chat`.
- `git add` + `git commit` por fase.
- `git push origin main` que dispara Amplify deploy.

## Acceptance criteria

- Sin errores TS en build.
- Sin errores en consola browser al cargar `/`.
- Sticky header se mantiene arriba al scroll.
- Filtros persisten al refrescar `/documents`.
- dayjs muestra "may" no "May".
- Intervals limpian al unmount (no leaks).
- Empty state coherente.

## Out of scope (mantener en backlog)

- NER profesional (entities).
- Sync localStorage → cloud (threads/workspaces).
- Diseño de iconografía custom.
- Comparar entre modelos (Claude vs GPT).
- Activity widget verdaderamente cross-page con WebSocket — versión limitada para esta tanda.
- Tests automatizados (no hay infra de Jest/Playwright montada).
