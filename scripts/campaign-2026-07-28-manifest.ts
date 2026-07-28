/**
 * Segundo lote editorial de 120 páginas solicitado el 2026-07-28.
 *
 * Criterios:
 * - 30 llaves por categoría y ninguna publicada;
 * - entidades canónicas del registro, sin instituciones mal tipadas ni aliases;
 * - personas con identidad documental suficientemente reconocible para portada;
 * - lugares colombianos o directamente ligados a la historia de Colombia;
 * - conceptos diferenciados de las ideas ya publicadas;
 * - preguntas madre gate 5/5, con cobertura de los 16 períodos y reparto exacto
 *   de 3 preguntas por cada una de las 10 categorías editoriales.
 */
import type { CampaignEntity } from "./campaign-2026-07-25-manifest";

const person = (label: string, key: string): CampaignEntity => ({
  type: "person",
  key: `person:${key}`,
  label,
  intent: `${label}, trayectoria y papel en la historia de Colombia`,
});

const place = (label: string, key: string, context: string): CampaignEntity => ({
  type: "place",
  key: `place:${key}`,
  label,
  intent: `${label}: ${context}`,
});

const concept = (label: string, key: string): CampaignEntity => ({
  type: "concept",
  key: `concept:${key}`,
  label,
  intent: `${label} como concepto y proceso en la historia de Colombia`,
});

export const CAMPAIGN_ENTITIES: CampaignEntity[] = [
  // Personas — diversidad temporal, regional, étnica y de género.
  person("Antonio Caballero y Góngora", "antonio-caballero-y-gongora"),
  person("Sebastián de Belalcázar", "sebastian-de-belalcazar"),
  person("Alexander von Humboldt", "alexander-von-humboldt"),
  person("Antonio José de Sucre", "antonio-jose-de-sucre"),
  person("José Antonio Páez", "jose-antonio-paez"),
  person("Florentino González", "florentino-gonzalez"),
  person("José María Samper", "jose-maria-samper"),
  person("Soledad Acosta de Samper", "soledad-acosta-de-samper"),
  person("Rufino José Cuervo", "rufino-jose-cuervo"),
  person("Claudia López", "claudia-lopez"),
  person("Tomás Carrasquilla", "tomas-carrasquilla"),
  person("José Eustasio Rivera", "jose-eustasio-rivera"),
  person("Rodrigo Londoño", "rodrigo-londono"),
  person("León XIII", "leon-xiii"),
  person("Guillermo León Valencia", "guillermo-leon-valencia"),
  person("Darío Echandía", "dario-echandia"),
  person("María Eugenia Rojas", "maria-eugenia-rojas"),
  person("Aída Avella", "aida-avella"),
  person("Iván Márquez", "ivan-marquez"),
  person("Manuel Cepeda Vargas", "manuel-cepeda-vargas"),
  person("Rodrigo Lara Bonilla", "rodrigo-lara-bonilla"),
  person("Piedad Córdoba", "piedad-cordoba"),
  person("Francisco Rojas Birry", "francisco-rojas-birry"),
  person("Raúl Reyes", "raul-reyes"),
  person("Carlos Rosero", "carlos-rosero"),
  person("Rafael Pardo", "rafael-pardo"),
  person("Antanas Mockus", "antanas-mockus"),
  person("Ingrid Betancourt", "ingrid-betancourt"),
  person("Horacio Serpa", "horacio-serpa"),
  person("Patricia Linares", "patricia-linares"),

  // Lugares — ciudades, regiones, ríos y escenarios históricos inequívocos.
  place("Santa Marta", "santa-marta", "ciudad caribeña y puerto histórico"),
  place("Pasto", "pasto", "ciudad andina y foco de resistencia realista"),
  place("Río Magdalena", "rio-magdalena", "eje fluvial de la formación territorial y económica"),
  place("Sierra Nevada", "sierra-nevada", "macizo del Caribe y territorio indígena"),
  place("Cartagena de Indias", "cartagena-de-indias", "puerto colonial, republicano y caribeño"),
  place("Comuna 13", "comuna-13", "territorio urbano de Medellín marcado por guerra y resistencia"),
  place("Honda", "honda", "puerto histórico del río Magdalena"),
  place("Sur de Bolívar", "sur-de-bolivar", "región minera y corredor del conflicto"),
  place("Apartadó", "apartado", "municipio de Urabá y centro de colonización bananera"),
  place("Tierradentro", "tierradentro", "territorio indígena nasa y región arqueológica"),
  place("Valledupar", "valledupar", "ciudad del Caribe interior y centro regional"),
  place("Villavicencio", "villavicencio", "puerta urbana de los Llanos Orientales"),
  place("Mapiripán", "mapiripan", "municipio del Meta y lugar de memoria del conflicto"),
  place("Riohacha", "riohacha", "ciudad caribeña y territorio de relación con La Guajira"),
  place("Cimitarra", "cimitarra", "municipio del Magdalena Medio y frontera agraria"),
  place("San Vicente de Chucurí", "san-vicente-de-chucuri", "municipio santandereano y zona de colonización"),
  place("Bajo Atrato", "bajo-atrato", "subregión afroindígena, fluvial y fronteriza"),
  place("Mariquita", "mariquita", "villa colonial y sede histórica de la Expedición Botánica"),
  place("Caribe colombiano", "caribe-colombiano", "región histórica, cultural y económica"),
  place("Casa Verde", "casa-verde", "campamento histórico de las FARC y escenario de diálogos"),
  place("Atlántico", "atlantico", "departamento caribeño y corredor portuario"),
  place("Oriente antioqueño", "oriente-antioqueno", "subregión de poblamiento, infraestructura y conflicto"),
  place("Toribío", "toribio", "municipio nasa del norte del Cauca"),
  place("Amazonas", "amazonas", "departamento fronterizo y territorio amazónico"),
  place("Sur del Tolima", "sur-del-tolima", "región agraria y escenario de violencia política"),
  place("Viotá", "viota", "municipio cafetero y epicentro de luchas agrarias"),
  place("Bolívar", "bolivar", "departamento caribeño y territorio histórico"),
  place("Darién", "darien", "región fronteriza entre Colombia y Panamá"),
  place("Norte del Cauca", "norte-del-cauca", "región indígena, afrodescendiente e industrial"),
  place("Sogamoso", "sogamoso", "ciudad boyacense de raíz muisca y centro industrial"),

  // Conceptos — procesos diferenciados y con respaldo transversal en el corpus.
  concept("Frontera agrícola", "frontera-agricola"),
  concept("Descentralización", "descentralizacion"),
  concept("Enemigo interno", "enemigo-interno"),
  concept("Soberanía", "soberania"),
  concept("Limpieza social", "limpieza-social"),
  concept("Violencia bipartidista", "violencia-bipartidista"),
  concept("Anticomunismo", "anticomunismo"),
  concept("Convivir", "convivir"),
  concept("Extractivismo", "extractivismo"),
  concept("Multiculturalismo constitucional", "multiculturalismo-constitucional"),
  concept("Comisión de la Verdad", "comision-de-la-verdad"),
  concept("Aparcería", "aparceria"),
  concept("Autodefensa campesina", "autodefensa-campesina"),
  concept("Desamortización", "desamortizacion"),
  concept("Desaparición forzada", "desaparicion-forzada"),
  concept("Hacienda cafetera", "hacienda-cafetera"),
  concept("Patronato", "patronato"),
  concept("Restitución de tierras", "restitucion-de-tierras"),
  concept("Función social de la propiedad", "funcion-social-de-la-propiedad"),
  concept("Mito fundacional", "mito-fundacional"),
  concept("Narcoparamilitarismo", "narcoparamilitarismo"),
  concept("Combinación de formas de lucha", "combinacion-de-formas-de-lucha"),
  concept("Alianza para el Progreso", "alianza-para-el-progreso"),
  concept("Amnistía", "amnistia"),
  concept("Asamblea Constituyente", "asamblea-constituyente"),
  concept("Caudillismo", "caudillismo"),
  concept("Cimarronaje", "cimarronaje"),
  concept("Consulta previa", "consulta-previa"),
  concept("Estado social de derecho", "estado-social-de-derecho"),
  concept("Opinión pública", "opinion-publica"),
];

