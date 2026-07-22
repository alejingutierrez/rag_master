import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/editorial-page.css";

// PublicShell calcula métricas vivas del archivo: nada de resolverlas en build.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Criterios editoriales",
    metaDescription:
      "El umbral para publicar, lo que se deja fuera, cómo se nombra la duda, cómo se corrigen los errores y qué significa cada tipo de pieza del archivo.",
    keywords: [
      "criterios editoriales",
      "correcciones",
      "qué se publica",
      "tipos de pieza",
      "historia de Colombia",
      "método",
    ],
  },
  path: "/criterios-editoriales",
  type: "website",
});

export default function CriteriosEditorialesPage() {
  return (
    <PublicShell>
      <div className="edp-wrap">
        <header className="edp-head">
          <div className="edp-kick">Criterios</div>
          <h1 className="edp-title">Qué se publica y qué se queda afuera</h1>
          <p className="edp-stand">
            Las reglas con las que se decide, escritas para que se puedan reclamar.
          </p>
        </header>

        <div className="edp-body">
          <div className="edp-col">
            <section className="edp-sec">
              <span className="edp-sec-n">01 · El umbral</span>
              <h2 className="edp-h2">Tres condiciones a la vez</h2>
              <div className="prose edp-prose">
                <p>
                  Una pieza se publica cuando cumple las tres, no dos de tres:
                </p>
                <ul>
                  <li>
                    Responde la pregunta con la que empezó. No una parecida, ni una más cómoda.
                  </li>
                  <li>
                    Cada afirmación tiene dónde anclarse. Las que no lo tenían fueron eliminadas
                    antes de escribir, no suavizadas con un «al parecer».
                  </li>
                  <li>
                    Se entiende sin ayuda. Si hace falta saber de antemano de qué se está hablando,
                    la pieza está incompleta.
                  </li>
                </ul>
                <p>
                  Una pieza que falla en cualquiera de las tres no se publica a medias: se guarda.
                  Guardar no cuesta nada; publicar algo que no se sostiene cuesta la credibilidad
                  del archivo entero.
                </p>
              </div>

              <p className="edp-rule">El archivo prefiere el silencio al relleno.</p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">02 · Lo que se deja fuera</span>
              <h2 className="edp-h2">Cinco cosas que no llegan a publicarse</h2>
              <div className="prose edp-prose">
                <ul>
                  <li>
                    <strong>Lo que el corpus no sostiene</strong>, por interesante que sea. La
                    calidad de una anécdota no es un argumento a su favor.
                  </li>
                  <li>
                    <strong>La conjetura vestida de hecho.</strong> Se puede conjeturar, pero
                    diciendo que se conjetura y sobre qué base.
                  </li>
                  <li>
                    <strong>El dato huérfano:</strong> la cifra, la fecha o el nombre propio que
                    llegó sin procedencia y que nadie sabe de dónde vino.
                  </li>
                  <li>
                    <strong>El relleno de contexto:</strong> párrafos que no responden nada y sólo
                    sirven para que el texto parezca más completo.
                  </li>
                  <li>
                    <strong>El título que promete de más.</strong> Un titular que el cuerpo no
                    cumple es una forma de mentir, aunque cada frase por separado sea cierta.
                  </li>
                </ul>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">03 · La duda</span>
              <h2 className="edp-h2">Cómo se nombra lo que no se sabe</h2>
              <div className="prose edp-prose">
                <p>
                  Buena parte del pasado no está establecido, y fingir lo contrario es la manera más
                  común de faltar a la verdad sin decir una sola falsedad. Aquí la incertidumbre se
                  escribe.
                </p>
                <p>
                  Cuando un año no está establecido, la ficha se queda sin año. No se redondea, no se
                  aproxima y no se elige el más citado: se deja vacío. Por eso algunas piezas
                  muestran campos en blanco. Un vacío es información; una fecha inventada, no.
                </p>
                <p>
                  Cuando las fuentes discrepan, la pieza lo dice y nombra la discrepancia. Cuando una
                  afirmación descansa en un solo autor, se atribuye a ese autor en vez de presentarse
                  como consenso. Ninguna de esas fórmulas es una debilidad del texto: son la parte
                  del texto que más se puede verificar.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">04 · Correcciones</span>
              <h2 className="edp-h2">Qué pasa cuando hay un error</h2>
              <div className="prose edp-prose">
                <p>
                  Habrá errores. Un archivo que crece y se apoya en fuentes que discuten entre sí no
                  puede prometer lo contrario. Lo que sí se puede prometer es la conducta frente al
                  error.
                </p>
                <p>
                  Una pieza equivocada se corrige donde está: conserva su dirección y su lugar en el
                  archivo, y pasa a mostrar la versión corregida. No se borra la entrada para hacer
                  desaparecer el problema, ni se deja en pie con una nota al margen que nadie lee.
                </p>
                <p>
                  Y si la corrección obliga a retirar una afirmación sin poder reemplazarla, se
                  retira. El archivo puede permitirse decir menos; no puede permitirse sostener algo
                  que ya sabe que no se sostiene.
                </p>
              </div>

              <p className="edp-rule">Corregir antes que defender.</p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">05 · Tipos de pieza</span>
              <h2 className="edp-h2">Qué es cada cosa y qué se le puede exigir</h2>
              <div className="prose edp-prose">
                <p>
                  El archivo publica cuatro tipos de pieza. Cada uno responde a una pregunta
                  distinta, y por eso se le puede exigir algo distinto.
                </p>
              </div>

              <div className="edp-defs">
                <div className="edp-def">
                  <div className="edp-def-k">Hecho</div>
                  <div className="edp-def-v">
                    Un acontecimiento acotado: qué pasó, cuándo, dónde y quiénes estuvieron. Se le
                    puede exigir precisión de fecha y lugar, o la declaración de que no la hay.
                    <Link href="/hechos" className="edp-def-go">
                      Ver hechos →
                    </Link>
                  </div>
                </div>

                <div className="edp-def">
                  <div className="edp-def-k">Época</div>
                  <div className="edp-def-v">
                    Un período largo leído como conjunto: qué lo define, qué lo abre y qué lo cierra.
                    Se le puede exigir coherencia con los hechos que contiene, no exhaustividad.
                    <Link href="/epocas" className="edp-def-go">
                      Ver épocas →
                    </Link>
                  </div>
                </div>

                <div className="edp-def">
                  <div className="edp-def-k">Entidad</div>
                  <div className="edp-def-v">
                    Una persona, un lugar, una institución o una idea. Reúne lo que el archivo sabe de
                    ella y por dónde aparece. Se le puede exigir que no diga más de lo que las piezas
                    que la mencionan sostienen.
                    <Link href="/entidades" className="edp-def-go">
                      Ver entidades →
                    </Link>
                  </div>
                </div>

                <div className="edp-def">
                  <div className="edp-def-k">Pregunta</div>
                  <div className="edp-def-v">
                    Un texto largo que responde algo concreto con una tesis dicha desde el principio.
                    Se le puede exigir que la tesis esté sostenida y que las objeciones aparezcan.
                    <Link href="/ensayos" className="edp-def-go">
                      Ver lecturas →
                    </Link>
                  </div>
                </div>
              </div>

              <p className="edp-note">
                Los directorios de entidades están separados por naturaleza:{" "}
                <Link href="/personas">personas</Link>, <Link href="/lugares">lugares</Link> e{" "}
                <Link href="/ideas">ideas</Link>.
              </p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">06 · Imágenes y firma</span>
              <h2 className="edp-h2">Dos advertencias finales</h2>
              <div className="prose edp-prose">
                <p>
                  Las imágenes que acompañan algunas piezas son ilustraciones editoriales compuestas
                  para el archivo. Acompañan la lectura y ordenan la página; no son documentos de
                  época ni se presentan como tales, y nada de lo que afirma una pieza descansa sobre
                  ellas.
                </p>
                <p>
                  Todo lo que aquí se publica lo firma{" "}
                  <Link href="/autor">Alejandro Gutiérrez</Link>. La firma no es un crédito: es la
                  indicación de quién responde si alguno de estos criterios se incumple.
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
            <Link href="/criterios-editoriales" className="edp-rail-l" aria-current="page">
              Criterios editoriales
            </Link>
            <Link href="/autor" className="edp-rail-l">
              El autor
            </Link>
          </aside>
        </div>

        <footer className="edp-foot">
          <div className="edp-sign">Escrito por Alejandro Gutiérrez</div>
          <nav className="edp-next">
            <Link href="/autor">
              <span className="edp-next-k">Siga por aquí</span>
              <span className="edp-next-t">El autor</span>
              <span className="edp-next-d">Quién firma este archivo y qué se compromete a hacer.</span>
            </Link>
            <Link href="/como-trabajamos">
              <span className="edp-next-k">O vuelva atrás</span>
              <span className="edp-next-t">Cómo trabajamos</span>
              <span className="edp-next-d">
                El recorrido de una pieza, desde la pregunta hasta la publicación.
              </span>
            </Link>
          </nav>
        </footer>
      </div>
    </PublicShell>
  );
}
