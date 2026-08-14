/**
 * Campaña editorial solicitada el 2026-08-14.
 *
 * Alcance:
 * - 150 ideas: diez inéditas por cada una de las quince épocas cronológicas;
 * - 60 lugares colombianos inéditos, canónicos y con presencia documental;
 * - fichas extensas, portada persistida, SEO, estructura completa y geo WGS84.
 *
 * La categoría TRANS no es una época cronológica y por eso no recibe cuota.
 * La selección parte del registro canónico del corpus, privilegia entidades con
 * varias menciones y evita aliases o variantes nominales de fichas publicadas.
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
  CNA: "Crisis, Narcotráfico y Apertura",
  C91: "Constitución del 91 y Escalamiento del Conflicto",
  SDE: "Seguridad Democrática y Proceso de Paz",
  POS: "Posconflicto y Colombia Contemporánea",
};

const concept = (
  label: string,
  key: string,
  periodCode: string,
): CampaignEntity => ({
  type: "concept",
  key: `concept:${key}`,
  label,
  periodCode,
  intent: `${label} como idea, institución o proceso de la historia de Colombia, investigado con foco editorial en ${PERIOD_LABELS[periodCode]} (${periodCode}) y sin perder sus antecedentes ni efectos de larga duración`,
});

const place = (
  label: string,
  key: string,
  context: string,
): CampaignEntity => ({
  type: "place",
  key: `place:${key}`,
  label,
  intent: `${label}: ${context}; historia territorial colombiana, transformaciones, actores, conflictos y memoria del lugar`,
});

export const CAMPAIGN_ENTITIES: CampaignEntity[] = [
  // PRE — diez conceptos con anclaje explícito en sociedades prehispánicas.
  concept("Cacicazgo muisca", "cacicazgo-muisca", "PRE"),
  concept("Confederación muisca", "confederacion-muisca", "PRE"),
  concept("El Dorado", "el-dorado", "PRE"),
  concept("Camellones zenúes", "camellones-zenues", "PRE"),
  concept("Calendario muisca", "calendario-muisca", "PRE"),
  concept("Cosmovisión muisca", "cosmovision-muisca", "PRE"),
  concept("Urbanismo prehispánico", "urbanismo-prehispanico", "PRE"),
  concept("Geografía sagrada", "geografia-sagrada", "PRE"),
  concept("Bioarqueología", "bioarqueologia", "PRE"),
  concept("Orfebrería precolombina", "orfebreria-precolombina", "PRE"),

  // CON — instituciones y procesos de la conquista y el primer orden colonial.
  concept("Resistencia indígena", "resistencia-indigena", "CON"),
  concept("Evangelización", "evangelizacion", "CON"),
  concept("Tributo indígena", "tributo-indigena", "CON"),
  concept("Catástrofe demográfica", "catastrofe-demografica", "CON"),
  concept("Reducción", "reduccion", "CON"),
  concept("Real Audiencia", "real-audiencia", "CON"),
  concept("Guerra justa", "guerra-justa", "CON"),
  concept("Capitulación", "capitulacion", "CON"),
  concept("Derecho indiano", "derecho-indiano", "CON"),
  concept("Esclavitud africana", "esclavitud-africana", "CON"),

  // COL — orden social, economía y cultura de la Colonia madura.
  concept("Religiosidad popular", "religiosidad-popular", "COL"),
  concept("Limpieza de sangre", "limpieza-de-sangre", "COL"),
  concept("Hacienda", "hacienda", "COL"),
  concept("Sociedad de castas", "sociedad-de-castas", "COL"),
  concept("Trata atlántica", "trata-atlantica", "COL"),
  concept("Cabildo", "cabildo", "COL"),
  concept("Sincretismo", "sincretismo", "COL"),
  concept("Compadrazgo", "compadrazgo", "COL"),
  concept("Palenque", "palenque", "COL"),
  concept("Concertaje", "concertaje", "COL"),

  // PRE_IND — crisis imperial, ilustración y movilización comunera.
  concept("Ilustración criolla", "ilustracion-criolla", "PRE_IND"),
  concept("Capitulaciones", "capitulaciones", "PRE_IND"),
  concept("Soberanía indígena", "soberania-indigena", "PRE_IND"),
  concept("Expedición Botánica", "expedicion-botanica", "PRE_IND"),
  concept("Derechos del Hombre", "derechos-del-hombre", "PRE_IND"),
  concept("Cabildo abierto", "cabildo-abierto", "PRE_IND"),
  concept("Estanco del tabaco", "estanco-del-tabaco", "PRE_IND"),
  concept("Despotismo ilustrado", "despotismo-ilustrado", "PRE_IND"),
  concept("Pacto colonial", "pacto-colonial", "PRE_IND"),
  concept("Sociabilidad letrada", "sociabilidad-letrada", "PRE_IND"),

  // IND — lenguajes, guerras e instituciones de la ruptura independentista.
  concept("Soberanía popular", "soberania-popular", "IND"),
  concept("Patria Boba", "patria-boba", "IND"),
  concept("Pardocracia", "pardocracia", "IND"),
  concept("Pacificación", "pacificacion", "IND"),
  concept("Reconquista", "reconquista", "IND"),
  concept("Guerra a muerte", "guerra-a-muerte", "IND"),
  concept("Libertad de vientres", "libertad-de-vientres", "IND"),
  concept("Gran Colombia", "gran-colombia", "IND"),
  concept("Continuidad colonial", "continuidad-colonial", "IND"),
  concept("Dependencia financiera", "dependencia-financiera", "IND"),

  // NGR — reformas liberales, ciudadanía y representación del territorio.
  concept("Liberalismo radical", "liberalismo-radical", "NGR"),
  concept("Anticlericalismo", "anticlericalismo", "NGR"),
  concept("Costumbrismo", "costumbrismo", "NGR"),
  concept("Librecambio", "librecambio", "NGR"),
  concept("Proteccionismo", "proteccionismo", "NGR"),
  concept("Comisión Corográfica", "comision-corografica", "NGR"),
  concept("Sociedades democráticas", "sociedades-democraticas", "NGR"),
  concept("Artesanado", "artesanado", "NGR"),
  concept("Utilitarismo", "utilitarismo", "NGR"),
  concept("Geografía política", "geografia-politica", "NGR"),

  // EUC — federalismo, secularización y cultura radical.
  concept("Soberanía estatal", "soberania-estatal", "EUC"),
  concept("Olimpo Radical", "olimpo-radical", "EUC"),
  concept("Educación laica", "educacion-laica", "EUC"),
  concept("Capital cultural", "capital-cultural", "EUC"),
  concept("Guerras civiles", "guerras-civiles", "EUC"),
  concept("Tuición de cultos", "tuicion-de-cultos", "EUC"),
  concept("Masonería", "masoneria", "EUC"),
  concept("Orden público", "orden-publico", "EUC"),
  concept("Culto bolivariano", "culto-bolivariano", "EUC"),
  concept("Educación femenina", "educacion-femenina", "EUC"),

  // REG — nación, economía y orden social de la hegemonía conservadora.
  concept("Identidad regional", "identidad-regional", "REG"),
  concept("Economía de enclave", "economia-de-enclave", "REG"),
  concept("Hispanismo", "hispanismo", "REG"),
  concept("Imaginario nacional", "imaginario-nacional", "REG"),
  concept("Esfera pública", "esfera-publica", "REG"),
  concept("Danza de los millones", "danza-de-los-millones", "REG"),
  concept("Blanqueamiento", "blanqueamiento", "REG"),
  concept("Catolicismo social", "catolicismo-social", "REG"),
  concept("Guerra civil", "guerra-civil", "REG"),
  concept("Panamericanismo", "panamericanismo", "REG"),

  // REP_LIB — reforma social, Amazonía y modernización estatal.
  concept("Frontera amazónica", "frontera-amazonica", "REP_LIB"),
  concept("Ley 200 de 1936", "ley-200-de-1936", "REP_LIB"),
  concept("Reforma constitucional", "reforma-constitucional", "REP_LIB"),
  concept("Corporativismo", "corporativismo", "REP_LIB"),
  concept("Cooptación", "cooptacion", "REP_LIB"),
  concept("Frente Popular", "frente-popular", "REP_LIB"),
  concept("Populismo agrario", "populismo-agrario", "REP_LIB"),
  concept("Colonato", "colonato", "REP_LIB"),
  concept("Soberanía amazónica", "soberania-amazonica", "REP_LIB"),
  concept("Diplomacia cultural", "diplomacia-cultural", "REP_LIB"),

  // VIO — repertorios armados, estructura agraria y autoritarismo.
  concept("Pájaros", "pajaros", "VIO"),
  concept("Bandolerismo", "bandolerismo", "VIO"),
  concept("Acumulación originaria", "acumulacion-originaria", "VIO"),
  concept("Cuestión agraria", "cuestion-agraria", "VIO"),
  concept("Ciudadanía", "ciudadania", "VIO"),
  concept("Tercera fuerza", "tercera-fuerza", "VIO"),
  concept("Chulavitas", "chulavitas", "VIO"),
  concept("Migración forzada", "migracion-forzada", "VIO"),
  concept("Sectarismo bipartidista", "sectarismo-bipartidista", "VIO"),
  concept("Conflicto agrario", "conflicto-agrario", "VIO"),

  // FN — modernización, reforma agraria y cierre político.
  concept("INCORA", "incora", "FN"),
  concept("Modernización", "modernizacion", "FN"),
  concept("Insurgencia", "insurgencia", "FN"),
  concept("Migración rural-urbana", "migracion-rural-urbana", "FN"),
  concept("Recuperación de tierras", "recuperacion-de-tierras", "FN"),
  concept("Reforma agraria fallida", "reforma-agraria-fallida", "FN"),
  concept("ANAPO", "anapo", "FN"),
  concept("Desarrollismo", "desarrollismo", "FN"),
  concept("Contrarreforma", "contrarreforma", "FN"),
  concept("Fraude electoral", "fraude-electoral", "FN"),

  // CNA — narcotráfico, guerra sucia y crisis del régimen.
  concept("Colonización", "colonizacion", "CNA"),
  concept("Guerra sucia", "guerra-sucia", "CNA"),
  concept("Narcotráfico", "narcotrafico", "CNA"),
  concept("Estado de excepción", "estado-de-excepcion", "CNA"),
  concept("Bonanza marimbera", "bonanza-marimbera", "CNA"),
  concept("Paro cívico", "paro-civico", "CNA"),
  concept("Hacienda ganadera", "hacienda-ganadera", "CNA"),
  concept("Derechos humanos", "derechos-humanos", "CNA"),
  concept("Guerrilla urbana", "guerrilla-urbana", "CNA"),
  concept("Violentología", "violentologia", "CNA"),

  // C91 — autonomía, guerra territorial y economía política del conflicto.
  concept("Autonomía territorial", "autonomia-territorial", "C91"),
  concept("Colonización campesina", "colonizacion-campesina", "C91"),
  concept("Monopolio de la violencia", "monopolio-de-la-violencia", "C91"),
  concept("Sustitución de cultivos", "sustitucion-de-cultivos", "C91"),
  concept("Autodefensas", "autodefensas", "C91"),
  concept("Soberanía fragmentada", "soberania-fragmentada", "C91"),
  concept("Soberanía limitada", "soberania-limitada", "C91"),
  concept("Titulación colectiva", "titulacion-colectiva", "C91"),
  concept("Capital transnacional", "capital-transnacional", "C91"),
  concept("Autonomía indígena", "autonomia-indigena", "C91"),

  // SDE — seguridad, derechos, memorias y economías territoriales.
  concept("Subregistro", "subregistro", "SDE"),
  concept("Cooperación internacional", "cooperacion-internacional", "SDE"),
  concept("Doctrina militar", "doctrina-militar", "SDE"),
  concept("Control territorial", "control-territorial", "SDE"),
  concept("Activismo judicial", "activismo-judicial", "SDE"),
  concept("Prohibicionismo", "prohibicionismo", "SDE"),
  concept("Palma africana", "palma-africana", "SDE"),
  concept("Memoria subalterna", "memoria-subalterna", "SDE"),
  concept("Body count", "body-count", "SDE"),
  concept("Soberanía alimentaria", "soberania-alimentaria", "SDE"),

  // POS — implementación de paz, verdad, reparación y disputas de memoria.
  concept("Reparación simbólica", "reparacion-simbolica", "POS"),
  concept("Verdad histórica", "verdad-historica", "POS"),
  concept("Historia oral", "historia-oral", "POS"),
  concept("Reforma rural integral", "reforma-rural-integral", "POS"),
  concept("Reincorporación", "reincorporacion", "POS"),
  concept("Polarización", "polarizacion", "POS"),
  concept("Testimonio", "testimonio", "POS"),
  concept("Historia oficial", "historia-oficial", "POS"),
  concept("Justicia restaurativa", "justicia-restaurativa", "POS"),
  concept("Paz territorial", "paz-territorial", "POS"),

  // Lugares — 60 ciudades, municipios, regiones, ríos y sitios de memoria.
  place("Santa Marta", "santa-marta", "ciudad portuaria del Caribe y uno de los asentamientos coloniales más antiguos"),
  place("Pasto", "pasto", "ciudad andina del suroccidente y nodo de lealtades realistas, república y región"),
  place("Bolívar", "bolivar", "departamento del Caribe colombiano, distinto de la persona Simón Bolívar"),
  place("Ciudad Bolívar", "ciudad-bolivar", "localidad de Bogotá formada por urbanización popular, desplazamiento y luchas sociales"),
  place("Montería", "monteria", "capital de Córdoba y centro histórico del valle del Sinú"),
  place("San Carlos", "san-carlos", "municipio del Oriente antioqueño marcado por hidroeléctricas, guerra y retorno"),
  place("Sincelejo", "sincelejo", "capital de Sucre y centro regional de las sabanas del Caribe"),
  place("San Andrés", "san-andres", "isla principal del archipiélago colombiano y territorio raizal fronterizo"),
  place("El Pato", "el-pato", "región de colonización campesina entre Caquetá y Huila"),
  place("Envigado", "envigado", "municipio del Valle de Aburrá y escenario de industrialización y redes criminales"),
  place("Segovia", "segovia", "municipio minero del nordeste antioqueño y lugar de violencia política"),
  place("Tierralta", "tierralta", "municipio cordobés del Alto Sinú y entorno del Nudo de Paramillo"),
  place("Tibú", "tibu", "municipio del Catatumbo, frontera petrolera, campesina y cocalera"),
  place("La Chorrera", "la-chorrera", "territorio amazónico asociado a la Casa Arana y a la memoria de los pueblos indígenas"),
  place("Bahía Portete", "bahia-portete", "bahía de la Alta Guajira y lugar de memoria wayúu"),
  place("Maicao", "maicao", "ciudad fronteriza de La Guajira y nodo de comercio y migración"),
  place("Aracataca", "aracataca", "municipio bananero del Magdalena y paisaje literario del Caribe"),
  place("Florencia", "florencia", "capital del Caquetá y puerta de la colonización amazónica"),
  place("Macizo Colombiano", "macizo-colombiano", "nudo montañoso y estrella fluvial del suroccidente colombiano"),
  place("El Castillo", "el-castillo", "municipio del Meta y lugar de memoria del exterminio de la Unión Patriótica"),
  place("El Placer", "el-placer", "corregimiento de Valle del Guamuez, Putumayo, marcado por guerra y memoria comunitaria"),
  place("Ibagué", "ibague", "capital del Tolima y centro político, musical y regional del valle alto del Magdalena"),
  place("Sinú", "sinu", "río y valle caribeño articulador de poblamiento, hacienda, cultura anfibia y conflicto"),
  place("Pereira", "pereira", "ciudad del Eje Cafetero formada por colonización, café y migraciones"),
  place("Riochiquito", "riochiquito", "enclave campesino e indígena del Cauca y antecedente de la guerra insurgente"),
  place("Sibundoy", "sibundoy", "valle y municipio del Alto Putumayo, territorio indígena y corredor andino-amazónico"),
  place("Yacopí", "yacopi", "municipio de Cundinamarca asociado a frontera esmeraldífera y violencia bipartidista"),
  place("Chaparral", "chaparral", "municipio del sur del Tolima y eje de movilización agraria y conflicto"),
  place("Pamplona", "pamplona", "ciudad histórica de Norte de Santander y nodo colonial, educativo y regional"),
  place("El Carmen de Chucurí", "el-carmen-de-chucuri", "municipio santandereano de colonización campesina y disputa armada"),
  place("La Macarena", "la-macarena", "municipio y serranía del Meta en la frontera amazónica y agraria"),
  place("Puerto Triunfo", "puerto-triunfo", "municipio del Magdalena Medio antioqueño marcado por hacienda, narcotráfico y paramilitarismo"),
  place("San José de Apartadó", "san-jose-de-apartado", "corregimiento de Urabá y sede de una comunidad de paz"),
  place("Cordillera Oriental", "cordillera-oriental", "ramal andino que estructura altiplanos, fronteras y corredores históricos del país"),
  place("Bello", "bello", "municipio industrial del norte del Valle de Aburrá"),
  place("Cantón Norte", "canton-norte", "complejo militar de Bogotá y escenario de crisis políticas y armadas"),
  place("Comuna Nororiental", "comuna-nororiental", "conjunto de barrios populares de Medellín formado por migración y urbanización"),
  place("Norte del Valle", "norte-del-valle", "subregión vallecaucana de economía agraria, redes políticas y narcotráfico"),
  place("Tolemaida", "tolemaida", "principal complejo de entrenamiento militar de Colombia, en el valle alto del Magdalena"),
  place("Villarrica", "villarrica", "municipio del oriente del Tolima y escenario de guerra campesina en los años cincuenta"),
  place("Huila", "huila", "departamento del alto Magdalena y región de frontera, café y movilización social"),
  place("Mocoa", "mocoa", "capital del Putumayo y nodo andino-amazónico"),
  place("Neiva", "neiva", "capital del Huila y centro urbano del alto Magdalena"),
  place("Palmira", "palmira", "municipio agroindustrial del Valle del Cauca"),
  place("Zona Bananera", "zona-bananera", "municipio y subregión del Magdalena articulados por enclave bananero y trabajo"),
  place("Ambalema", "ambalema", "puerto histórico del Tolima ligado al tabaco y al río Magdalena"),
  place("Curvaradó", "curvarado", "cuenca y territorio colectivo afrodescendiente del Bajo Atrato"),
  place("La Dorada", "la-dorada", "municipio de Caldas y puerto del Magdalena Medio"),
  place("Patía", "patia", "valle y corredor interandino del Cauca, territorio afrodescendiente y campesino"),
  place("Puerto Gaitán", "puerto-gaitan", "municipio de la Altillanura del Meta, eje petrolero y agroindustrial"),
  place("San Agustín", "san-agustin", "municipio del Huila y paisaje arqueológico prehispánico"),
  place("Simacota", "simacota", "municipio de Santander vinculado a colonización y guerra insurgente"),
  place("Altillanura", "altillanura", "planicie de la Orinoquía transformada por colonización, agroindustria y petróleo"),
  place("Armenia", "armenia", "capital del Quindío y ciudad de la economía cafetera"),
  place("Magangué", "magangue", "puerto de Bolívar en la Depresión Momposina y nodo del comercio fluvial"),
  place("Orinoquía", "orinoquia", "región de llanuras orientales, frontera ganadera, petrolera e indígena"),
  place("Saravena", "saravena", "municipio de Arauca surgido de colonización dirigida y movilización cívica"),
  place("Alto Sinú", "alto-sinu", "subregión cordobesa entre embalses, territorio indígena y conflicto armado"),
  place("La Rochela", "la-rochela", "sitio santandereano de la masacre de una comisión judicial en 1989"),
  place("Mitú", "mitu", "capital del Vaupés, territorio indígena y escenario de la toma de 1998"),
];

export const CAMPAIGN_MASTER_IDS = [] as const;

export const EXPECTED_PERIOD_COUNTS = {
  PRE: 10,
  CON: 10,
  COL: 10,
  PRE_IND: 10,
  IND: 10,
  NGR: 10,
  EUC: 10,
  REG: 10,
  REP_LIB: 10,
  VIO: 10,
  FN: 10,
  CNA: 10,
  C91: 10,
  SDE: 10,
  POS: 10,
} as const;