/**
 * Preguntas madre gate 5/5. Cuotas:
 * - 2 por período, salvo C91 y SDE (1 cada uno): 30 en total;
 * - 3 por categoría editorial: CON, CUL, ECO, HIS, INS, MOV, POL, REL, SOC, TER.
 */
export const CAMPAIGN_MASTER_IDS = [
  "cmq6s7iyp02pzvjhcj5g83rwk",
  "cmq6s7o4a02sbvjhcqna72k2i",
  "cmq6s76cy02jrvjhc2d51duyo",
  "cmq6s6zni02gkvjhcrdacxpaq",
  "cmq6s4mz90190vjhchiykirnk",
  "cmq6s2rfl000cvjhckpgrte5g",
  "cmq6s7ig502pqvjhctd4vrwqw",
  "cmq6s6uzs02e5vjhcbxvmj977",
  "cmq6s2w48003tvjhcgwqjhgj3",
  "cmq6s54kk01khvjhcgjuwerq2",
  "cmq6s3b9200havjhcajb2cbyg",
  "cmq6s5oyn01txvjhcp5c3xjos",
  "cmq6s6ywv02g8vjhcoagw4ieb",
  "cmq6s3vj800tbvjhcg4ex0doy",
  "cmq4k1qm0087fvjhgjjih2nhg",
  "cmq4jxig905t5vjhg1cnp2sxx",
  "cmq4k2i1s08nuvjhgfodlv39d",
  "cmq4k2uq708wpvjhgppwvejz4",
  "cmq4k4mem09yivjhgu4kttz5q",
  "cmq6s61l7020mvjhcfdsfof44",
  "cmq4k2yay08yhvjhg1kj1u90b",
  "cmq4k3ba10974vjhgchhfhzn7",
  "cmq4jraoj01b9vjhgvsj5af9t",
  "cmq4ju94i03gdvjhgeutq49g8",
  "cmq4jvs6k04mgvjhgu8trtujm",
  "cmq4jqzr3010nvjhgznolpm0c",
  "cmq4k2o0y08rovjhg6asf9lvd",
  "cmq6s36dm00czvjhc4yaf5uot",
  "cmq4k35np093nvjhggoxq6r8g",
  "cmq4jxxiy0636vjhgilmxnvhi",
] as const;
