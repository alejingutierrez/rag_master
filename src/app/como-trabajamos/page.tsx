import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/editorial-page.css";

// PublicShell calcula métricas vivas del archivo: nada de resolverlas en build.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Cómo trabajamos",
    metaDescription:
      "El recorrido completo de una pieza de este archivo: de la pregunta al corpus, del contraste a la verificación, y de ahí a la decisión de publicar.",
    keywords: [
      "cómo trabajamos",
      "método",
      "proceso editorial",
      "verificación",
      "historia de Colombia",
      "fuentes",
    ],
  },
  path: "/como-trabajamos",
  type: "website",
});

export default function ComoTrabajamosPage() {
  return (
    <PublicShell>
      <div className="edp-wrap">
        <header className="edp-head">
          <div className="edp-kick">Método</div>
          <h1 className="edp-title">Cómo trabajamos</h1>
          <p className="edp-stand">
            El reverso del texto: los ocho pasos que recorre una pieza antes de que usted pueda
            leerla.
          </p>
        </header>

        <div className="edp-body">
          <div className="edp-col">
            <section className="edp-sec">
              <span className="edp-sec-n">01 · El recorrido</span>
              <h2 className="edp-h2">Ocho pasos, siempre los mismos</h2>
              <div className="prose edp-prose">
                <p>
                  Toda pieza de este archivo hace el mismo camino. No es un secreto de taller: es
                  información que el lector necesita para saber cuánto puede exigirle a lo que está
                  leyendo. Un texto del que no se sabe cómo se hizo se cree o no se cree; un texto
                  cuyo procedimiento está a la vista se puede examinar.
                </p>
              </div>

              <ol className="edp-steps">
                <li className="edp-step">
                  <span className="edp-step-n">01</span>
                  <div>
                    <h3 className="edp-step-t">La pregunta</h3>
                    <p className="edp-step-d">
                      Nada empieza con un tema; todo empieza con una pregunta acotada. Qué ocurrió,
                      dónde, en qué años y por qué importa. La diferencia no es de estilo: un tema
                      admite relleno indefinido, una pregunta no. Cuando el texto empieza a
                      alejarse, la pregunta lo devuelve a su sitio.
                    </p>
                  </div>
                </li>

                <li className="edp-step">
                  <span className="edp-step-n">02</span>
                  <div>
                    <h3 className="edp-step-t">La búsqueda en el corpus</h3>
                    <p className="edp-step-d">
                      Se recorre el corpus —la biblioteca de libros y documentos que sostiene el
                      archivo, indexada de principio a fin— y se recuperan los pasajes que hablan de
                      esa pregunta. La búsqueda no es por palabra suelta sino por sentido: interesa
                      traer lo pertinente aunque la fuente lo diga con otras palabras y aunque el
                      nombre del episodio haya cambiado con el tiempo.
                    </p>
                  </div>
                </li>

                <li className="edp-step">
                  <span className="edp-step-n">03</span>
                  <div>
                    <h3 className="edp-step-t">La lectura y el contraste</h3>
                    <p className="edp-step-d">
                      Los pasajes se leen enteros y se enfrentan entre sí, como se enfrentan dos
                      testimonios de un mismo hecho. Lo que coincide en varias fuentes se sostiene.
                      Lo que aparece en una sola queda marcado como lo que es. Lo que se contradice
                      no se resuelve a la fuerza: se declara en discusión, que es la forma honesta
                      de contarlo.
                    </p>
                  </div>
                </li>

                <li className="edp-step">
                  <span className="edp-step-n">04</span>
                  <div>
                    <h3 className="edp-step-t">La verificación, frase por frase</h3>
                    <p className="edp-step-d">
                      Antes de redactar nada, cada afirmación candidata vuelve a anclarse a su
                      pasaje. La que no encuentra dónde anclarse no pasa, sin negociación y sin
                      importar lo bien que quedaría en el párrafo.
                    </p>
                    <p className="edp-step-d">
                      Este es el paso que más texto elimina, y es exactamente el que hace que el
                      resto valga algo.
                    </p>
                  </div>
                </li>

                <li className="edp-step">
                  <span className="edp-step-n">05</span>
                  <div>
                    <h3 className="edp-step-t">La escritura</h3>
                    <p className="edp-step-d">
                      Sólo entonces se compone la prosa. Se escribe para leerse de corrido, con la
                      cronología clara y sin jerga innecesaria, mientras el aparato de fuentes queda
                      al margen: presente para quien lo quiera, invisible para quien sólo quiera
                      leer.
                    </p>
                  </div>
                </li>

                <li className="edp-step">
                  <span className="edp-step-n">06</span>
                  <div>
                    <h3 className="edp-step-t">La ficha</h3>
                    <p className="edp-step-d">
                      Cada pieza deposita aparte sus datos duros: años, lugares, protagonistas,
                      período, hitos. Esa ficha es lo que después permite que la pieza aparezca en su
                      época, ocupe su lugar en la línea de tiempo y quede enlazada con las personas,
                      lugares e ideas que menciona.
                    </p>
                  </div>
                </li>

                <li className="edp-step">
                  <span className="edp-step-n">07</span>
                  <div>
                    <h3 className="edp-step-t">La revisión y la decisión de publicar</h3>
                    <p className="edp-step-d">
                      La pieza se lee completa, ya en frío, con cuatro preguntas encima: ¿se
                      sostiene?, ¿sobra algo?, ¿se coló una afirmación sin fuente?, ¿el título
                      promete más de lo que el texto entrega?
                    </p>
                    <p className="edp-step-d">
                      Publicar es un acto aparte, tomado pieza por pieza. Nada aparece en el sitio
                      por el solo hecho de haberse escrito: buena parte de lo que se produce se
                      queda guardado.
                    </p>
                  </div>
                </li>

                <li className="edp-step">
                  <span className="edp-step-n">08</span>
                  <div>
                    <h3 className="edp-step-t">La conexión</h3>
                    <p className="edp-step-d">
                      Ya publicada, la pieza entra en el tejido del archivo: se enlaza con lo que ya
                      existe y queda disponible para lo que venga. Por eso una entrada casi siempre
                      lleva a otras tres, y por eso el archivo se vuelve más útil a medida que crece.
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">02 · El orden importa</span>
              <h2 className="edp-h2">Por qué se verifica antes de escribir</h2>
              <div className="prose edp-prose">
                <p>
                  El paso cuatro podría ir después del cinco: escribir primero y comprobar al final
                  es lo que hace casi todo el mundo. Aquí va antes, y la diferencia no es menor.
                </p>
                <p>
                  Cuando se verifica después, uno ya se enamoró del párrafo: la comprobación se
                  convierte en la búsqueda de una fuente que respalde lo que ya se quiso decir, y
                  cualquier cita medio parecida termina sirviendo. Cuando se verifica antes, el
                  texto no puede sino construirse sobre lo que hay.
                </p>
              </div>

              <p className="edp-rule">
                Un texto verificado después es un texto defendido. Uno verificado antes es un texto
                construido.
              </p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">03 · Alcance</span>
              <h2 className="edp-h2">Qué garantiza este recorrido y qué no</h2>
              <div className="prose edp-prose">
                <p>Garantiza tres cosas, y conviene decir cuáles son con exactitud:</p>
                <ul>
                  <li>Que lo escrito está sostenido por fuentes que el lector puede ver.</li>
                  <li>
                    Que la ruta hacia atrás está intacta: de la frase al fragmento, del fragmento a
                    la obra.
                  </li>
                  <li>Que alguien decidió publicar esa pieza y responde por ella.</li>
                </ul>
                <p>No garantiza que sea la última palabra sobre nada. La historia se discute, y a
                  veces lo que se discute es la fuente misma. Tampoco garantiza cobertura completa:
                  toda biblioteca tiene bordes, y donde el corpus calla el archivo también.
                </p>
              </div>

              <p className="edp-note">
                Qué contiene el corpus y cómo se cita está en{" "}
                <Link href="/fuentes">Fuentes</Link>. El umbral que decide si una pieza se publica o
                se guarda, en <Link href="/criterios-editoriales">Criterios editoriales</Link>. Y el
                porqué de todo esto, en <Link href="/acerca#metodo">Acerca</Link>.
              </p>
            </section>
          </div>

          <aside className="edp-rail">
            <span className="edp-rail-t">El proyecto</span>
            <Link href="/acerca" className="edp-rail-l">
              Acerca
            </Link>
            <Link href="/como-trabajamos" className="edp-rail-l" aria-current="page">
              Cómo trabajamos
            </Link>
            <Link href="/fuentes" className="edp-rail-l">
              Fuentes
            </Link>
            <Link href="/criterios-editoriales" className="edp-rail-l">
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
            <Link href="/fuentes">
              <span className="edp-next-k">Siga por aquí</span>
              <span className="edp-next-t">Fuentes</span>
              <span className="edp-next-d">
                Qué es el corpus, qué no es, y cómo se cita hasta el párrafo.
              </span>
            </Link>
            <Link href="/criterios-editoriales">
              <span className="edp-next-k">O por aquí</span>
              <span className="edp-next-t">Criterios editoriales</span>
              <span className="edp-next-d">
                Qué se publica, qué se guarda y cómo se corrigen los errores.
              </span>
            </Link>
          </nav>
        </footer>
      </div>
    </PublicShell>
  );
}
