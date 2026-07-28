/**
 * Lote editorial solicitado el 2026-07-25.
 *
 * Criterios:
 * - entidades canónicas aún no producidas/publicadas;
 * - personas realmente humanas (sin instituciones mal clasificadas);
 * - lugares sin alias obvios de páginas ya publicadas;
 * - conceptos sin duplicar páginas existentes con una variante nominal;
 * - preguntas madre gate 5/5, con respaldo alto y diversidad de período/categoría.
 */

export interface CampaignEntity {
  type: "person" | "place" | "concept";
  key: string;
  label: string;
  intent: string;
}

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
  // Personas — 30 figuras canónicas, sin alias de las 56 páginas ya publicadas.
  person("Francisco José de Caldas", "francisco-jose-de-caldas"),
  person("Gustavo Petro", "gustavo-petro"),
  person("Enrique Olaya Herrera", "enrique-olaya-herrera"),
  person("José Manuel Marroquín", "jose-manuel-marroquin"),
  person("María Cano", "maria-cano"),
  person("Antonio Nariño", "antonio-narino"),
  person("Manuel Ancízar", "manuel-ancizar"),
  person("Gonzalo Jiménez de Quesada", "gonzalo-jimenez-de-quesada"),
  person("Iván Cepeda", "ivan-cepeda"),
  person("Gabriel García Márquez", "gabriel-garcia-marquez"),
  person("Policarpa Salavarrieta", "policarpa-salavarrieta"),
  person("Miguel Abadía Méndez", "miguel-abadia-mendez"),
  person("José María Obando", "jose-maria-obando"),
  person("Agustín Codazzi", "agustin-codazzi"),
  person("Bernardo Jaramillo Ossa", "bernardo-jaramillo-ossa"),
  person("Theodore Roosevelt", "theodore-roosevelt"),
  person("Jaime Bateman", "jaime-bateman"),
  person("José Acevedo y Gómez", "jose-acevedo-y-gomez"),
  person("José Antonio Galán", "jose-antonio-galan"),
  person("Alfonso Cano", "alfonso-cano"),
  person("Francia Márquez", "francia-marquez"),
  person("Manuela Sáenz", "manuela-saenz"),
  person("Luis López de Mesa", "luis-lopez-de-mesa"),
  person("José Manuel Restrepo", "jose-manuel-restrepo"),
  person("Aquileo Parra", "aquileo-parra"),
  person("Camilo Torres Tenorio", "camilo-torres"),
  person("José Celestino Mutis", "jose-celestino-mutis"),
  person("Pablo Morillo", "pablo-morillo"),
  person("Carlos E. Restrepo", "carlos-e-restrepo"),
  person("José María Melo", "jose-maria-melo"),

  // Lugares — 30 espacios con anclaje colombiano o regional inequívoco.
  place("Santander", "santander", "departamento colombiano y región histórica"),
  place("Sucre", "sucre", "departamento colombiano y su formación histórica"),
  place("Pacífico colombiano", "pacifico-colombiano", "región histórica, social y ambiental"),
  place("Cesar", "cesar", "departamento colombiano y territorio del Caribe interior"),
  place("Santafé", "santafe", "la ciudad colonial que se convirtió en Bogotá"),
  place("Nariño", "narino", "departamento fronterizo del suroccidente colombiano"),
  place("Quito", "quito", "ciudad andina y sus vínculos con la historia neogranadina"),
  place("Quibdó", "quibdo", "capital del Chocó y eje histórico del Atrato"),
  place("Mompox", "mompox", "villa histórica del río Magdalena"),
  place("Amazonía", "amazonia", "región amazónica en la historia territorial de Colombia"),
  place("Guaviare", "guaviare", "departamento amazónico y frontera de colonización"),
  place("San Vicente del Caguán", "san-vicente-del-caguan", "municipio y escenario de guerra y negociación"),
  place("Bajo Cauca", "bajo-cauca", "subregión antioqueña y corredor minero"),
  place("Bucaramanga", "bucaramanga", "ciudad y centro regional de Santander"),
  place("Trujillo", "trujillo", "municipio del Valle del Cauca y escenario de violencia"),
  place("Rionegro", "rionegro", "municipio antioqueño y escenario constitucional"),
  place("Nueva Granada", "nueva-granada", "territorio histórico colonial y republicano"),
  place("Palacio de Justicia", "palacio-de-justicia", "edificio de Bogotá y escenario de los hechos de 1985"),
  place("Socorro", "socorro", "villa santandereana y foco de la Revolución de los Comuneros"),
  place("Vaupés", "vaupes", "departamento amazónico y territorio indígena"),
  place("Manizales", "manizales", "ciudad cafetera y centro regional"),
  place("Santa Fe de Ralito", "santa-fe-de-ralito", "escenario de la negociación con las AUC"),
  place("Eje Cafetero", "eje-cafetero", "región de colonización y economía cafetera"),
  place("Vichada", "vichada", "departamento de la Orinoquía y frontera agraria"),
  place("Bojayá", "bojaya", "municipio del Chocó y lugar de memoria del conflicto"),
  place("Leticia", "leticia", "ciudad amazónica y frontera internacional"),
  place("La Uribe", "la-uribe", "municipio del Meta y escenario histórico de diálogos"),
  place("El Salado", "el-salado", "corregimiento de Bolívar y lugar de memoria"),
  place("Atrato", "atrato", "río, cuenca y corredor histórico del Pacífico"),
  place("Norte de Santander", "norte-de-santander", "departamento fronterizo y región del Catatumbo"),

  // Conceptos — 30 nociones/procesos diferenciados de las 36 ideas ya públicas.
  concept("Mestizaje", "mestizaje"),
  concept("Larga duración", "larga-duracion"),
  concept("Lavado de activos", "lavado-de-activos"),
  concept("Repúblicas independientes", "republicas-independientes"),
  concept("Colonización antioqueña", "colonizacion-antioquena"),
  concept("Modernización conservadora", "modernizacion-conservadora"),
  concept("Economía cocalera", "economia-cocalera"),
  concept("Enclave bananero", "enclave-bananero"),
  concept("Populismo", "populismo"),
  concept("Doctrina contrainsurgente", "doctrina-contrainsurgente"),
  concept("Capital extranjero", "capital-extranjero"),
  concept("Guerra contra las drogas", "guerra-contra-las-drogas"),
  concept("Impunidad", "impunidad"),
  concept("Encomienda", "encomienda"),
  concept("Clientelismo armado", "clientelismo-armado"),
  concept("Federalismo radical", "federalismo-radical"),
  concept("Ley 70", "ley-70"),
  concept("Violencia sexual", "violencia-sexual"),
  concept("Baldíos", "baldios"),
  concept("Desmovilización", "desmovilizacion"),
  concept("Narcoterrorismo", "narcoterrorismo"),
  concept("Reformas borbónicas", "reformas-borbonicas"),
  concept("Resistencia civil", "resistencia-civil"),
  concept("Sindicalismo", "sindicalismo"),
  concept("Bolivarianismo", "bolivarianismo"),
  concept("Verdad judicial", "verdad-judicial"),
  concept("Glifosato", "glifosato"),
  concept("Sustitución de importaciones", "sustitucion-de-importaciones"),
  concept("Geografía del conflicto", "geografia-del-conflicto"),
  concept("Nueva historia", "nueva-historia"),
];

