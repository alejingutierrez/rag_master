// Polyfills para Lambda: pdfjs-dist (usado por pdf-parse) necesita estas
// APIs del DOM que no existen en Node.js/Lambda.
// instrumentation.ts se ejecuta al startup del servidor, ANTES de cargar
// cualquier ruta o módulo externo.

export async function register() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    // @ts-expect-error polyfill mínimo — pdfjs-dist solo necesita el constructor
    globalThis.DOMMatrix = class DOMMatrix {
      constructor() {
        return Object.create(null);
      }
    };
  }
  if (typeof globalThis.Path2D === "undefined") {
    // @ts-expect-error polyfill mínimo
    globalThis.Path2D = class Path2D {};
  }
}
