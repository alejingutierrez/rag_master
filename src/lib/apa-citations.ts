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
 *
 * Soporta múltiples patrones reales del corpus:
 *   1. "Autor - Título-Editorial (año).pdf"                      ej. Steven Dudley - Walking Ghosts-Routledge (2003)
 *   2. "(Colección) Autor - Título-Editorial (año).pdf"          ej. (Biblioteca IEPRI) Francisco Gutiérrez - ...
 *   3. "Título (Autor) (Z-Library).pdf"                          ej. El terrorismo de Estado en Colombia (Hernando Calvo Ospina) (Z-Library)
 *   4. "Título (Autor1 y Autor2) (Z-Library).pdf"
 *   5. "ApellidoNombreI_AÑO_Capítulo_título.pdf"                 ej. DePablosAndrésF_2017_I.Elgobiernodelapazyl_Testigosolvidados.Per
 *   6. "Filename-con-guiones-año.pdf"                            ej. Todo-paso-frente-a-nuestros-2021
 *   7. Otros: institucional / anónimo / con código numérico
 */
export function filenameToApa(filename: string): ApaCitation {
  const clean = stripFilename(filename);
  const year = extractYear(filename);

  // Limpiar "(Z-Library)" y similares — no son parte del título
  const noZLib = clean.replace(/\s*\(Z-Library\)\s*/gi, "").trim();

  // Quitar colección al inicio entre paréntesis (ej. "(Biblioteca IEPRI 25 años) ...")
  const noCollection = noZLib.replace(/^\([^)]+\)\s+/, "");

  // ── Patrón 1+2: "Autor - Título-Editorial (año)" ────────────
  const m1 = noCollection.match(/^([^-]+?)\s+-\s+(.+?)(?:-([^-]+?))?\s*\(\d{4}\)$/);
  if (m1) {
    const [, author, title, publisher] = m1;
    if (looksLikeAuthor(author)) {
      return {
        author: formatAuthor(author),
        year,
        title: cleanTitle(title),
        publisher: publisher?.trim(),
        raw: filename,
      };
    }
  }

  // ── Patrón 3+4: "Título (Autor) (Z-Library)" — autor en paréntesis al final ──
  // Buscar el ÚLTIMO paréntesis no vacío en el noZLib clean
  // Ya removimos (Z-Library), así que el último ( ) suele ser el autor
  const parenMatches = [...noZLib.matchAll(/\(([^)]+)\)/g)];
  const lastParen = parenMatches[parenMatches.length - 1];
  if (lastParen && looksLikeAuthor(lastParen[1]) && lastParen.index !== undefined) {
    const authorRaw = lastParen[1];
    const titleRaw = noZLib.slice(0, lastParen.index).trim();
    if (titleRaw.length > 5) {
      return {
        author: formatAuthor(authorRaw),
        year,
        title: cleanTitle(titleRaw),
        raw: filename,
      };
    }
  }

  // ── Patrón 5: "ApellidoNombreI_AÑO_..._..." con underscores ──
  // Heurística: empieza con palabra que tiene mayúsculas internas + año + _ + título
  const m5 = clean.match(/^([A-Z][a-zA-ZáéíóúÁÉÍÓÚñÑ]+?(?:[A-Z][a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*?)[\s_]+(\d{4})[\s_]+(.+)$/);
  if (m5) {
    const [, authorCompact, yearFromName, rest] = m5;
    return {
      author: expandCompactAuthor(authorCompact),
      year: yearFromName,
      title: cleanTitle(rest),
      raw: filename,
    };
  }

  // ── Institucional ──
  if (isInstitutional(filename)) {
    return {
      author: guessInstitution(filename),
      year,
      title: cleanTitle(clean),
      raw: filename,
    };
  }

  // ── Fallback: título como nombre limpio, año si lo encontramos ──
  return {
    author: "Autor desconocido",
    year,
    title: cleanTitle(clean),
    raw: filename,
  };
}

/**
 * Limpia título: quita _, normaliza espacios, no incluye paréntesis vacíos.
 */
function cleanTitle(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\s*\([^)]*Library[^)]*\)\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\(\d{4}\)\s*$/, "") // quitar (año) trailing
    .replace(/\s+-\s+/g, " — ")     // guiones tipográficos
    .trim();
}

