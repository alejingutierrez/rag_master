import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { awsConfig } from "./aws-config";
import { withBedrockSemaphore } from "./bedrock-semaphore";

// Cliente dedicado con timeout extendido (10 min). El default global de
// aws-config es 180s, suficiente para chat normal pero NO para esta tarea:
// con los campos extendidos (yearPrincipal + yearsSecondary + 12 entidades por
// pregunta) Opus 4.7 puede tardar 3-6 min en producir 60+ preguntas via tool use.
// Sin este override el SDK aborta silenciosamente y el stream queda colgado.
const bedrock = new BedrockRuntimeClient({
  ...awsConfig,
  requestHandler: new NodeHttpHandler({
    requestTimeout: 600_000,
    connectionTimeout: 10_000,
  }),
});

// Modelo para generación de preguntas.
// Siempre Opus 4.7 — el usuario quiere máxima calidad para esta tarea crítica.
// Override con BEDROCK_QUESTIONS_MODEL_ID solo para experimentación.
const QUESTIONS_MODEL =
  process.env.BEDROCK_QUESTIONS_MODEL_ID || "us.anthropic.claude-opus-4-7";

// Si compartimos modelo con el chat (mismo Opus 4.7 por default), serializa
// con el semáforo para no chocar con /api/chat.
const USES_SHARED_MODEL =
  QUESTIONS_MODEL === (process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7");

// Constantes y curva del N adaptativo viven en módulo isomorfo
// (usable por el cliente sin arrastrar AWS SDK).
export {
  MIN_QUESTIONS_COUNT,
  MAX_QUESTIONS_COUNT,
  computeTargetCount,
  TIPOS_PREGUNTA,
  ESCALAS_GEOGRAFICAS,
  TIPO_LABELS,
  ESCALA_LABELS,
} from "./questions-config";
export type { TipoPregunta, EscalaGeografica } from "./questions-config";

import {
  MIN_QUESTIONS_COUNT,
  MAX_QUESTIONS_COUNT,
  computeTargetCount,
  TIPOS_PREGUNTA,
  ESCALAS_GEOGRAFICAS,
} from "./questions-config";
import type { TipoPregunta, EscalaGeografica } from "./questions-config";
import {
  PERIOD_YEAR_BOUNDS,
  periodForYear,
  getPeriodByCode,
} from "./taxonomy";

// Heurística para maxTokens según N. Con los campos extendidos (yearPrincipal,
// yearsSecondary, 5 personas + 3 lugares + 4 conceptos), cada pregunta ocupa
// ~600-700 tokens de output. Además reservamos 16k para thinking budget de
// Opus 4.7 (extended thinking razona antes de emitir el tool use).
// Sin holgura suficiente, thinking se come el budget y el JSON se trunca.
// 20 → 36k, 50 → 54k, 80 → 72k, 100 → 84k.
function maxTokensFor(count: number): number {
  const THINKING_RESERVE = 16_000;
  const BASE_OVERHEAD = 8_000;
  const PER_QUESTION = 600;
  return Math.min(96_000, BASE_OVERHEAD + THINKING_RESERVE + count * PER_QUESTION);
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface QuestionData {
  questionNumber: number;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  periodoRango: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  subcategoriaNombre: string;
  periodosRelacionados: string[];
  categoriasRelacionadas: string[];
  // Anclaje temporal preciso
  yearPrincipal: number | null;
  yearsSecondary: number[];
  // Entidades extraídas con conteo estricto
  entidadesPersonas: string[]; // 5
  entidadesLugares: string[];  // 3
  entidadesConceptos: string[]; // 4
  // Metadata analítica (nullable — preguntas viejas no la tienen)
  tipoPregunta: TipoPregunta | null;
  clusterTematico: string | null;
  hipotesisImplicita: string | null;
  escalaGeografica: EscalaGeografica | null;
  justificacion: string;
}

interface ChunkForGeneration {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

// ─── Prompt del sistema (taxonomía completa) ──────────────────────────────────

function buildSystemPrompt(targetCount: number): string {
  return `Eres un historiador experto en Colombia con formación interdisciplinaria (historia, ciencia política, economía, sociología, antropología, antropología histórica). Tu tarea es analizar el documento proporcionado y generar exactamente ${targetCount} preguntas de investigación profundas sobre la historia de Colombia.

Antes de emitir el JSON final, RAZONA cuidadosamente: identifica los procesos centrales del documento, ubícalos cronológicamente, mapéalos a la taxonomía y verifica la coherencia entre año principal, período histórico y categoría.

## REGLAS DE GENERACIÓN

1. PROFUNDIDAD: nada de preguntas factuales. Revela tensiones, contradicciones, causalidades no obvias, conexiones entre procesos.
2. TRASCENDENCIA: usa el documento como punto de partida pero conecta con procesos colombianos más amplios.
3. AUTOCONTENIDAS: comprensibles sin haber leído el documento.
4. DIVERSIDAD: al menos 7 categorías diferentes y al menos 5 períodos distintos.
5. CRUCES: prioriza preguntas que conecten épocas o dimensiones (más interesantes).
6. CONTEXTO INTERNO: cada pregunta incluye suficiente contexto para entender su relevancia.

## REGLA META — PERÍODO = ÉPOCA DEL PROCESO/DEBATE CENTRAL

**El \`periodo_historico\` se asigna a la ÉPOCA EN QUE OCURRE el proceso o debate central de la pregunta, NO a la época que el proceso ESTUDIA.**

Casos guía:
- Pregunta sobre arqueología precolombina debatida en los años 1920s → período REG (1886-1929) o REP_LIB (1930-1946), NO PRE. El debate científico ocurre en el siglo XX; lo prehispánico es el OBJETO de estudio. \`anio_principal\` debe estar en el rango del debate.
- Pregunta sobre la memoria de La Violencia (1946-1957) reconstruida por la Comisión de la Verdad (2018-2022) → período POS (2016-presente). La construcción de memoria ocurre hoy; los hechos son objeto.
- Pregunta sobre cómo las élites del siglo XIX reinterpretaron la Conquista → período según cuándo reinterpretan (NGR/EUC/REG), no CON.
- Pregunta sobre un proceso ocurrido en su época (ej. la guerra de los Mil Días 1899-1902) → período REG, sin ambigüedad.
- Pregunta de larga duración que abarca 3+ períodos sin un proceso pivote claro → TRANS.

VERIFICACIÓN OBLIGATORIA antes de emitir cada pregunta:
- \`anio_principal\` debe caer DENTRO del rango del \`periodo_historico\` asignado (o el período debe ser TRANS).
- Si el año está fuera del rango → o cambias el período, o cambias el año, o usas TRANS. NUNCA dejes la incoherencia.

## REGLAS PARA AÑOS Y ENTIDADES

### Años
- **anio_principal**: año único más representativo del foco temporal del proceso central (entero). Si abarca un proceso largo, elige el año pivote. Si es genuinamente transversal usa el punto medio.
- **anios_secundarios**: 2-4 años adicionales (antecedentes, consecuencias, hitos paralelos), en orden cronológico ascendente, sin repetir anio_principal. Vacío [] solo si la pregunta es muy puntual.
- COHERENCIA: anio_principal DEBE caer en el rango del periodo_historico (o el período es TRANS).

### Entidades (conteo ESTRICTO 5/3/4)
- **5 personas**: actores históricos individuales (Bolívar, Gaitán, Uribe, Núñez, Mosquera, Gaitán, etc.). Si la pregunta no tiene 5 personas obvias, incluye actores institucionales personificables o colectivos con nombre propio (FARC, M-19, ANUC, Comisión de la Verdad). NUNCA inventes nombres falsos — si dudas, usa actores estructurales reales del período.
- **3 lugares**: territorios, regiones, ciudades, países, accidentes geográficos. Mezcla escalas (nacional + regional + local/internacional).
- **4 conceptos**: nociones analíticas, procesos, ideologías, instituciones (liberalismo, federalismo, hacienda cafetera, paz negociada, soberanía popular, Patronato regio, Frente Nacional). Evita repetir el nombre del período.

REGLA CRÍTICA: conteos ESTRICTOS — exactamente 5/3/4. No menos, no más.

## METADATA ANALÍTICA (4 campos OBLIGATORIOS por pregunta)

Cada pregunta DEBE incluir además los siguientes cuatro campos. Son los que permiten filtrar, agrupar y curar el archivo. Trátalos con el mismo rigor que la taxonomía de período/categoría.

### \`tipo_pregunta\` (enum estricto)
Elige UNO de estos seis valores según el enfoque analítico dominante de la pregunta:

- **causal** — explora causas, mecanismos, encadenamientos. Pregunta cómo o por qué se produce un proceso. Ej: "¿Cómo se consolidó la hacienda cafetera antioqueña en pugna con la economía esclavista del Cauca?"
- **contrafactual** — qué hubiera pasado si... Pregunta sobre caminos no tomados, decisiones alternativas. Ej: "Si Mosquera hubiera muerto antes de Rionegro, ¿qué federalismo habría emergido?"
- **comparativa** — cruza el caso colombiano con otros países, regiones o épocas. Ej: "¿Por qué Colombia no produjo un populismo agrario tipo APRA como el peruano?"
- **consecuencias_no_obvias** — rastrea efectos de largo plazo o de segundo orden. Ej: "¿Qué huella demográfica dejó la Violencia en la urbanización acelerada de los 60s?"
- **historiografica** — debate sobre cómo se ha contado o interpretado el proceso. Categoría = HIS suele acompañar este tipo. Ej: "¿Por qué la nueva historia desplazó a la historia académica oficial sobre los Comuneros en los 80s?"
- **tensiones_internas** — saca a la luz contradicciones, paradojas o ambigüedades del propio proceso. Ej: "¿Cómo conviven en el Estatuto de Seguridad de Turbay la retórica democrática y la práctica represiva?"

Si dudas entre dos tipos, elige el que MEJOR refleje el verbo central de la pregunta. Una pregunta bien construida tiene un único tipo dominante.

### \`cluster_tematico\` (5-8 palabras, sin nombres propios)
Frase corta que identifica un EJE NARRATIVO del libro analizado y agrupa preguntas hermanas bajo un mismo cluster. Permite que el lector vea "todas las preguntas sobre X" dentro del corpus.

- **Sí**: "Disputa por la frontera amazónica", "Catolicismo y proyecto liberal decimonónico", "Trabajo agrario y dependencia exportadora", "Memoria oficial vs memoria subalterna".
- **No**: "Bolívar y la independencia" (nombre propio), "El siglo XIX" (demasiado vago), "Una pregunta sobre la economía cafetera del Quindío entre 1880 y 1930" (demasiado larga).

Dos preguntas distintas pueden y deben compartir el mismo cluster cuando trabajan el mismo eje. Apunta a 3-6 clusters distintos por libro — no a un cluster único por pregunta.

### \`hipotesis_implicita\` (1-2 líneas, 20-400 caracteres)
Tesis o debate que la pregunta sostiene/cuestiona, sin reformular la pregunta. Responde a "¿qué postura asume quien plantea esto?". Permite al lector entender el "por qué importa" desde el primer vistazo.

- **Sí**: "Sostiene que la modernización conservadora no fue solo proyecto político sino infraestructural, y por tanto pone en duda leer la Regeneración solo como restauración religiosa."
- **No**: reformulaciones de la pregunta, datos factuales, citas largas del libro.

### \`escala_geografica\` (enum estricto)
Escala territorial DOMINANTE del proceso interrogado. Uno solo:

- **local** — un lugar específico (un barrio, un municipio, una hacienda concreta). Ej: pregunta sobre la masacre de Trujillo.
- **regional** — una región amplia o departamento (Cauca, Antioquia, Caribe, Pacífico, Llanos). Ej: pregunta sobre el régimen hacendario del Magdalena.
- **nacional** — Colombia como tal, sin foco regional especial. Ej: pregunta sobre la Constitución del 91.
- **latinoamericana** — comparación o conexión continental (Bolivariana, Andina, Cono Sur). Ej: pregunta sobre Colombia frente al APRA peruano.
- **global** — conexión transatlántica o mundial (Guerra Fría, Atlántico negro, capital internacional). Ej: pregunta sobre Colombia y la doctrina Monroe.

Si el proceso opera en varias escalas, elige la escala DEL DEBATE/PROCESO CENTRAL, no la del trasfondo.

## FORMATO DE SALIDA

OBLIGATORIO: tu respuesta DEBE ser una llamada al tool \`generate_research_questions\`. No emitas texto explicativo en la respuesta — todo el output va vía el tool use. Si emites texto sin llamar al tool, la respuesta es inválida.

Estructura de cada pregunta dentro del tool input:

\`\`\`
{
  "id": 1,
  "pregunta": "Texto autocontenido (30-120 palabras)",
  "periodo_historico": { "codigo": "REG", "nombre": "Regeneración y Hegemonía Conservadora", "rango_temporal": "1886–1929" },
  "categoria": { "codigo": "HIS", "nombre": "Historiografía y Metodología Histórica" },
  "subcategoria": { "codigo": "HIS.ACA", "nombre": "Historia académica" },
  "periodos_relacionados": ["PRE", "REP_LIB"],
  "categorias_relacionadas": ["CUL", "SOC"],
  "anio_principal": 1925,
  "anios_secundarios": [1908, 1930, 1951],
  "entidades": {
    "personas": ["Aleš Hrdlička", "Paul Rivet", "Florentino Ameghino", "Gregorio Hernández de Alba", "Luis Duque Gómez"],
    "lugares": ["Bogotá", "Estados Unidos", "Argentina"],
    "conceptos": ["Poblamiento americano", "Nacionalismo científico", "Antropología física", "Arqueología nacional"]
  },
  "tipo_pregunta": "historiografica",
  "cluster_tematico": "Institucionalización de la antropología nacional",
  "hipotesis_implicita": "Sostiene que la antropología colombiana del primer tercio del XX no fue mera importación de paradigmas extranjeros sino una reinterpretación que sirvió a un proyecto de nación particular, lo que cuestiona leer la disciplina como reflejo pasivo del debate metropolitano.",
  "escala_geografica": "latinoamericana",
  "justificacion": "Pregunta clave: trazar cómo Colombia recibió y adaptó los grandes debates científicos sobre el origen americano permite leer la institucionalización de la antropología nacional como proyecto político-cultural."
}
\`\`\`

## TAXONOMÍA DE PERÍODOS HISTÓRICOS — DEFINICIONES Y TRAMPAS

### PRE — Período Prehispánico (antes de 1499)
**Procesos**: culturas y cacicazgos andinos (muiscas, taironas, quimbayas, calimas, sinúes), sistemas de subsistencia y horticultura, redes de intercambio prehispánicas, organización social cacical, mitologías y cosmovisiones autóctonas.
**Trampa común**: si la pregunta es sobre ARQUEOLOGÍA, ANTROPOLOGÍA o HISTORIOGRAFÍA del pasado precolombino realizada en los siglos XIX-XXI, el período NO es PRE — es el período del debate (EUC/REG/REP_LIB/FN/etc.) o HIS si es metodológica.

### CON — Conquista y Colonia Temprana (1499–1599)
**Procesos**: expediciones conquistadoras (Jiménez de Quesada, Federmán, Belalcázar), fundaciones de ciudades, encomienda primigenia, evangelización inicial, primer choque demográfico, Real Audiencia de Santafé (1550), Leyes Nuevas (1542), guerras de pacificación.
**Trampa común**: NO confundir con la Colonia madura (s. XVII-XVIII) que es COL.

### COL — Colonia Madura (1600–1780)
**Procesos**: consolidación del sistema colonial, mita y mineralidad de Mariquita/Antioquia, Iglesia barroca, reformas borbónicas iniciales, sociedad de castas, Patronato regio, expulsión jesuita (1767), economía hacendaria, sublevaciones (Tupac Amaru ecos en Pasto).
**Trampa común**: las reformas borbónicas tardías y la crisis pre-independentista son PRE_IND, no COL.

### PRE_IND — Crisis Colonial y Pre-Independencia (1780–1809)
**Procesos**: Revolución de los Comuneros (1781), expedición botánica, ilustración criolla (Caldas, Nariño, Zea), traducción de los Derechos del Hombre (1793), invasión napoleónica a España, Junta Central, antecedentes inmediatos del 20 de julio.

### IND — Independencia y Gran Colombia (1810–1831)
**Procesos**: Acta del 20 de julio, Patria Boba, reconquista de Morillo, campaña libertadora (Boyacá 1819), Cúcuta 1821, Gran Colombia, Convención de Ocaña, dictadura bolivariana, disolución (1830-1831).

### NGR — Nueva Granada y Reformas Liberales (1831–1862)
**Procesos**: Constitución 1832, guerra de los Supremos, Mosquera, reformas liberales del medio siglo (abolición esclavitud 1851, libertad religiosa, expropiación bienes manos muertas), federalismo, Constitución 1853, guerras civiles, federalismo radical (Constitución de Rionegro 1863 pertenece a EUC).

### EUC — Estados Unidos de Colombia y Radicalismo (1863–1885)
**Procesos**: Olimpo Radical, federalismo extremo (9 estados soberanos), educación laica, ferrocarriles, libertad de cultos, guerras civiles de fin de siglo, derrota radical en La Humareda (1885) → Regeneración.

### REG — Regeneración y Hegemonía Conservadora (1886–1929)
**Procesos**: Constitución de 1886, Núñez, Caro, Concordato (1887), guerra de los Mil Días (1899-1902), pérdida de Panamá (1903), modernización conservadora, Quinquenio de Reyes, danza de los millones (1924-1928), masacre de las bananeras (1928).

### REP_LIB — República Liberal (1930–1946)
**Procesos**: Olaya Herrera, López Pumarejo (Revolución en Marcha 1934-1938), reforma agraria Ley 200 (1936), Constitución del 36, sufragio universal masculino, sindicalismo CTC, Gaitán ascendente, Eduardo Santos.

### VIO — La Violencia y Dictadura (1946-1957)
**Procesos**: gobierno Ospina, Bogotazo (9 abril 1948), Violencia bipartidista en el campo, Laureano Gómez, dictadura Rojas Pinilla (1953-1957), pacto Sitges-Benidorm, plebiscito (1957).

### FN — Frente Nacional (1958-1974)
**Procesos**: alternancia liberal-conservadora 16 años, frustración bipartidismo, surgimiento guerrillas (FARC 1964, ELN 1964, EPL 1967, M-19 1970 nace post-fraude), reforma agraria Ley 135/1961, despeje paro cívico, fin Frente.

### CNA — Crisis, Narcotráfico y Apertura (1974-1990)
**Procesos**: Turbay, Estatuto de Seguridad, amnistía Betancur, narcotráfico (Medellín y Cali), M-19, Palacio de Justicia (1985), Galán, paramilitarismo, apertura económica Gaviria inicia (formal 1991).

### C91 — Constitución del 91 y Escalamiento del Conflicto (1991-2002)
**Procesos**: ANC, Constitución del 91, multiculturalismo, Samper-Proceso 8000, Caguán y zona de despeje (1998-2002), expansión paramilitar AUC, masacres, Plan Colombia (1999).

### SDE — Seguridad Democrática y Proceso de Paz (2002-2016)
**Procesos**: Uribe (2002-2010), Seguridad Democrática, desmovilización AUC (Justicia y Paz 2005), falsos positivos, Santos, La Habana, Acuerdo de paz con FARC (2016).

### POS — Posconflicto y Colombia Contemporánea (2016–presente)
**Procesos**: implementación Acuerdo, JEP, Comisión de la Verdad, paro nacional 2021, gobierno Petro, paz total, migración venezolana.

### TRANS — Transversal / Larga Duración (abarca 3+ períodos)
**Uso correcto**: procesos genuinamente de larga duración sin pivote único (formación territorial colombiana s. XVI-XX, mestizaje, historia regional Antioquia s. XVIII-XX, evolución de un imaginario nacional, etc.). NO uses TRANS como "no sé qué período" — primero intenta ubicar el debate/proceso central.

## TAXONOMÍA DE CATEGORÍAS Y SUBCATEGORÍAS

### POL — Política y Estado
POL.FOR (formación estatal), POL.REG (regímenes políticos), POL.PAR (partidos), POL.ELE (elecciones), POL.CON (constituciones), POL.DES (descentralización), POL.COR (corrupción), POL.MIL (relación civil-militar), POL.REF (reformas), POL.OPO (oposición).

### ECO — Economía y Desarrollo
ECO.AGR (agraria), ECO.EXT (extractivismo), ECO.EXP (exportaciones), ECO.IND (industrialización), ECO.FIS (fiscal), ECO.MON (monetaria), ECO.LAB (trabajo), ECO.INF (infraestructura), ECO.APE (apertura), ECO.DES (desarrollo).

### CON — Conflicto Armado y Violencia
CON.GCI (guerras civiles s. XIX), CON.VIO (Violencia), CON.GUE (guerrillas), CON.PAR (paramilitarismo), CON.NAR (narco-violencia), CON.DES (desplazamiento), CON.PAZ (procesos de paz), CON.JTR (justicia transicional), CON.MEM (memoria), CON.DDH (derechos humanos), CON.GEO (geografía del conflicto).

### SOC — Sociedad y Estructura Social
SOC.CLA (clases), SOC.RAZ (raza), SOC.IND (indígenas), SOC.AFR (afrocolombianos), SOC.GEN (género), SOC.URB (urbanización), SOC.RUR (mundo rural), SOC.MIG (migraciones), SOC.DEM (demografía), SOC.EDU (educación), SOC.FAM (familia).

### CUL — Cultura, Ideología y Producción Intelectual
CUL.IDE (ideologías), CUL.REL (religión), CUL.LIT (literatura), CUL.ART (artes), CUL.PER (prensa), CUL.INT (intelectuales), CUL.POP (cultura popular), CUL.CIE (ciencia y tecnología), CUL.LEN (lengua).

### REL — Relaciones Internacionales y Geopolítica
REL.ESP (España), REL.USA (Estados Unidos), REL.LAT (América Latina), REL.EUR (Europa), REL.GFR (Guerra Fría), REL.PAN (Panamá), REL.FRO (fronteras), REL.COM (comercio internacional), REL.ORI (oriente), REL.MUL (multilateralismo).

### TER — Territorio, Región y Medio Ambiente
TER.REG (regiones), TER.FRO (fronteras internas), TER.GEO (geografía histórica), TER.AMB (medio ambiente), TER.TIE (tierras), TER.COC (coca/cultivos ilícitos), TER.RES (recursos), TER.CIU (ciudades).

### MOV — Movimientos Sociales y Acción Colectiva
MOV.OBR (obrero), MOV.CAM (campesino), MOV.EST (estudiantil), MOV.CIV (ciudadanías), MOV.ETN (étnicos), MOV.MUJ (mujeres/feminismos), MOV.PAZ (pacifismo), MOV.AMB (ambientalismo), MOV.DIG (digital), MOV.PLE (plebes/multitudes).

### INS — Instituciones, Derecho y Justicia
INS.JUD (sistema judicial), INS.MIL (fuerzas armadas), INS.POL (policía), INS.IGE (iglesia institución), INS.UNI (universidades), INS.BUR (burocracia), INS.TIE (catastro/tenencia), INS.BAN (bancos/Banco República), INS.MED (medios institucionalizados).

### HIS — Historiografía y Metodología Histórica
HIS.MAR (corrientes marxistas), HIS.ACA (academia/institucionalización), HIS.OFI (historia oficial), HIS.NUE (nueva historia), HIS.ORA (historia oral), HIS.REG (historia regional), HIS.COM (comparada), HIS.MEM (memoria histórica), HIS.FUE (fuentes y archivos).

## REGLAS DE CALIDAD

1. NUNCA preguntas factuales (que se resuelvan con un dato).
2. Prioriza preguntas causales, contrafactuales, comparativas, de consecuencias no obvias.
3. Cada pregunta entre 30 y 120 palabras.
4. Al menos 3 conectan con procesos latinoamericanos/globales.
5. Al menos 2 cuestionan narrativas o supuestos historiográficos.
6. Ninguna requiere haber leído el documento.
7. COHERENCIA CRONOLÓGICA: anio_principal DENTRO del rango del periodo_historico, salvo TRANS.
8. DIVERSIDAD DE TIPOS: el lote debe usar al menos 4 valores distintos de \`tipo_pregunta\`. No emitas un batch homogéneo (todas causales o todas historiográficas).
9. CLUSTERING: idealmente 3-6 clusters temáticos distintos cubren todo el batch, con 4-10 preguntas hermanas por cluster. Si el libro es muy estrecho, 2 clusters es aceptable; si es muy amplio, hasta 8. Nunca un cluster por pregunta (eso anula el agrupamiento).
10. HIPÓTESIS NO TRIVIAL: \`hipotesis_implicita\` debe revelar la tesis que la pregunta sostiene, no parafrasear la pregunta. Si te sale "la pregunta busca entender X", reescríbela.`;
}

// ─── Selección de chunks para la generación ──────────────────────────────────
//
// Estrategia: pasar el LIBRO COMPLETO a Opus 4.7 por defecto. La sampling solo
// activa cuando el corpus supera el techo seguro de contexto del modelo.
//
// Opus 4.7 en Bedrock tiene 200K tokens de contexto. Presupuesto:
//   - system prompt (~2.5K) + tool spec (~1K) + user prefix (~0.2K) = ~4K tokens
//   - output reservado (maxTokens): hasta 48K (caso N=100)
//   - headroom defensivo: 20K tokens (errores de estimación, latencias, retries)
//   = 72K tokens reservados. Resto del contexto: 128K tokens ≈ 512K chars.
// Dejamos un poco extra de margen: 480K chars.

const MAX_CHARS_PER_CHUNK = 4000; // Permitimos chunks completos (los chunks reales rara vez pasan de 2K).
const MAX_TOTAL_CHARS = 480_000;  // ~120K tokens — libro completo cabe holgado con headroom.

/**
 * Selecciona los chunks que se le pasarán a Opus para generar las preguntas.
 *
 * - Caso común (libro chico/mediano, ≤600K chars): TODOS los chunks ordenados.
 * - Caso extremo (libro gigante): preserva inicio + fin + sampling uniforme
 *   del medio, hasta llenar MAX_TOTAL_CHARS. Esto mantiene la cobertura de
 *   apertura/cierre + transversal del cuerpo, sin truncar arbitrariamente.
 */
export function selectChunksForGeneration(
  chunks: ChunkForGeneration[]
): ChunkForGeneration[] {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  if (sorted.length === 0) return [];

  const chunkCost = (c: ChunkForGeneration) =>
    Math.min(c.content.length, MAX_CHARS_PER_CHUNK);

  // Path rápido: si el libro entero cabe, no recortamos nada.
  const fullSize = sorted.reduce((acc, c) => acc + chunkCost(c), 0);
  if (fullSize <= MAX_TOTAL_CHARS) return sorted;

  // Libro mayor al techo: sampling defensivo conservando bordes y middle pass.
  // Garantizamos los primeros y últimos N chunks (apertura y cierre del libro)
  // y luego rellenamos el centro con pasos uniformes hasta el techo.
  const EDGE = 8;
  const head = sorted.slice(0, Math.min(EDGE, sorted.length));
  const tail = sorted.slice(Math.max(0, sorted.length - EDGE));
  const middle = sorted.slice(EDGE, Math.max(EDGE, sorted.length - EDGE));

  const picked = new Map<number, ChunkForGeneration>();
  let usedChars = 0;
  for (const c of [...head, ...tail]) {
    if (picked.has(c.chunkIndex)) continue;
    picked.set(c.chunkIndex, c);
    usedChars += chunkCost(c);
  }

  // Recorrer el medio con paso uniforme hasta agotar el presupuesto.
  if (middle.length > 0 && usedChars < MAX_TOTAL_CHARS) {
    const remainingBudget = MAX_TOTAL_CHARS - usedChars;
    const avgCost = Math.max(1, Math.round(fullSize / sorted.length));
    const targetMiddle = Math.max(1, Math.floor(remainingBudget / avgCost));
    const step = Math.max(1, Math.floor(middle.length / targetMiddle));

    for (let i = 0; i < middle.length; i += step) {
      const c = middle[i];
      if (picked.has(c.chunkIndex)) continue;
      const cost = chunkCost(c);
      if (usedChars + cost > MAX_TOTAL_CHARS) break;
      picked.set(c.chunkIndex, c);
      usedChars += cost;
    }
  }

  return [...picked.values()].sort((a, b) => a.chunkIndex - b.chunkIndex);
}

// Alias retrocompatible — algunos imports externos pueden usar el nombre viejo.
export const selectRepresentativeChunks = selectChunksForGeneration;

// ─── Tool use schema (garantiza JSON válido siempre) ─────────────────────────

const GENERATE_TOOL_NAME = "generate_research_questions";

function buildGenerateToolSpec(targetCount: number) {
  return {
    name: GENERATE_TOOL_NAME,
    description: `Genera exactamente ${targetCount} preguntas de investigación histórica sobre Colombia en formato estructurado, clasificadas con la taxonomía de períodos y categorías.`,
    inputSchema: {
      json: {
        type: "object",
        properties: {
          preguntas: {
            type: "array",
            minItems: Math.max(1, Math.floor(targetCount * 0.9)),
            maxItems: targetCount,
            items: {
              type: "object",
              required: [
                "id",
                "pregunta",
                "periodo_historico",
                "categoria",
                "subcategoria",
                "periodos_relacionados",
                "categorias_relacionadas",
                "anio_principal",
                "anios_secundarios",
                "entidades",
                "tipo_pregunta",
                "cluster_tematico",
                "hipotesis_implicita",
                "escala_geografica",
                "justificacion",
              ],
              properties: {
                id: { type: "integer", minimum: 1, maximum: targetCount },
                pregunta: { type: "string", minLength: 20 },
                periodo_historico: {
                  type: "object",
                  required: ["codigo", "nombre", "rango_temporal"],
                  properties: {
                    codigo: { type: "string" },
                    nombre: { type: "string" },
                    rango_temporal: { type: "string" },
                  },
                },
                categoria: {
                  type: "object",
                  required: ["codigo", "nombre"],
                  properties: {
                    codigo: { type: "string" },
                    nombre: { type: "string" },
                  },
                },
                subcategoria: {
                  type: "object",
                  required: ["codigo", "nombre"],
                  properties: {
                    codigo: { type: "string" },
                    nombre: { type: "string" },
                  },
                },
                periodos_relacionados: {
                  type: "array",
                  items: { type: "string" },
                },
                categorias_relacionadas: {
                  type: "array",
                  items: { type: "string" },
                },
                anio_principal: {
                  type: "integer",
                  minimum: 1000,
                  maximum: 2100,
                },
                anios_secundarios: {
                  type: "array",
                  items: { type: "integer", minimum: 1000, maximum: 2100 },
                  minItems: 0,
                  maxItems: 4,
                },
                entidades: {
                  type: "object",
                  required: ["personas", "lugares", "conceptos"],
                  properties: {
                    personas: {
                      type: "array",
                      items: { type: "string", minLength: 2 },
                      minItems: 5,
                      maxItems: 5,
                    },
                    lugares: {
                      type: "array",
                      items: { type: "string", minLength: 2 },
                      minItems: 3,
                      maxItems: 3,
                    },
                    conceptos: {
                      type: "array",
                      items: { type: "string", minLength: 2 },
                      minItems: 4,
                      maxItems: 4,
                    },
                  },
                },
                tipo_pregunta: {
                  type: "string",
                  enum: [...TIPOS_PREGUNTA],
                  description:
                    "Clasificación analítica: causal (explora mecanismos), contrafactual (qué hubiera pasado), comparativa (cruza casos/épocas), consecuencias_no_obvias (efectos de largo plazo o de segundo orden), historiografica (debate sobre la interpretación), tensiones_internas (contradicciones o paradojas del proceso).",
                },
                cluster_tematico: {
                  type: "string",
                  minLength: 5,
                  maxLength: 80,
                  description:
                    "Frase corta (5-8 palabras) que identifica un eje narrativo del libro y agrupa preguntas hermanas. Sin nombres propios. Ej: 'Disputa por la frontera amazónica', 'Catolicismo y proyecto liberal'.",
                },
                hipotesis_implicita: {
                  type: "string",
                  minLength: 20,
                  maxLength: 400,
                  description:
                    "Tesis o debate que la pregunta sostiene/cuestiona, en 1-2 líneas. Explicita el 'por qué importa' sin reformular la pregunta.",
                },
                escala_geografica: {
                  type: "string",
                  enum: [...ESCALAS_GEOGRAFICAS],
                  description:
                    "Escala territorial dominante del proceso: local (un lugar específico), regional (región amplia), nacional (Colombia), latinoamericana (comparación continental), global (conexión transatlántica/mundial).",
                },
                justificacion: { type: "string", minLength: 10 },
              },
            },
          },
        },
        required: ["preguntas"],
      },
    },
  };
}

/**
 * Si el anio_principal cae fuera del rango del periodo asignado por más del
 * margen tolerado, se coerciona a un período coherente o a TRANS. Devuelve
 * los códigos finales + flag indicando si hubo coerción (para logs).
 *
 * Tolerancia: 5 años de margen (algunos procesos cruzan el límite, ej.
 * Constitución 1991 técnicamente CNA→C91). Más de 5 años fuera = corregimos.
 */
function reconcilePeriodoYAnio(
  periodoCode: string,
  yearPrincipal: number | null,
): { periodoCode: string; coerced: boolean; reason: string } {
  if (yearPrincipal == null) {
    return { periodoCode, coerced: false, reason: "" };
  }
  if (periodoCode === "TRANS") {
    return { periodoCode, coerced: false, reason: "" };
  }
  const bounds = PERIOD_YEAR_BOUNDS[periodoCode];
  if (!bounds) {
    return { periodoCode: "TRANS", coerced: true, reason: `código desconocido ${periodoCode}` };
  }
  const TOLERANCE = 5;
  const within = yearPrincipal >= bounds.start - TOLERANCE && yearPrincipal <= bounds.end + TOLERANCE;
  if (within) {
    return { periodoCode, coerced: false, reason: "" };
  }
  // Fuera de rango: intenta encontrar el período correcto basado en el año
  const correct = periodForYear(yearPrincipal);
  return {
    periodoCode: correct,
    coerced: true,
    reason: `año ${yearPrincipal} fuera de ${periodoCode} (${bounds.start}-${bounds.end}) → ${correct}`,
  };
}

function normalizeQuestions(raw: unknown[]): QuestionData[] {
  let coercions = 0;
  const reasons: string[] = [];
  const out = raw.map((q: unknown, i: number) => {
    const item = q as Record<string, unknown>;
    const periodo = (item.periodo_historico as Record<string, string>) ?? {};
    const categoria = (item.categoria as Record<string, string>) ?? {};
    const subcategoria = (item.subcategoria as Record<string, string>) ?? {};
    const entidades = (item.entidades as Record<string, unknown>) ?? {};

    const yearPrincipal =
      typeof item.anio_principal === "number" && Number.isFinite(item.anio_principal)
        ? Math.trunc(item.anio_principal as number)
        : null;

    const yearsSecondary = ((item.anios_secundarios as unknown[]) ?? [])
      .filter((y) => typeof y === "number" && Number.isFinite(y))
      .map((y) => Math.trunc(y as number));

    const cleanList = (arr: unknown): string[] =>
      ((arr as unknown[]) ?? [])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((s) => s.length > 0);

    const rawPeriodoCode = periodo.codigo ?? "TRANS";
    const rec = reconcilePeriodoYAnio(rawPeriodoCode, yearPrincipal);
    const finalPeriodoCode = rec.periodoCode;
    // periodoNombre/periodoRango son derivables del code: la taxonomía canónica
    // es la única fuente de verdad. No usar el glyph del LLM (mezcla "-" y "–"),
    // que fragmenta los conteos por período en agregaciones aguas abajo.
    const periodoMeta = getPeriodByCode(finalPeriodoCode);
    const finalPeriodoNombre = periodoMeta?.nombre ?? periodo.nombre ?? "Transversal";
    const finalPeriodoRango = periodoMeta?.rango ?? periodo.rango_temporal ?? "";
    if (rec.coerced) {
      coercions++;
      reasons.push(`Q${(item.id as number) ?? i + 1}: ${rec.reason}`);
    }

    // Metadata analítica — tolerante: si el LLM falla un enum, queda null.
    // Aceptamos minúsculas/snake_case; cualquier otra cosa se descarta.
    const rawTipo = typeof item.tipo_pregunta === "string"
      ? item.tipo_pregunta.toLowerCase().trim()
      : null;
    const tipoPregunta: TipoPregunta | null =
      rawTipo && (TIPOS_PREGUNTA as readonly string[]).includes(rawTipo)
        ? (rawTipo as TipoPregunta)
        : null;

    const rawEscala = typeof item.escala_geografica === "string"
      ? item.escala_geografica.toLowerCase().trim()
      : null;
    const escalaGeografica: EscalaGeografica | null =
      rawEscala && (ESCALAS_GEOGRAFICAS as readonly string[]).includes(rawEscala)
        ? (rawEscala as EscalaGeografica)
        : null;

    const rawCluster = typeof item.cluster_tematico === "string"
      ? item.cluster_tematico.trim()
      : "";
    const clusterTematico = rawCluster.length >= 5 ? rawCluster.slice(0, 80) : null;

    const rawHipotesis = typeof item.hipotesis_implicita === "string"
      ? item.hipotesis_implicita.trim()
      : "";
    const hipotesisImplicita = rawHipotesis.length >= 20 ? rawHipotesis.slice(0, 400) : null;

    return {
      questionNumber: (item.id as number) ?? i + 1,
      pregunta: (item.pregunta as string) ?? "",
      periodoCode: finalPeriodoCode,
      periodoNombre: finalPeriodoNombre,
      periodoRango: finalPeriodoRango,
      categoriaCode: categoria.codigo ?? "HIS",
      categoriaNombre: categoria.nombre ?? "Historiografía",
      subcategoriaCode: subcategoria.codigo ?? "HIS.ACA",
      subcategoriaNombre: subcategoria.nombre ?? "Historia académica",
      periodosRelacionados: ((item.periodos_relacionados as string[]) ?? []).filter(Boolean),
      categoriasRelacionadas: ((item.categorias_relacionadas as string[]) ?? []).filter(Boolean),
      yearPrincipal,
      yearsSecondary,
      entidadesPersonas: cleanList(entidades.personas),
      entidadesLugares: cleanList(entidades.lugares),
      entidadesConceptos: cleanList(entidades.conceptos),
      tipoPregunta,
      clusterTematico,
      hipotesisImplicita,
      escalaGeografica,
      justificacion: (item.justificacion as string) ?? "",
    };
  });

  if (coercions > 0) {
    console.warn(
      `[questions-gen] ⚠️ ${coercions}/${raw.length} preguntas con período coercionado por incoherencia año-período:\n  ${reasons.join("\n  ")}`
    );
  }

  return out;
}

// ─── Función principal ─────────────────────────────────────────────────────────

export interface GenerateOptions {
  /**
   * Cantidad de preguntas a generar (MIN_QUESTIONS_COUNT–MAX_QUESTIONS_COUNT).
   * Si no se pasa, se calcula automáticamente con computeTargetCount(chunks.length).
   */
  targetCount?: number;
}

export async function generateQuestionsForDocument(
  chunks: ChunkForGeneration[],
  filename: string,
  opts: GenerateOptions = {}
): Promise<QuestionData[]> {
  const requestedCount = opts.targetCount ?? computeTargetCount(chunks.length);
  const targetCount = Math.min(
    MAX_QUESTIONS_COUNT,
    Math.max(MIN_QUESTIONS_COUNT, requestedCount)
  );

  // Pasamos el libro completo. Si no cabe en el techo de contexto (~150K tokens
  // para Opus 4.7 200K), aplicamos sampling defensivo conservando bordes.
  const selected = selectChunksForGeneration(chunks);

  // Construir contexto con límite de chars
  let totalChars = 0;
  const parts: string[] = [];

  for (const chunk of selected) {
    const content =
      chunk.content.length > MAX_CHARS_PER_CHUNK
        ? chunk.content.slice(0, MAX_CHARS_PER_CHUNK) + "..."
        : chunk.content;
    const part = `--- Fragmento (pág. ${chunk.pageNumber}) ---\n${content}`;

    if (totalChars + part.length > MAX_TOTAL_CHARS) break;
    parts.push(part);
    totalChars += part.length;
  }

  const context = parts.join("\n\n");

  const userMessage = `Analiza los siguientes fragmentos del libro "${filename}" y genera exactamente ${targetCount} preguntas de investigación histórica sobre Colombia siguiendo todas las reglas y la taxonomía del sistema.

${context}`;

  // Opus 4.7+ son "thinking models" y NO aceptan `temperature` en inferenceConfig
  // (Bedrock lanza ValidationException: "temperature is deprecated for this model").
  // Para modelos previos seguimos pasando 0.7 por compatibilidad.
  const isThinkingModel = /claude-(opus|sonnet)-(4-7|4-8|5)/.test(QUESTIONS_MODEL);
  const maxTokens = maxTokensFor(targetCount);
  const inferenceConfig: { maxTokens: number; temperature?: number } = {
    maxTokens,
  };
  if (!isThinkingModel) {
    inferenceConfig.temperature = 0.7;
  }

  // Extended thinking adaptativo (Opus 4.7+ en Bedrock). Permite que el modelo
  // razone antes de emitir el tool use, mejorando dramáticamente la clasificación
  // taxonómica (período + categoría coherentes con anio_principal). Sin thinking,
  // el modelo a veces emite combinaciones absurdas (pregunta de 1925 marcada
  // como Prehispánico).
  //
  // API actual de Bedrock: thinking.type = "adaptive" + output_config.effort
  // (low|medium|high). El bug "thinking.type.enabled is not supported" vino de
  // usar la API vieja de Anthropic directo. Bedrock decide el budget en runtime.
  // additionalModelRequestFields requiere DocumentType (Smithy); cast vía unknown.
  // effort: "medium" balancea calidad de razonamiento con tiempos razonables.
  // "high" provoca >20min y throttling para batches de 50+ preguntas.
  // Override con BEDROCK_THINKING_EFFORT=high|medium|low si querés ajustar.
  const wantsThinking = isThinkingModel;
  const effort = process.env.BEDROCK_THINKING_EFFORT || "medium";
  const additionalModelRequestFields = wantsThinking
    ? ({
        thinking: { type: "adaptive" },
        output_config: { effort },
      } as unknown as Record<string, never>)
    : undefined;

  const command = new ConverseCommand({
    modelId: QUESTIONS_MODEL,
    system: [{ text: buildSystemPrompt(targetCount) }],
    messages: [
      {
        role: "user",
        content: [{ text: userMessage }],
      },
    ],
    toolConfig: {
      tools: [{ toolSpec: buildGenerateToolSpec(targetCount) }],
      // Con thinking habilitado Bedrock NO acepta forzar tool ("Thinking may
      // not be enabled when tool_choice forces tool use"). Usamos `auto` y el
      // prompt instruye explícitamente que debe llamarse el tool.
      // Sin thinking, podríamos usar { tool: { name } }, pero auto funciona
      // igual de bien cuando solo hay UN tool definido y el prompt es claro.
      toolChoice: { auto: {} },
    },
    inferenceConfig,
    ...(additionalModelRequestFields ? { additionalModelRequestFields } : {}),
  });

  // Retry con backoff exponencial.
  // Si usa el mismo modelo que el chat (Opus), usa el semáforo para serializar.
  // Si usa un modelo distinto (Sonnet), no necesita semáforo.
  const MAX_BEDROCK_RETRIES = 5;

  const sendWithRetry = async () => {
    for (let attempt = 0; attempt <= MAX_BEDROCK_RETRIES; attempt++) {
      try {
        return await bedrock.send(command);
      } catch (err) {
        const isRetryable =
          err instanceof Error &&
          (err.name === "ThrottlingException" ||
            err.name === "ModelStreamErrorException" ||
            err.name === "ModelTimeoutException" ||
            err.name === "ServiceUnavailableException" ||
            err.name === "InternalServerException" ||
            err.message.includes("throttl") ||
            err.message.includes("Too many requests") ||
            err.message.includes("timeout") ||
            err.message.includes("ECONNRESET") ||
            err.message.includes("socket hang up"));
        if (!isRetryable || attempt === MAX_BEDROCK_RETRIES) throw err;
        const delay = Math.min(5000 * Math.pow(2, attempt), 60000);
        console.warn(`Bedrock questions model throttled (attempt ${attempt + 1}/${MAX_BEDROCK_RETRIES}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("No response from Bedrock after retries");
  };

  const response = USES_SHARED_MODEL
    ? await withBedrockSemaphore(sendWithRetry)
    : await sendWithRetry();

  // Con tool use, Bedrock garantiza JSON válido conforme al schema
  const stopReason = response.stopReason;
  const usage = response.usage;
  const content = response.output?.message?.content ?? [];

  console.log(
    `[questions-gen] Bedrock response: stopReason=${stopReason}, usage=${JSON.stringify(usage)}, blocks=${content.length}, types=${content.map((b) => Object.keys(b).join("|")).join(",")}`
  );

  const toolUseBlock = content.find(
    (block) => block.toolUse?.name === GENERATE_TOOL_NAME
  );

  if (!toolUseBlock?.toolUse?.input) {
    // Diagnóstico: si Bedrock devuelve solo texto (no tool use), suele ser por
    // schema imposible de satisfacer o stopReason=max_tokens. Dump del texto.
    const textBlock = content.find((b) => b.text);
    const preview = textBlock?.text?.slice(0, 500) ?? "(sin texto)";
    throw new Error(
      `Claude no retornó tool use válido. stopReason=${stopReason}. Texto: ${preview}`
    );
  }

  const input = toolUseBlock.toolUse.input as Record<string, unknown>;
  // Workaround Bedrock+thinking: a veces serializa preguntas como string JSON
  // en vez de array nativo (sospechamos por cómo Smithy maneja additionalModelRequestFields).
  // Si es string, intentamos parse antes de fallar.
  let preguntas: unknown[];
  if (typeof input.preguntas === "string") {
    try {
      const parsed = JSON.parse(input.preguntas);
      preguntas = Array.isArray(parsed) ? parsed : [];
      console.log(
        `[questions-gen] ℹ️ preguntas vino como string JSON, parsed → ${preguntas.length} items`
      );
    } catch (e) {
      preguntas = [];
      console.warn(`[questions-gen] preguntas string no parseable:`, e);
    }
  } else {
    preguntas = (input.preguntas as unknown[]) ?? [];
  }

  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    const inputKeys = Object.keys(input).join(",");
    const inputPreview = JSON.stringify(input).slice(0, 500);
    throw new Error(
      `Tool use con preguntas vacías. stopReason=${stopReason}. Keys=${inputKeys}. Input: ${inputPreview}`
    );
  }

  console.log(
    `[questions-gen] ✅ ${preguntas.length} preguntas en tool use. stopReason=${stopReason}`
  );

  return normalizeQuestions(preguntas);
}
