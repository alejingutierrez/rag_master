/**
 * Convierte filenames de la biblioteca a citas en formato APA.
 *
 * Patrones comunes en el corpus:
 *   "(Biblioteca IEPRI 25 años) Francisco Gutiérrez Sanín - El orangután con sacoleva_ cien años de democracia y represión en Colombia (1910-2010)-Editorial Debate, Biblioteca IEPRI (2014).pdf"
 *   "Steven Dudley - Walking Ghosts_ Murder and Guerrilla Politics in Colombia-Routledge (2003).pdf"
 *   "Oscar Alarcón - Los López en la historia de Colombia-Planeta Colombia (2022).pdf"
 *   "Todo-paso-frente-a-nuestros-2021.pdf"
 *   "FINAL CEV_HALLAZGOS_DIGITAL_2022.pdf"
 *
 * Estrategia: extracción tolerante con varias heurísticas.
 */

export interface ApaCitation {
  author: string;       // "Apellido, N." o "Institución"
  year: string;         // "2014" o "s.f." si no se encuentra
  title: string;        // "El orangután con sacoleva..."
  publisher?: string;   // "Editorial Debate"
  raw: string;          // filename original (debug)
}

/**
 * Limpia nombre quitando colecciones, prefijos y números iniciales.
 */
function stripFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/^[\d._-]+/, "")  // prefijos numéricos como "13. " o "2.-"
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae año de un string buscando patrones (1900-2099)
 */
function extractYear(s: string): string {
  const matches = s.match(/\b(1[89]\d{2}|20\d{2})\b/g);
  if (!matches) return "s.f.";
  // Si hay varios años, tomar el último (típicamente año de publicación)
  return matches[matches.length - 1];
}

/**
 * Formatea autor desde "Nombre Apellido" → "Apellido, N."
 * Maneja casos: "Steven Dudley", "Francisco Gutiérrez Sanín", "Iván Cepeda y Jorge Rojas"
 */
function formatAuthor(rawAuthor: string): string {
  // Múltiples autores separados por "y" o ","
  const parts = rawAuthor
    .split(/\s+(?:y|&|,\s*y)\s+|,\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    // Lista de autores
    return parts.map(formatSingleAuthor).join("; ");
  }

  return formatSingleAuthor(parts[0] || rawAuthor);
}

function formatSingleAuthor(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return name;
  if (tokens.length === 1) return tokens[0];

  // Asumir: nombres primero, apellido(s) último(s). 1-2 apellidos.
  // Heurística: si último tiene >= 3 letras y empieza mayúscula, es apellido.
  // Si hay 4 tokens "Nombre1 Nombre2 Apellido1 Apellido2", apellido = últimos 2.
  let lastNamesCount = 1;
  if (tokens.length >= 4) lastNamesCount = 2;

  const lastNames = tokens.slice(-lastNamesCount).join(" ");
  const firstNames = tokens.slice(0, -lastNamesCount);
  const initials = firstNames.map((n) => `${n[0]}.`).join(" ");

  return `${lastNames}, ${initials}`;
}

/**
 * Detecta si el filename parece un documento institucional (sin autor obvio).
 */
function isInstitutional(filename: string): boolean {
  // ALL CAPS prolongado, código numérico, prefijos como "CEV_"
  return (
    /^[A-Z0-9_-]{8,}\.pdf$/i.test(filename) ||
    /^CEV_|^Tomo|^FINAL/i.test(filename) ||
    /^Bo[jp]ay[áa]/i.test(filename) ||
    /^\d{10,}/.test(filename)
  );
}

/**
 * Mapea filenames "institucionales" a instituciones conocidas.
 */
function guessInstitution(filename: string): string {
  if (/CEV_/i.test(filename)) return "Comisión de la Verdad de Colombia";
  if (/^Tomo[\s-]/i.test(filename)) return "Comisión de la Verdad de Colombia";
  if (/Bo[jp]ay[áa]/i.test(filename)) return "Centro Nacional de Memoria Histórica";
  if (/Todo[\s-]paso/i.test(filename)) return "Centro Nacional de Memoria Histórica";
  if (/Hacer[\s-]la[\s-]guerra/i.test(filename)) return "Centro Nacional de Memoria Histórica";
  return "Autor institucional";
}

/**
 * Convierte un filename a una cita APA.
 */
export function filenameToApa(filename: string): ApaCitation {
  const clean = stripFilename(filename);
  const year = extractYear(filename); // buscar en el original (puede tener números removidos por strip)

  // Patrón principal: "Autor - Título-Editorial (año).pdf"
  // o "(Colección) Autor - Título-Editorial (año).pdf"
  const patternFull = /^(?:\([^)]+\)\s+)?([^-]+?)\s+-\s+(.+?)(?:-([^()]+?))?\s*(?:\(\d{4}\))?$/;

  // Quitar colección al inicio entre paréntesis
  const noCollection = clean.replace(/^\([^)]+\)\s+/, "");

  const match = noCollection.match(/^([^-]+?)\s+-\s+(.+?)(?:-([^-]+?))?\s*\(\d{4}\)$/);

  if (match) {
    const [, author, title, publisher] = match;
    return {
      author: formatAuthor(author),
      year,
      title: title.trim().replace(/_/g, ": "),
      publisher: publisher?.trim(),
      raw: filename,
    };
  }

  // Patrón sin año al final
  const match2 = noCollection.match(/^([^-]+?)\s+-\s+(.+?)(?:-(.+))?$/);
  if (match2) {
    const [, author, title, publisher] = match2;
    return {
      author: formatAuthor(author),
      year,
      title: title.trim().replace(/_/g, ": "),
      publisher: publisher?.trim(),
      raw: filename,
    };
  }

  // Institucional: sin autor obvio
  if (isInstitutional(filename)) {
    return {
      author: guessInstitution(filename),
      year,
      title: clean
        .replace(/^\([^)]+\)\s+/, "")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      raw: filename,
    };
  }

  // Fallback: usar el nombre limpio como título
  return {
    author: "Anónimo",
    year,
    title: clean,
    raw: filename,
  };
}

/**
 * Formato APA 7: Autor, A. (año). Título. Editorial.
 */
export function formatApaEntry(c: ApaCitation): string {
  const parts: string[] = [];
  parts.push(`${c.author} (${c.year}).`);
  parts.push(`*${c.title}*.`);
  if (c.publisher) {
    parts.push(`${c.publisher}.`);
  }
  return parts.join(" ");
}

/**
 * Recibe una lista de chunks (con documentFilename + pageNumber) y devuelve
 * una sección "## Referencias" en formato APA, de-duplicada por documento.
 */
export function buildReferencesSection(
  chunks: Array<{ documentFilename?: string; pageNumber: number }>
): string {
  const seen = new Map<string, { citation: ApaCitation; pages: Set<number> }>();
  for (const c of chunks) {
    if (!c.documentFilename) continue;
    if (!seen.has(c.documentFilename)) {
      seen.set(c.documentFilename, {
        citation: filenameToApa(c.documentFilename),
        pages: new Set(),
      });
    }
    seen.get(c.documentFilename)!.pages.add(c.pageNumber);
  }

  if (seen.size === 0) return "";

  // Ordenar por autor alfabéticamente (norma APA)
  const sorted = Array.from(seen.values()).sort((a, b) =>
    a.citation.author.localeCompare(b.citation.author)
  );

  const lines = ["", "---", "", "## Referencias", ""];
  for (const entry of sorted) {
    lines.push(formatApaEntry(entry.citation));
    lines.push("");
  }

  return lines.join("\n");
}
