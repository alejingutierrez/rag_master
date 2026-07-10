/**
 * Las tres fuentes del sistema, cargadas de forma determinista para el render
 * headless. @remotion/google-fonts maneja delayRender internamente.
 * Cargamos pocos pesos y solo el subset "latin" (cubre acentos y ñ del español)
 * para minimizar peticiones de red durante el render.
 */
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const common = { subsets: ["latin"] as ("latin" | "latin-ext")[], ignoreTooManyRequestsWarning: true };

const serif = loadSerif("normal", { weights: ["400"], ...common });
loadSerif("italic", { weights: ["400"], ...common });
const sans = loadSans("normal", { weights: ["400", "500", "600"], ...common });
const mono = loadMono("normal", { weights: ["400", "500"], ...common });

export const FONT = {
  display: serif.fontFamily, // "Instrument Serif"
  sans: sans.fontFamily,     // "DM Sans"
  mono: mono.fontFamily,     // "JetBrains Mono"
};