/**
 * Heurística: ¿parece un nombre de autor?
 * Acepta: "Nombre Apellido" / "Inicial Apellido" / "Nombre Apellido y Nombre Apellido"
 * Rechaza: títulos largos, frases con artículos como "El", "La", "Una"
 */
function looksLikeAuthor(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || t.length > 100) return false;
  // Si tiene demasiadas palabras (>6), es probable que sea un título
  const words = t.split(/\s+/);
  if (words.length > 8) return false;
  // Si empieza con artículo o palabras comunes de título → no es autor
  if (/^(El|La|Los|Las|Un|Una|De|En|Por|Para|Con|Sin|Sobre|Hacia|Hasta|Cómo|Qué|Quién|Cuándo|Por qué|This|The|A|An|How|What)\b/i.test(t)) {
    return false;
  }
  // Debe tener al menos una palabra que empiece con mayúscula
  if (!/[A-ZÁÉÍÓÚÑ]/.test(t)) return false;
  // No debe tener números (años, citas, etc) excepto cuando son iniciales
  if (/\d{2,}/.test(t)) return false;
  return true;
}

/**
 * Expande autor "DePablosAndrésF" → "De Pablos, A. F."
 * Heurística: divide en mayúsculas, primera parte es Apellido, resto son iniciales.
 */
function expandCompactAuthor(compact: string): string {
  // Insertar espacios antes de cada mayúscula
  const split = compact.replace(/([A-Z])/g, " $1").trim().split(/\s+/);
  if (split.length === 0) return compact;
  if (split.length === 1) return split[0];
  // Primera palabra = apellido (puede tener prefijo como "De")
  // Si la primera tiene <3 chars, asumir que es preposición y unirla
  let lastName = split[0];
  let i = 1;
  if (lastName.length <= 2 && split.length > 2) {
    lastName += " " + split[i];
    i++;
  }
  const firstName = split[i] || "";
  const middleInitials = split.slice(i + 1).map((p) => `${p[0]}.`).join(" ");
  if (firstName && middleInitials) {
    return `${lastName}, ${firstName[0]}. ${middleInitials}`;
  }
  if (firstName) {
    return `${lastName}, ${firstName[0]}.`;
  }
  return lastName;
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

/**
 * Deja una sola sección de bibliografía al final del texto.
 *
 * Síntoma original: el modelo escribe su propia "## Bibliografía"/"## Referencias"
 * a pesar de que el prompt lo prohíbe, y el sistema añade además su sección APA
 * generada de los chunks → aparecen dos secciones consecutivas.
 *
 * Estrategia: si hay >1 ocurrencias de encabezados bibliográficos, conservar
 * solo la última (la del sistema, que es la confiable) y purgar las anteriores
 * junto con el contenido que les sigue.
 */
export function stripDuplicateBibliography(text: string): string {
  const headerRegex = /^##\s+(Referencias|Bibliograf[íi]a|Fuentes|Bibliography|References)\s*$/gim;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(text)) !== null) positions.push(m.index);
  if (positions.length <= 1) return text;

  const lastPos = positions[positions.length - 1];
  const firstPos = positions[0];

  // Texto antes de la primera bibliografía (ensayo limpio) +
  // separador estándar +
  // texto desde la última bibliografía (la del sistema).
  let before = text.slice(0, firstPos).trimEnd();
  // Si lo último antes de la bibliografía es un separador "---", quitarlo
  // (la APA del sistema trae su propio "---" delante).
  before = before.replace(/\n*-{3,}\s*$/g, "").trimEnd();
  const after = text.slice(lastPos).trim();
  return `${before}\n\n---\n\n${after}\n`;
}
