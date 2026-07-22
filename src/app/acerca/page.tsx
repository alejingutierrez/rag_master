import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/editorial-page.css";

// PublicShell calcula métricas vivas del archivo; esta página no debe intentar
// resolverlas durante el build de la imagen, donde DATABASE_URL no se inyecta.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Acerca",
    metaDescription:
      "Qué es este archivo de historia de Colombia y con qué método se construye: un corpus de libros reales, cada afirmación con su fuente a la vista.",
    keywords: [
      "acerca",
      "método",
      "historia de Colombia",
      "fuentes",
      "archivo histórico",
      "citas verificables",
    ],
  },
  path: "/acerca",
  type: "website",
});

export default function AcercaPage() {
  return (
    <PublicShell>
      <div className="edp-wrap">
        <header className="edp-head">
          <div className="edp-kick">Acerca</div>
          <h1 className="edp-title">Un archivo vivo del pasado de Colombia</h1>
          <p className="edp-stand">
            Historia contada para leerse de corrido y construida para poder comprobarse: cada
            afirmación se puede seguir hacia atrás hasta el pasaje del libro del que salió.
          </p>
        </header>

        <div className="edp-body">
          <div className="edp-col">
            <section className="edp-sec">
              <span className="edp-sec-n">01 · Qué es esto</span>
              <h2 className="edp-h2">Un archivo de lectura, no una enciclopedia cerrada</h2>
              <div className="prose edp-prose">
                <p>
                  <em>Historia Colombiana</em> reúne piezas sobre el pasado del país: hechos
                  acotados, épocas enteras, personas, lugares e ideas, y preguntas con respuesta
                  razonada. Unas se leen en tres minutos y otras en media hora, pero todas comparten
                  la misma condición: llegan acompañadas de las fuentes en que se apoyan.
                </p>
                <p>
                  No es un blog de opinión ni un ensayo cultural. Se parece más a un archivo de
                  trabajo con la puerta abierta: crece pieza por pieza, lo publicado se puede volver
                  a mirar, y lo que se corrige se corrige a la vista de todos.
                </p>
                <p>
                  Lo escribe <Link href="/autor">Alejandro Gutiérrez</Link>.
                </p>
              </div>
            </section>

            <section className="edp-sec" id="metodo">
              <span className="edp-sec-n">02 · Método</span>
              <h2 className="edp-h2">Tres imágenes para explicar cómo se hace</h2>
              <div className="prose edp-prose">
                <p>
                  El método se entiende mejor con oficios conocidos que con un organigrama. Tres
                  imágenes bastan, y las tres son literales: describen lo que de verdad ocurre antes
                  de que una pieza aparezca publicada.
                </p>

                <h3 className="edp-h3">El taller del restaurador</h3>
                <p>
                  Quien restaura un cuadro no repinta lo que falta. Documenta cada intervención y, si
                  un fragmento se perdió, deja la laguna a la vista antes que inventar el trazo que
                  la taparía. Aquí ocurre lo mismo con el texto: lo que las fuentes sostienen se
                  escribe; lo que no, se queda afuera, aunque haría la historia más redonda y más
                  fácil de contar.
                </p>

                <h3 className="edp-h3">El cuaderno de campo</h3>
                <p>
                  Nada se escribe de memoria. Cada pieza se arma sobre un corpus de libros y
                  documentos reales, y cada afirmación queda anotada con el pasaje del que salió,
                  como una entrada de cuaderno que registra dónde se tomó el dato. Esa anotación no
                  se borra al pasar en limpio: viaja con el texto hasta el sitio.
                </p>

                <h3 className="edp-h3">El aparato de notas</h3>
                <p>
                  Por eso las piezas se leen como un libro serio. La prosa corre limpia y, al margen,
                  los numerales abren la fuente exacta: el nombre de la obra, la página cuando la
                  fuente la conserva y el fragmento textual en que se apoya la frase. La cita no está
                  ahí como adorno de autoridad, sino para que el lector pueda desconfiar y comprobar
                  sin pedirle permiso a nadie.
                </p>
              </div>

              <div className="prose edp-prose" style={{ marginTop: 30 }}>
                <p>De esas tres imágenes salen tres consecuencias prácticas:</p>
                <ul>
                  <li>
                    Ninguna afirmación viaja sola. Se puede recorrer hacia atrás hasta el párrafo que
                    la sostiene.
                  </li>
                  <li>
                    Nada se publica por inercia. Cada pieza pasa por una decisión editorial explícita
                    y firmada.
                  </li>
                  <li>
                    Lo que no está sustentado, no se afirma. Ni se insinúa con un adverbio prudente.
                  </li>
                </ul>
              </div>

              <p className="edp-rule">El archivo prefiere el silencio al relleno.</p>

              <p className="edp-note">
                El recorrido completo, paso a paso, está en{" "}
                <Link href="/como-trabajamos">Cómo trabajamos</Link>. De dónde sale el material y
                cómo se cita, en <Link href="/fuentes">Fuentes</Link>. El umbral exacto para
                publicar, en <Link href="/criterios-editoriales">Criterios editoriales</Link>.
              </p>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">03 · Alcance</span>
              <h2 className="edp-h2">Lo que este archivo hace y lo que no</h2>
              <div className="prose edp-prose">
                <p>
                  Hace una cosa concreta: acercar a un lector no especializado el contenido de una
                  biblioteca de historia de Colombia, ordenado por hechos, épocas y entidades, y con
                  la cadena de citas intacta para quien quiera tirar del hilo.
                </p>
                <p>
                  No reemplaza a los libros de los que sale: los señala. Cuando una pieza le interese
                  de verdad, el aparato de fuentes le dice exactamente qué obra buscar y por dónde
                  entrar en ella.
                </p>
                <p>
                  Tampoco pretende tener la última palabra. La historia se discute, y buena parte de
                  lo que se discute son las fuentes mismas. Cuando dos fuentes no coinciden, la pieza
                  lo dice en vez de escoger en silencio.
                </p>
                <p>
                  Y no está completo. Ninguna biblioteca lo está. Donde el corpus calla, el archivo
                  calla: preferimos un vacío declarado a una página bien escrita sobre nada.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">04 · Cómo leerlo</span>
              <h2 className="edp-h2">Cuatro maneras de entrar</h2>
              <div className="prose edp-prose">
                <p>
                  No hay un orden obligatorio. El archivo está tejido: casi cualquier pieza lleva a
                  otras tres.
                </p>
                <ul>
                  <li>
                    Por acontecimiento, en <Link href="/hechos">Hechos</Link>: episodios acotados,
                    con año, lugar y protagonistas.
                  </li>
                  <li>
                    Por período, en <Link href="/epocas">Épocas</Link>, o en orden cronológico en la{" "}
                    <Link href="/linea-de-tiempo">línea de tiempo</Link>.
                  </li>
                  <li>
                    Por nombre, en los directorios de <Link href="/personas">personas</Link>,{" "}
                    <Link href="/lugares">lugares</Link> e <Link href="/ideas">ideas</Link>.
                  </li>
                  <li>
                    Por pregunta, en <Link href="/ensayos">Lecturas</Link>: textos largos que
                    responden algo concreto y dicen su tesis desde el principio.
                  </li>
                </ul>
                <p>
                  Y si prefiere verlo todo junto, sin filtro, está{" "}
                  <Link href="/archivo">el archivo completo</Link>.
                </p>
              </div>

              <p className="edp-note">
                Qué significa cada tipo de pieza —y qué se puede exigir de cada una— está detallado
                en <Link href="/criterios-editoriales">Criterios editoriales</Link>.
              </p>
            </section>
          </div>

          <aside className="edp-rail">
            <span className="edp-rail-t">El proyecto</span>
            <Link href="/acerca" className="edp-rail-l" aria-current="page">
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
            <Link href="/autor" className="edp-rail-l">
              El autor
            </Link>
          </aside>
        </div>

        <footer className="edp-foot">
          <div className="edp-sign">Escrito por Alejandro Gutiérrez</div>
          <nav className="edp-next">
            <Link href="/como-trabajamos">
              <span className="edp-next-k">Siga por aquí</span>
              <span className="edp-next-t">Cómo trabajamos</span>
              <span className="edp-next-d">
                El recorrido de una pieza, desde la pregunta hasta la publicación.
              </span>
            </Link>
            <Link href="/fuentes">
              <span className="edp-next-k">O por aquí</span>
              <span className="edp-next-t">Fuentes</span>
              <span className="edp-next-d">
                Qué es el corpus, qué no es, y cómo se cita hasta el párrafo.
              </span>
            </Link>
          </nav>
        </footer>
      </div>
    </PublicShell>
  );
}
