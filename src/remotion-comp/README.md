# Componentes de composición (copia para @remotion/player)

Copia de `remotion/src/{video,theme,score}` para que el app Next (el Player del
admin) resuelva la MISMA copia de `remotion` que `@remotion/player` (evita el
error "No video config found" por doble instancia de remotion).

⚠️ MANTENER EN SYNC con `remotion/src/` — al cambiar el motor, copiar de nuevo:
`cp -r remotion/src/{video,theme,score} src/remotion-comp/`

El render por CLI/Lambda usa `remotion/src` (su propio node_modules). Consolidar
en un solo lugar es trabajo pendiente (hoisting de remotion al root).
