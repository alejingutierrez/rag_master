import { PublicShell } from "@/components/public/public-shell";

export const metadata = {
  title: "Acerca · Historia Colombiana",
  description: "Qué es este archivo y con qué método se construye.",
};

export default function AcercaPage() {
  return (
    <PublicShell>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 34px 110px" }}>
        <div className="label" style={{ color: "var(--fg-muted)", marginBottom: 16 }}>Acerca</div>
        <h1 className="display" style={{ fontSize: "clamp(40px, 7vw, 72px)", lineHeight: 1.0, letterSpacing: "-0.02em", margin: 0 }}>
          Un archivo vivo del pasado de Colombia
        </h1>

        <div className="prose" style={{ marginTop: 32 }}>
          <p>
            <em>Historia Colombiana</em> es un archivo de lectura sobre la historia de Colombia: ensayos, crónicas y
            síntesis construidos a partir de un corpus de fuentes vectorizadas, con las referencias siempre a la vista.
          </p>
          <p>
            No busca ser un blog ni un ensayo cultural, sino un aparato de consulta con rigor: cada afirmación se apoya en
            documentos rastreables, y cada pieza declara de dónde viene lo que dice.
          </p>

          <h2 id="metodo">Método y fuentes</h2>
          <p>
            El texto se produce sobre un corpus documental indexado. Un motor de recuperación reúne los pasajes
            pertinentes, se triangulan entre fuentes, se verifica su consistencia y solo entonces se compone la prosa —
            que conserva su aparato crítico: las fuentes por sección y su procedencia.
          </p>
          <p>
            La curación editorial —qué se publica y cómo— es humana. Los contenidos crecen con el tiempo; esta es una
            primera apertura del archivo.
          </p>
        </div>

        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--line)" }}
        >
          Escrito por Alejandro Gutiérrez
        </div>
      </div>
    </PublicShell>
  );
}
