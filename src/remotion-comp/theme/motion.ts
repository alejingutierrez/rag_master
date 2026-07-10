/**
 * Vocabulario de movimiento — las curvas y progresiones que comparten todas las
 * escenas. Esto ES la "misma linea grafica" en movimiento: cualquier layout usa
 * estas mismas primitivas, y el Director solo cambia el orden y los tiempos.
 */
import { interpolate, Easing } from "remotion";

/** salida tipo out-expo: entra rapido, asienta suave (como el prototipo) */
export const eOut = Easing.bezier(0.16, 1, 0.3, 1);
export const eInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** progreso 0..1 de un reveal que empieza en `delay` y dura `dur` frames */
export function prog(frame: number, delay: number, dur = 32) {
  return interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: eOut,
  });
}

/** opacidad de crossfade de una escena dentro de su Sequence local */
export function crossfade(frame: number, total: number, fade = 12) {
  const enter = interpolate(frame, [0, fade], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: eInOut,
  });
  const exit = interpolate(frame, [total - fade, total], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: eInOut,
  });
  return Math.min(enter, exit);
}

/** conteo de una cifra de 0 a `value`, con salida suave */
export function countTo(frame: number, value: number, delay = 8, dur = 34) {
  const p = interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return Math.round(value * p);
}
