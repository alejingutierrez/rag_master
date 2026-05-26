import type { PeriodCode } from "./design-tokens";

export interface PeriodEvent {
  y: number | string;
  t: string;
  note: string;
}

// Hitos historiográficos curados editorialmente — NO derivados del corpus.
// Cuando exista una tabla `period_events` en BD, mover esto y agregarle source/citation.
export const PERIOD_EVENTS: Partial<Record<PeriodCode, PeriodEvent[]>> = {
  CON: [
    { y: 1499, t: "Llegada a costas continentales", note: "Alonso de Ojeda recorre la costa de la Guajira." },
    { y: 1525, t: "Fundación de Santa Marta", note: "Rodrigo de Bastidas establece la primera ciudad." },
    { y: 1538, t: "Fundación de Santafé de Bogotá", note: "Gonzalo Jiménez de Quesada en el altiplano muisca." },
  ],
  IND: [
    { y: 1810, t: "Grito de Independencia", note: "20 de julio en Santafé de Bogotá." },
    { y: 1816, t: "Reconquista española", note: "Régimen del Terror bajo Morillo y Sámano." },
    { y: 1819, t: "Boyacá", note: "Batalla decisiva; consolida la Gran Colombia." },
    { y: 1830, t: "Muerte de Bolívar", note: "Disolución de la Gran Colombia." },
  ],
  REG: [
    { y: 1886, t: "Constitución de Núñez", note: "Centralización política y restauración del rol social de la Iglesia." },
    { y: 1887, t: "Concordato con la Santa Sede", note: "Devuelve a la Iglesia el control de la educación pública." },
    { y: 1899, t: "Guerra de los Mil Días", note: "Conflicto bipartidista, devastador para el país." },
    { y: 1903, t: "Separación de Panamá", note: "Pérdida territorial en el contexto del canal interoceánico." },
    { y: 1910, t: "Reforma constitucional", note: "Limita la reelección presidencial." },
    { y: 1928, t: "Masacre de las bananeras", note: "Conflicto laboral; uno de los hitos del fin de la Hegemonía." },
  ],
  REP_LIB: [
    { y: 1934, t: "Primer gobierno de López Pumarejo", note: "Inicio de la 'Revolución en marcha'." },
    { y: 1936, t: "Reforma constitucional", note: "Función social de la propiedad." },
    { y: 1936, t: "Ley 200 de tierras", note: "Reconoce derechos sin expropiar." },
  ],
  VIO: [
    { y: 1946, t: "Triunfo conservador", note: "Ospina Pérez asume; tensión bipartidista en ascenso." },
    { y: 1948, t: "Bogotazo", note: "Asesinato de Jorge Eliécer Gaitán; estallido urbano." },
    { y: 1953, t: "Dictadura de Rojas Pinilla", note: "Único golpe militar del siglo XX colombiano." },
    { y: 1957, t: "Plebiscito y Frente Nacional", note: "Pacto bipartidista que cierra el ciclo de La Violencia." },
  ],
  C91: [
    { y: 1991, t: "Asamblea Constituyente", note: "Nueva Constitución; tutela y derechos fundamentales." },
    { y: 1993, t: "Muerte de Pablo Escobar", note: "Cierre simbólico del Cartel de Medellín." },
  ],
  POS: [
    { y: 2016, t: "Acuerdo de paz con las FARC", note: "Firma del acuerdo en La Habana / Bogotá." },
  ],
};
