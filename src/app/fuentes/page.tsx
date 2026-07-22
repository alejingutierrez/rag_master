import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/editorial-page.css";

// PublicShell calcula métricas vivas del archivo: nada de resolverlas en build.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Fuentes",
    metaDescription:
      "El corpus de libros y documentos del que sale todo lo que aquí se lee, sus límites declarados y la forma exacta en que cada afirmación se cita.",
    keywords: [
      "fuentes",
      "corpus",
      "bibliografía",
      "citas",
      "historia de Colombia",
      "verificación",
    ],
  },
  path: "/fuentes",
  type: "website",
});

export default function FuentesPage() {
  return (
    <PublicShell>
      <div className="edp-wrap">
        <header className="edp-head">
          <div className="edp-kick">Fuentes</div>
          <h1 className="edp-title">De dónde sale lo que aquí se lee</h1>
          <p className="edp-stand">
            Una biblioteca real, sus bordes declarados, y una cita que no remite a un libro entero
            sino al párrafo exacto.
          </p>
        </header>

        <div className="edp-body">
          <div className="edp-col">
            <section className="edp-sec">
              <span className="edp-sec-n">01 · El corpus</span>
              <h2 className="edp-h2">Detrás del sitio hay una biblioteca</h2>
              <div className="prose edp-prose">
                <p>
                  No es una metáfora. Detrás de cada página de este archivo hay un conjunto acotado
                  de libros y documentos sobre la historia de Colombia, incorporados enteros e
                  indexados de principio a fin, en fragmentos que conservan su procedencia: de qué
                  obra vienen y —cuando la edición lo permite— de qué página.
                </p>
                <p>
                  Todo lo que se publica sale de ahí. Es la regla más simple del proyecto y la que
                  más lo limita: el archivo no escribe sobre lo que no tiene en la biblioteca. Si un
                  episodio importante no está cubierto por ninguna obra del corpus, ese episodio
                  todavía no tiene pieza, por evidente que parezca su ausencia.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">02 · Los bordes</span>
              <h2 className="edp-h2">Lo que el corpus no es</h2>
              <div className="prose edp-prose">
                <p>
                  Un lector tiene derecho a saber qué está mirando cuando lee un aparato de fuentes.
                  Tres precisiones, en orden de importancia.
                </p>

                <h3 className="edp-h3">No es internet</h3>
                <p>
                  Aquí no se cita lo primero que devuelve un buscador. El material es bibliográfico:
                  obras que alguien escribió, editó y publicó, con autor y con método discutible pero
                  identificable. Eso hace el archivo más lento y bastante más confiable.
                </p>

                <h3 className="edp-h3">No es neutral</h3>
                <p>
                  Ninguna biblioteca lo es. Toda selección de obras es una posición sobre qué merece
                  ser leído, y cada autor incorporado escribió desde una época, una escuela y unos
                  intereses. Por eso las citas están a la vista con el nombre de la obra: para que el
                  lector pueda pesar quién lo está diciendo. Y por eso, cuando dos fuentes no
                  coinciden, la pieza lo declara en vez de escoger en silencio.
                </p>

                <h3 className="edp-h3">No es completo</h3>
                <p>
                  El corpus tiene bordes, y esos bordes se notan: hay períodos y regiones mejor
                  cubiertos que otros. El archivo no disimula esa desigualdad estirando lo poco que
                  tiene.
                </p>
              </div>

              <p className="edp-rule">Donde el corpus calla, el archivo calla.</p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">03 · La cita</span>
              <h2 className="edp-h2">Cómo se cita, exactamente</h2>
              <div className="prose edp-prose">
                <p>
                  Dentro de la prosa, un numeral discreto al final de la frase. Al margen de la
                  pieza, el aparato de fuentes, numerado igual. Cada entrada del aparato trae tres
                  cosas:
                </p>
                <ul>
                  <li>El nombre bibliográfico de la obra de la que salió la afirmación.</li>
                  <li>La página, cuando la fuente la conserva.</li>
                  <li>
                    El fragmento textual exacto en que se apoya la frase, que se despliega al abrir
                    el numeral.
                  </li>
                </ul>
                <p>
                  Ese tercer punto es el rasgo que más define este archivo. Una nota al pie común
                  remite a un libro de cuatrocientas páginas y confía en que nadie irá a
                  comprobarlo. Aquí la nota abre el párrafo. Se ve lo que la fuente dice y se ve, al
                  lado, lo que la pieza hizo con eso.
                </p>
                <p>
                  Cada pieza declara además cuántas fuentes la sostienen, junto a su fecha y su
                  extensión. Es una cifra incómoda a propósito: hace visible cuándo un texto se apoya
                  en mucho y cuándo se apoya en poco.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">04 · La cadena</span>
              <h2 className="edp-h2">Cuatro pasos hacia atrás</h2>
              <div className="prose edp-prose">
                <p>
                  Frase, numeral, fragmento, obra. Ese es el camino completo, y se puede recorrer
                  entero desde cualquier pieza del sitio sin salir de la página y sin pedirle
                  permiso a nadie.
                </p>
                <p>
                  En ninguno de los cuatro pasos hay que creerle al archivo. Esa es toda la
                  diferencia entre un texto que pide confianza y uno que ofrece verificación. Aquí no
                  hace falta confiar en el autor: hace falta poder revisarlo.
                </p>
              </div>

              <p className="edp-note">
                El recorrido que produce esa cadena está descrito paso a paso en{" "}
                <Link href="/como-trabajamos">Cómo trabajamos</Link>.
              </p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">05 · Casos aparte</span>
              <h2 className="edp-h2">Piezas que no muestran aparato</h2>
              <div className="prose edp-prose">
                <p>
                  Algunas piezas de síntesis —las que resumen, ordenan o conectan lo que otras piezas
                  ya establecieron— no repiten el aparato completo. En esos casos la pieza lo declara
                  en el margen, en lugar de simular una bibliografía que no le corresponde.
                </p>
                <p>
                  Es una excepción de forma, no de método: el material del que se nutren esas
                  síntesis está en el corpus y en las piezas de las que dependen, que sí traen su
                  aparato entero.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">06 · Crecimiento</span>
              <h2 className="edp-h2">La biblioteca crece</h2>
              <div className="prose edp-prose">
                <p>
                  Se incorporan obras nuevas con el tiempo, y cada incorporación cambia dos cosas:
                  habilita preguntas que antes no se podían responder y permite revisar piezas
                  antiguas con más material del que tenían cuando se escribieron.
                </p>
                <p>
                  Una obra nueva no reescribe el pasado por sí sola. Pero sí puede volver
                  insuficiente una pieza que ayer parecía terminada, y ese es exactamente el motivo
                  por el que este archivo se llama vivo.
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
            <Link href="/fuentes" className="edp-rail-l" aria-current="page">
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
            <Link href="/criterios-editoriales">
              <span className="edp-next-k">Siga por aquí</span>
              <span className="edp-next-t">Criterios editoriales</span>
              <span className="edp-next-d">
                Qué se publica, qué se guarda y cómo se corrigen los errores.
              </span>
            </Link>
            <Link href="/archivo">
              <span className="edp-next-k">O véalo en obra</span>
              <span className="edp-next-t">Todo el archivo</span>
              <span className="edp-next-d">
                Las piezas publicadas, cada una con su aparato de fuentes.
              </span>
            </Link>
          </nav>
        </footer>
      </div>
    </PublicShell>
  );
}
