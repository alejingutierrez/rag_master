import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { getConnectedEntityCounts, ENTITY_TYPE_META, type EntityType } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/typology-index.css";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Personas, lugares e ideas",
    metaDescription:
      "El tejido de la historia de Colombia: las personas, los lugares y las ideas con artículo propio en el archivo, con las piezas donde aparecen y sus relaciones.",
    keywords: ["personajes históricos", "lugares", "conceptos", "historia de Colombia"],
  },
  path: "/entidades",
  type: "website",
});

const CARDS: Array<{ type: EntityType; desc: string }> = [
  { type: "persona", desc: "Las figuras que hicieron —y sufrieron— la historia." },
  { type: "lugar", desc: "Los territorios, regiones y ciudades donde ocurrió." },
  { type: "idea", desc: "Los procesos, ideologías e instituciones en juego." },
];

export default async function EntidadesPage() {
  const counts = await getConnectedEntityCounts();
  return (
    <PublicShell>
      <div className="tix-wrap">
        <header className="tix-head">
          <div className="tix-kick">El tejido de la historia</div>
          <h1 className="tix-title">Personas, lugares e ideas</h1>
          <p className="tix-intro">
            Los tres directorios del archivo. Solo se listan las figuras, territorios y procesos
            que ya tienen su propio artículo publicado, con las piezas donde aparecen y las
            entidades con las que comparten historia.
          </p>
        </header>

        <ul className="tix-grid">
          {CARDS.map(({ type, desc }) => {
            const m = ENTITY_TYPE_META[type];
            const n = counts[type];
            return (
              <li key={type} className="tix-card">
                <Link href={m.index}>
                  <div className="tix-kmeta">
                    <span className="tix-dot" style={{ background: m.color }} />
                    {n} con historia propia
                  </div>
                  <div className="tix-ct">{m.plural}</div>
                  <div className="tix-cr">{desc}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </PublicShell>
  );
}
