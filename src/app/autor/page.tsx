import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/editorial-page.css";

// PublicShell calcula métricas vivas del archivo: nada de resolverlas en build.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Alejandro Gutiérrez Arango, el autor",
    metaDescription:
      "Alejandro Gutiérrez Arango, filósofo y publicista de Medellín, escribe y firma este archivo de historia de Colombia. Qué promete y con qué reglas.",
    keywords: [
      "Alejandro Gutiérrez Arango",
      "autor",
      "filósofo",
      "publicista",
      "Medellín",
      "historia de Colombia",
    ],
  },
  path: "/autor",
  type: "website",
});

export default function AutorPage() {
  return (
    <PublicShell>
      <div className="edp-wrap">
        <header className="edp-head">
          <div className="edp-kick">El autor</div>
          <h1 className="edp-title">Alejandro Gutiérrez Arango</h1>
          <div className="edp-strip">
            <span>Filósofo y publicista</span>
            <span>Medellín, Antioquia</span>
            <span>Autor de Historia Colombiana</span>
          </div>
          <p className="edp-stand">
            Este archivo lo escribo yo. Cada pieza publicada lleva mi firma y, detrás de la firma,
            sus fuentes.
          </p>
        </header>

        <div className="edp-body">
          <div className="edp-col">
            <section className="edp-sec">
              <span className="edp-sec-n">01 · Quién escribe</span>
              <h2 className="edp-h2">Dos oficios que aquí se encuentran</h2>
              <div className="prose edp-prose">
                <p>
                  Me llamo Alejandro Gutiérrez Arango. Soy filósofo y publicista, y soy de Medellín,
                  Antioquia. No voy a llenar esta página con biografía: para leer este archivo importa
                  bastante menos de dónde vengo que con qué reglas escribo. Pero los dos oficios sí
                  explican la forma que tiene el sitio.
                </p>
                <p>
                  De la filosofía queda un hábito difícil de quitarse: preguntar en qué se apoya una
                  afirmación, y no soltar la pregunta hasta llegar al fondo o hasta reconocer que no
                  hay fondo. Aplicada a la historia, esa costumbre ordena el trabajo entero. Obliga a
                  separar lo que una fuente dice de lo que uno quisiera que dijera, y a distinguir
                  entre lo que está documentado, lo que es probable y lo que apenas es una
                  suposición cómoda.
                </p>
                <p>
                  De la publicidad queda lo contrario y lo complementario: un texto que no se
                  entiende no existe. Da igual cuán riguroso sea por dentro; si nadie llega al
                  segundo párrafo, no llegó a ninguna parte. La claridad no es un adorno que se
                  aplica al final, es una obligación desde la primera frase.
                </p>
              </div>

              <p className="edp-rule">Rigor por dentro, legibilidad por fuera.</p>

              <div className="prose edp-prose">
                <p>
                  Ese es el punto exacto donde este archivo existe. La mayoría de lo que se publica
                  sobre historia obliga a escoger: o un texto que se puede leer o un texto que se
                  puede comprobar. Aquí no hay que escoger. La prosa corre limpia y, al margen, cada
                  frase señala el pasaje que la sostiene.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">02 · Qué es este archivo</span>
              <h2 className="edp-h2">Una biblioteca puesta a hablar</h2>
              <div className="prose edp-prose">
                <p>
                  <em>Historia Colombiana</em> es un archivo de lectura sobre el pasado del país:
                  hechos, épocas, personas, lugares, ideas y preguntas. Detrás de todo lo que aquí se
                  lee hay un corpus de libros y documentos reales; ninguna pieza sale de otro lugar.
                </p>
                <p>
                  Mi trabajo consiste en hacer que ese material llegue en forma de texto legible sin
                  perder por el camino lo único que lo hace confiable: la cadena que une cada
                  afirmación con la página de la que salió. Cuando esa cadena se rompe, la frase no
                  se publica. Es una regla simple y es la que más texto elimina.
                </p>
              </div>

              <p className="edp-note">
                El método está explicado en <Link href="/acerca#metodo">Acerca</Link>; el recorrido
                completo de una pieza, en <Link href="/como-trabajamos">Cómo trabajamos</Link>; y el
                corpus, en <Link href="/fuentes">Fuentes</Link>.
              </p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">03 · Lo que firmo</span>
              <h2 className="edp-h2">Cuatro compromisos con quien lee</h2>
              <div className="prose edp-prose">
                <p>
                  Firmar tiene consecuencias. Estas son las que asumo, y son exigibles: si una pieza
                  las incumple, la pieza está mal hecha.
                </p>
              </div>

              <ol className="edp-steps">
                <li className="edp-step">
                  <span className="edp-step-n">01</span>
                  <div>
                    <h3 className="edp-step-t">Ninguna afirmación sin fuente</h3>
                    <p className="edp-step-d">
                      Todo lo que se afirma se puede rastrear hacia atrás hasta el fragmento que lo
                      sostiene. No hay frases de relleno que pasen por sabidas.
                    </p>
                  </div>
                </li>
                <li className="edp-step">
                  <span className="edp-step-n">02</span>
                  <div>
                    <h3 className="edp-step-t">Ninguna pieza sin decisión</h3>
                    <p className="edp-step-d">
                      Nada aparece publicado por el solo hecho de haberse escrito. Publicar es un
                      acto aparte, pieza por pieza, y esa decisión es mía.
                    </p>
                  </div>
                </li>
                <li className="edp-step">
                  <span className="edp-step-n">03</span>
                  <div>
                    <h3 className="edp-step-t">Silencio antes que relleno</h3>
                    <p className="edp-step-d">
                      Si el corpus no alcanza para responder algo, el archivo no responde. Un vacío
                      declarado vale más que un párrafo bien escrito sobre nada.
                    </p>
                  </div>
                </li>
                <li className="edp-step">
                  <span className="edp-step-n">04</span>
                  <div>
                    <h3 className="edp-step-t">Corregir antes que defender</h3>
                    <p className="edp-step-d">
                      Un error detectado se corrige, no se sostiene. El archivo está vivo justamente
                      para eso: para poder cambiar de opinión con la fuente en la mano.
                    </p>
                  </div>
                </li>
              </ol>

              <p className="edp-note">
                Cómo se aplican estos compromisos, caso por caso, está en{" "}
                <Link href="/criterios-editoriales">Criterios editoriales</Link>.
              </p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">04 · Qué quiero que sea</span>
              <h2 className="edp-h2">Un archivo más corto y comprobable</h2>
              <div className="prose edp-prose">
                <p>
                  Prefiero un archivo más corto y comprobable que uno más grande y complaciente. Que
                  crezca despacio no me preocupa; que crezca con piezas que no resistirían una
                  revisión, sí.
                </p>
                <p>
                  Lo que me gustaría que quedara, cuando esto tenga años encima, es una colección de
                  entradas que cualquiera pueda usar como punto de partida serio: leer, entender, y
                  saber de inmediato a qué libro ir si quiere más. Eso es todo lo que un archivo
                  puede honestamente prometer.
                </p>
              </div>
            </section>
          </div>

          <aside className="edp-rail">
            <span className="edp-rail-t">El proyecto</span>
            <Link href="/acerca" className="edp-rail-l">
              Acerca
            </Link>
            <Link href="/como-trabajamos" className="edp-rail-l">
              Cómo trabajamos
            </Link>
            <Link href="/fuentes" className="edp-rail-l">
              Fuentes
            </Link>
            <Link href="/criterios-editoriales" className="edp-rail-l">
              Criterios editoriales
            </Link>
            <Link href="/autor" className="edp-rail-l" aria-current="page">
              El autor
            </Link>
          </aside>
        </div>

        <footer className="edp-foot">
          <div className="edp-sign">Escrito por Alejandro Gutiérrez</div>
          <nav className="edp-next">
            <Link href="/acerca">
              <span className="edp-next-k">Siga por aquí</span>
              <span className="edp-next-t">Acerca</span>
              <span className="edp-next-d">
                Qué es este archivo y con qué método se construye.
              </span>
            </Link>
            <Link href="/archivo">
              <span className="edp-next-k">O vaya al grano</span>
              <span className="edp-next-t">Todo el archivo</span>
              <span className="edp-next-d">Las piezas publicadas hasta hoy, sin filtro.</span>
            </Link>
          </nav>
        </footer>
      </div>
    </PublicShell>
  );
}
