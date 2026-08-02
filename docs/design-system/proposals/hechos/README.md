# Rediseño de Hechos — propuesta visual

Estado: **propuesta aprobada e implementada localmente**. El rediseño todavía no ha sido desplegado a producción.

## PNG de referencia

- `hechos-index-v1.png`: índice de hechos organizado como una edición histórica navegable.
- `hecho-detail-v1.png`: desarrollo completo de la ficha individual de un hecho.

## PNG de la implementación

- `implementation/hechos-index-desktop.png`
- `implementation/hechos-index-mobile.png`
- `implementation/hecho-detail-desktop.png`
- `implementation/hecho-detail-mobile.png`
- `implementation/hecho-detail-causalidad.png`
- `implementation/hecho-detail-documentos.png`

## Decisiones representadas

- El selector de épocas reutiliza la anatomía editorial de la portada.
- Todos los hechos visibles tienen imagen.
- El índice combina panorama de época, recorrido cronológico y exploración progresiva.
- La ficha desarrolla síntesis, causalidad, artículo, contexto, relaciones y navegación anterior/siguiente.
- Los documentos se representan exclusivamente como referencias bibliográficas de texto, sin portadas ni miniaturas inventadas.

## Comparación de fidelidad

1. **Selector histórico:** conserva las quince columnas de la portada, color por época, estado activo y navegación horizontal móvil; la época activa se centra automáticamente.
2. **Índice editorial:** conserva panorama, secuencia visual, hecho principal, tarjetas de tamaños distintos y revelado progresivo; no vuelve a la cuadrícula uniforme anterior.
3. **Imágenes de hechos:** la muestra real no produce fallbacks y todas las tarjetas visibles mantienen una imagen. Las miniaturas se solicitan a tamaños responsivos.
4. **Desarrollo del hecho:** conserva cabecera, síntesis, causas → hecho → consecuencias, importancia, lectura larga con índice, cronología de época, entidades, mapa, bibliografía y anterior/siguiente.
5. **Documentos:** se muestran como bibliografía textual agrupada por identidad bibliográfica. En la muestra de Gaitán son 50 documentos y 81 fragmentos, con cero imágenes documentales.
6. **Responsive:** comprobado a 1440 × 1100 y 390 × 844; ambas rutas mantienen `scrollWidth` dentro del viewport. El selector y el índice de lectura tienen desplazamiento propio.

### Diferencias deliberadas frente al concepto

- El mapa es el componente cartográfico real del producto y se carga sólo al acercarse al viewport; no es una ilustración estática.
- La bibliografía no inventa categorías documentales que el corpus no tenga. Agrupa por título, autor y año y permite abrir los fragmentos citados.
- `/hechos` abre por defecto el archivo completo. El estado seleccionado de la propuesta se reproduce con `?periodo=VIO` y con cualquier otra época disponible.

### Copy sobre el primer pliegue

| Superficie | Referencia | Implementación |
|---|---|---|
| Índice | “Hechos” + archivo navegable por épocas | Conserva “Hechos” y explicita época, protagonistas y documentos reales |
| Detalle | Título, bajante y fecha del hecho | Usa literalmente el título, resumen y fecha publicados en `structuredData` |
| Fuentes | Documentos sin imágenes | “Documentos y fragmentos citados”, con conteos derivados del corpus |

## Puerta antes de producción

TypeScript, lint, las pruebas del repositorio, el build de Next.js y la revisión en navegador ya pasan localmente. Producción requiere una autorización separada y, después del deploy, comprobación pública de ambas rutas.
