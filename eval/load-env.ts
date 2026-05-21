/**
 * Carga variables de entorno desde .env al inicio del proceso.
 * Importar AL INICIO de cualquier script eval/script standalone:
 *   import "./load-env";  // antes de cualquier otro import que use process.env
 *
 * Necesario porque tsx no carga .env automáticamente.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Buscar .env en este directorio y subir hasta encontrarlo
let dir = __dirname;
let envPath: string | null = null;
for (let i = 0; i < 5; i++) {
  const candidate = resolve(dir, ".env");
  if (existsSync(candidate)) {
    envPath = candidate;
    break;
  }
  dir = resolve(dir, "..");
}

if (envPath) {
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Remover quotes si existen
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
