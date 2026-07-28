import Link from "next/link";
import type { MapPoint } from "@/lib/public-data";
import type { HomeEntity } from "./types";
import { EditorialArrow, EditorialImage, SectionMark } from "./primitives";
import { HomePeriodMap } from "./home-period-map";

function EntityIndex({
  title,
  entities,
  total,
  href,
}: {
  title: string;
  entities: HomeEntity[];
  total: number;
  href: string;
}) {
  return (
    <div className="hc-entity-index">
      <div className="hc-index-heading">
        <h3>{title}</h3>
        <span>{total}</span>
      </div>
      <ol>
        {entities.slice(0, 6).map((entity, index) => (
          <li key={entity.href}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <Link href={entity.href}>{entity.name}</Link>
            <small>{entity.count} {entity.count === 1 ? "pieza" : "piezas"}</small>
          </li>
        ))}
      </ol>
      {!entities.length ? (
        <p className="hc-index-empty">Todavía no hay entradas conectadas en esta edición.</p>
      ) : null}
      <Link href={href} className="hc-text-link">Abrir directorio <EditorialArrow /></Link>
    </div>
  );
}

export function HomeConnected({
  people,
  places,
  ideas,
  mapPoints,
  editionLabel,
  totals,
}: {
  people: HomeEntity[];
  places: HomeEntity[];
  ideas: HomeEntity[];
  mapPoints: MapPoint[];
  editionLabel: string;
  totals: { people: number; places: number; ideas: number };
}) {
  return (
    <section className="hc-section hc-connected" aria-labelledby="hc-connected-title">
      <SectionMark
        number="03"
        eyebrow="Archivo conectado"
        title="Protagonistas, territorio e ideas"
        description={`Las relaciones que sostienen la edición ${editionLabel}, todas con una historia publicada detrás.`}
      />

      <div className="hc-people-heading">
        <h3>Protagonistas</h3>
        <Link href="/personas">{totals.people} personas en esta edición <EditorialArrow /></Link>
      </div>
      {people.length ? (
        <div className="hc-people-grid">
          {people.slice(0, 4).map((person, index) => (
            <Link href={person.href} key={person.href} className="hc-person-card">
              <EditorialImage src={person.imageUrl} alt={person.name} className="hc-person-image" width={320} />
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h4>{person.name}</h4>
              <small>{person.count} {person.count === 1 ? "pieza relacionada" : "piezas relacionadas"}</small>
            </Link>
          ))}
        </div>
      ) : (
        <p className="hc-empty-line">Aún no hay protagonistas con ficha propia en esta edición.</p>
      )}

      <div className="hc-connected-lower">
        <div className="hc-map-column">
          <div className="hc-index-heading">
            <h3>El archivo sobre el territorio</h3>
            <Link href="/mapa">Mapa completo <EditorialArrow /></Link>
          </div>
          <HomePeriodMap key={editionLabel} points={mapPoints} editionLabel={editionLabel} />
        </div>
        <aside className="hc-connected-indexes">
          <EntityIndex title="Lugares clave" entities={places} total={totals.places} href="/lugares" />
          <EntityIndex title="Ideas en circulación" entities={ideas} total={totals.ideas} href="/ideas" />
        </aside>
      </div>
    </section>
  );
}
