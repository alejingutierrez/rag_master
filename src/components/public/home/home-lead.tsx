import Link from "next/link";
import { PERIODS } from "@/lib/design-tokens";
import type { HomeStory } from "./types";
import { EditorialArrow, EditorialImage } from "./primitives";

export function HomeLead({
  lead,
  secondary,
  editionLabel,
}: {
  lead: HomeStory;
  secondary: HomeStory[];
  editionLabel: string;
}) {
  const period = lead.periodCode ? PERIODS[lead.periodCode] : null;

  return (
    <section className="hc-lead" aria-labelledby="hc-lead-title">
      <article className="hc-lead-main">
        <div className="hc-lead-media">
          <EditorialImage
            src={lead.imageUrl}
            alt=""
            className="hc-lead-image"
            eager
            width={1400}
            sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1100px) 46vw, 42vw"
          />
        </div>

        <div className="hc-lead-copy">
          <div className="hc-story-meta">
            <span>{lead.label}</span>
            {lead.yearLabel ? <span>{lead.yearLabel}</span> : null}
            {period ? <span>{period.label}</span> : null}
          </div>
          <h1 id="hc-lead-title">
            <Link href={lead.href}>{lead.title}</Link>
          </h1>
          {lead.summary ? <p className="hc-lead-dek">{lead.summary}</p> : null}
          <div className="hc-lead-byline">
            <span>Por Alejandro Gutiérrez</span>
            <Link href={lead.href}>Leer la historia <EditorialArrow /></Link>
          </div>
        </div>
      </article>

      <aside className="hc-lead-secondary" aria-label={`Más contenidos de ${editionLabel}`}>
        <div className="hc-column-label">En esta edición</div>
        {secondary.slice(0, 3).map((story, index) => (
          <article key={story.id} className="hc-secondary-story">
            {index === 0 ? (
              <div className="hc-secondary-image-frame" aria-hidden>
                <EditorialImage
                  src={story.imageUrl}
                  alt=""
                  className="hc-secondary-image"
                  width={640}
                  sizes="(max-width: 760px) calc(100vw - 36px), 24vw"
                />
              </div>
            ) : null}
            <div className="hc-story-meta">
              <span>{story.label}</span>
              {story.yearLabel ? <span>{story.yearLabel}</span> : null}
            </div>
            <h2><Link href={story.href}>{story.title}</Link></h2>
            {story.summary ? <p>{story.summary}</p> : null}
            <Link href={story.href} className="hc-text-link" aria-label={`Leer ${story.title}`}>
              Leer <EditorialArrow />
            </Link>
          </article>
        ))}
      </aside>
    </section>
  );
}
