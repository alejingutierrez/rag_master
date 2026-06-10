// Contexto analítico opcional de una pregunta curada del corpus.
// Cuando una consulta se abre desde /questions (drawer), todos estos campos
// viajan del cliente al server para enriquecer el system prompt — el LLM
// responde "sabiendo" qué quería el investigador.
//
// Extraído de /api/chat para que lo reusen la ruta de streaming (Consultar)
// y, más adelante, el Taller al ingerir preguntas con su metadata.
export interface QuestionContext {
  id?: string;
  periodoCode?: string;
  periodoNombre?: string;
  periodoRango?: string;
  categoriaCode?: string;
  categoriaNombre?: string;
  subcategoriaCode?: string;
  subcategoriaNombre?: string;
  tipoPregunta?: string;
  escalaGeografica?: string;
  clusterTematico?: string;
  hipotesisImplicita?: string;
  justificacion?: string;
  yearPrincipal?: number | null;
  yearsSecondary?: number[];
  entidadesPersonas?: string[];
  entidadesLugares?: string[];
  entidadesConceptos?: string[];
}

export function buildContextPreamble(ctx: QuestionContext): string {
  const lines: string[] = [];
  if (ctx.periodoNombre || ctx.periodoCode) {
    lines.push(
      `- Período histórico: ${ctx.periodoNombre ?? ctx.periodoCode}${ctx.periodoRango ? ` (${ctx.periodoRango})` : ""}`
    );
  }
  if (ctx.categoriaNombre || ctx.categoriaCode) {
    const sub = ctx.subcategoriaNombre ? ` · ${ctx.subcategoriaNombre}` : "";
    lines.push(`- Categoría: ${ctx.categoriaNombre ?? ctx.categoriaCode}${sub}`);
  }
  if (ctx.tipoPregunta) {
    lines.push(`- Tipo analítico: ${ctx.tipoPregunta} (orienta el enfoque de la respuesta)`);
  }
  if (ctx.escalaGeografica) {
    lines.push(`- Escala geográfica dominante: ${ctx.escalaGeografica}`);
  }
  if (ctx.yearPrincipal) {
    const sec = ctx.yearsSecondary?.length
      ? `; años secundarios: ${ctx.yearsSecondary.join(", ")}`
      : "";
    lines.push(`- Anclaje temporal: año principal ${ctx.yearPrincipal}${sec}`);
  }
  if (ctx.clusterTematico) {
    lines.push(`- Cluster temático del corpus: "${ctx.clusterTematico}"`);
  }
  const entidades: string[] = [];
  if (ctx.entidadesPersonas?.length) entidades.push(`Personas: ${ctx.entidadesPersonas.join(", ")}`);
  if (ctx.entidadesLugares?.length) entidades.push(`Lugares: ${ctx.entidadesLugares.join(", ")}`);
  if (ctx.entidadesConceptos?.length) entidades.push(`Conceptos: ${ctx.entidadesConceptos.join(", ")}`);
  if (entidades.length > 0) {
    lines.push(`- Entidades clave que la pregunta privilegia:\n    ${entidades.join("\n    ")}`);
  }
  if (ctx.hipotesisImplicita) {
    lines.push(`- Hipótesis implícita (tesis que la pregunta sostiene): ${ctx.hipotesisImplicita}`);
  }
  if (ctx.justificacion) {
    lines.push(`- Justificación curatorial: ${ctx.justificacion}`);
  }
  if (lines.length === 0) return "";
  return [
    "[CONTEXTO ANALÍTICO — esta pregunta viene del corpus curado de historia de Colombia. Úsalo para enmarcar tu respuesta sin repetirlo verbatim al lector.]",
    ...lines,
    "",
    "[PREGUNTA DEL INVESTIGADOR]",
  ].join("\n");
}
