/**
 * Campaña de personas solicitada el 2026-08-04.
 *
 * Cuotas históricas:
 * - PRE 5, CON 7, COL 6, PRE_IND 3, IND 2;
 * - EUC 2, REP_LIB 3, VIO 5, FN 1;
 * - tres de períodos no nombrados: NGR 1, REG 1 y POS 1.
 *
 * La selección parte del registro canónico, excluye fichas ya publicadas y
 * privilegia personas con presencia documental y una identidad inequívoca.
 */
import type { CampaignEntity } from "./campaign-2026-07-25-manifest";

const PERIOD_LABELS: Record<string, string> = {
  PRE: "Período Prehispánico",
  CON: "Conquista y Colonia Temprana",
  COL: "Colonia Madura",
  PRE_IND: "Crisis Colonial y Pre-Independencia",
  IND: "Independencia y Gran Colombia",
  NGR: "Nueva Granada y Reformas Liberales",
  EUC: "Estados Unidos de Colombia y Radicalismo",
  REG: "Regeneración y Hegemonía Conservadora",
  REP_LIB: "República Liberal",
  VIO: "La Violencia y Dictadura",
  FN: "Frente Nacional",
  POS: "Posconflicto y Colombia Contemporánea",
};

const person = (label: string, key: string, periodCode: string): CampaignEntity => ({
  type: "person",
  key: `person:${key}`,
  label,
  periodCode,
  intent: `${label}, trayectoria y papel en la historia de Colombia, con foco editorial en ${PERIOD_LABELS[periodCode]} (${periodCode})`,
});

export const CAMPAIGN_ENTITIES: CampaignEntity[] = [
  // Período Prehispánico — autoridades indígenas en la víspera del contacto.
  person("Tisquesusa", "tisquesusa", "PRE"),
  person("Quemuenchatocha", "quemuenchatocha", "PRE"),
  person("Sagipa", "sagipa", "PRE"),
  person("Tundama", "tundama", "PRE"),
  person("Aquiminzaque", "aquiminzaque", "PRE"),

  // Conquista y Colonia Temprana.
  person("Juan de Castellanos", "juan-de-castellanos", "CON"),
  person("Carlos V", "carlos-v", "CON"),
  person("Felipe II", "felipe-ii", "CON"),
  person("Jorge Robledo", "jorge-robledo", "CON"),
  person("Hernán Pérez de Quesada", "hernan-perez-de-quesada", "CON"),
  person("Nicolás de Federmán", "nicolas-de-federman", "CON"),
  person("Rodrigo de Bastidas", "rodrigo-de-bastidas", "CON"),

  // Colonia Madura.
  person("Juan Rodríguez Freyle", "juan-rodriguez-freyle", "COL"),
  person("Lucas Fernández de Piedrahita", "lucas-fernandez-de-piedrahita", "COL"),
  person("Francisco Antonio Moreno y Escandón", "francisco-antonio-moreno-y-escandon", "COL"),
  person("Alonso de Sandoval", "alonso-de-sandoval", "COL"),
  person("Francisca Josefa de Castillo", "francisca-josefa-de-castillo", "COL"),
  person("Juan Tama", "juan-tama", "COL"),

  // Crisis Colonial y Pre-Independencia.
  person("Pedro Fermín de Vargas", "pedro-fermin-de-vargas", "PRE_IND"),
  person("Manuel del Socorro Rodríguez", "manuel-del-socorro-rodriguez", "PRE_IND"),
  person("Ambrosio Pisco", "ambrosio-pisco", "PRE_IND"),

  // Independencia y Gran Colombia.
  person("Rafael Urdaneta", "rafael-urdaneta", "IND"),
  person("Pedro Romero", "pedro-romero", "IND"),

  // Estados Unidos de Colombia y Radicalismo.
  person("Miguel Samper", "miguel-samper", "EUC"),
  person("Candelario Obeso", "candelario-obeso", "EUC"),

  // República Liberal.
  person("Gerardo Molina", "gerardo-molina", "REP_LIB"),
  person("Diego Luis Córdoba", "diego-luis-cordoba", "REP_LIB"),
  person("Ofelia Uribe de Acosta", "ofelia-uribe-de-acosta", "REP_LIB"),

  // La Violencia y Dictadura.
  person("Esmeralda Arboleda", "esmeralda-arboleda", "VIO"),
  person("Guadalupe Salcedo", "guadalupe-salcedo", "VIO"),
  person("Miguel Ángel Builes", "miguel-angel-builes", "VIO"),
  person("Juan Roa Sierra", "juan-roa-sierra", "VIO"),
  person("Jacobo Prías Alape", "jacobo-prias-alape", "VIO"),

  // Frente Nacional.
  person("Manuel Zapata Olivella", "manuel-zapata-olivella", "FN"),

  // Tres de los demás períodos no nombrados.
  person("Juan José Nieto", "juan-jose-nieto", "NGR"),
  person("José Eustasio Rivera", "jose-eustasio-rivera", "REG"),
  person("Patricia Tobón Yagarí", "patricia-tobon-yagari", "POS"),
];

export const CAMPAIGN_MASTER_IDS = [] as const;

export const EXPECTED_PERIOD_COUNTS = {
  PRE: 5,
  CON: 7,
  COL: 6,
  PRE_IND: 3,
  IND: 2,
  NGR: 1,
  EUC: 2,
  REG: 1,
  REP_LIB: 3,
  VIO: 5,
  FN: 1,
  POS: 1,
} as const;