/**
 * Preguntas madre gate 5/5. La selección limita solapamientos con las 30 ya
 * publicadas y reparte el lote entre períodos y categorías.
 */
export const CAMPAIGN_MASTER_IDS = [
  "cmq4jvmt604igvjhg62awnl06",
  "cmq4jsdau024qvjhgjrebx2na",
  "cmq4jvsrq04novjhg9jsfk0lv",
  "cmq4jq27s009ivjhg3qg9q1cp",
  "cmq4k3xg409l9vjhgy9lvegtb",
  "cmq4jqzhy0106vjhg83duqpnp",
  "cmq4jzpfg073dvjhga5samwnn",
  "cmq4k39x70962vjhg8a4z4jdb",
  "cmq4k1xkr08b4vjhgzgaaub4z",
  "cmq4jrb6l01bwvjhg22mirle6",
  "cmq4ju8ve03fxvjhgez3gdpf2",
  "cmq4k47cf09qzvjhg1oykv6y2",
  "cmq4jqoal00ryvjhgec2t3aao",
  "cmq4k138s07tsvjhgjj0t3vlz",
  "cmq4jswuw02kevjhg8tpkgjry",
  "cmq4k40x109ntvjhg90uhjgn3",
  "cmq4k26rv08gwvjhgauhe6dia",
  "cmq4juja503nkvjhgamrdn6nq",
  "cmq4jtck202tyvjhgsl68vo1j",
  "cmq4jy83c06ajvjhgnu3vf2ya",
  "cmq4jutzd03w0vjhgdw67pr43",
  "cmq6s38js00eovjhcwugu3q01",
  "cmq4jxh3905s0vjhgr8r64dek",
  "cmq4jyfzn06e7vjhg05th1670",
  "cmq4jwiau053vvjhgkkiaytlt",
  "cmq4k3r2d09guvjhgf6zlnwp7",
  "cmq4jvwwv04qyvjhgf1rxloi1",
  "cmq4jvd4t04ajvjhge7zfib8m",
  "cmq4k1k22083gvjhguaqvlq7k",
  "cmq4k3oh609fgvjhgnkomz8mi",
] as const;
