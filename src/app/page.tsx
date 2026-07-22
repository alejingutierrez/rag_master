import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { ConnectedDirectory } from "@/components/public/connected-directory";
import { PERIODS, getPeriodColor, type PeriodCode } from "@/lib/design-tokens";
import {
  getConnectedEntityDirectory,
  getHome,
  getPublicArchiveStats,
  getRecentPublicPieces,
  getTypologyList,
  type HomeCard,
  type PublicArchivePiece,
  type TypologyCard,
} from "@/lib/public-data";
import { loadTimeline } from "@/lib/timeline-data";
import { imageAt, type ImageWidth } from "@/lib/image-url";
import "@/components/public/home.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "Historia de Colombia · Archivo abierto y citable" },
  description:
    "Un archivo vivo del pasado de Colombia. Hechos, épocas, biografías y lecturas construidas con fuentes a la vista.",
  alternates: { canonical: "/" },
};

const ATLAS_CODES: PeriodCode[] = ["PRE", "CON", "COL", "IND", "REG", "VIO", "C91", "POS"];

function Arrow() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="hp-arrow">
      <path d="M3 9h11M10 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("es-CO");
}

/** `width` es el ancho REAL que ocupa la imagen: pedir menos evita traer el PNG entero. */
function cardImage(
  src: string | null,
  alt: string,
  className = "",
  eager = false,
  width: ImageWidth = 480,
) {
  if (!src) return <span className={`hp-image-fallback ${className}`} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageAt(src, width)!}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
    />
  );
}

interface SequenceCard {
  id: string;
  href: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  periodCode: string | null;
  yearLabel: string | null;
}

function sequenceFromHome(card: HomeCard): SequenceCard {
  return {
    id: card.id,
    href: card.href,
    title: card.title,
    summary: card.desc,
    imageUrl: card.imageUrl,
    periodCode: card.periodCode,
    yearLabel: card.periodCode ? PERIODS[card.periodCode as PeriodCode]?.yearRange ?? null : null,
  };
}

function sequenceFromTypology(card: TypologyCard): SequenceCard {
  return {
    id: card.id,
    href: card.href,
    title: card.titulo,
    summary: card.resumen,
    imageUrl: card.imageUrl,
    periodCode: card.periodCode,
    yearLabel: card.meta,
  };
}

/** Época seleccionada en la cinta del home, si es válida. */
function validPeriod(raw: string | string[] | undefined): PeriodCode | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value in PERIODS ? (value as PeriodCode) : null;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ epoca?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const epoca = validPeriod(sp.epoca);

  const [home, archive, allPieces, hechos, epocas, entidades, personas, lugares, ideas, timeline] =
    await Promise.all([
      getHome(),
      getPublicArchiveStats(),
      // Una sola lectura del archivo alimenta "lo reciente" Y el filtro por época:
      // la cinta superior deja de ser decorativa sin pagar consultas extra.
      getRecentPublicPieces(1000),
      getTypologyList("hecho"),
      getTypologyList("epoca"),
      getTypologyList("entidad"),
      getConnectedEntityDirectory("persona"),
      getConnectedEntityDirectory("lugar"),
      getConnectedEntityDirectory("idea"),
      loadTimeline().catch(() => null),
    ]);

  const periodPieces: PublicArchivePiece[] = epoca
    ? allPieces.filter((p) => p.periodCode === epoca)
    : allPieces;
  const recent = periodPieces;

  // Con una época elegida el portada manda la pieza de esa época: primero su
  // ficha de época, si no el hecho más antiguo. Sin época, manda la curaduría.
  const periodHero =
    periodPieces.find((p) => p.kind === "epoca") ??
    periodPieces.find((p) => p.kind === "hecho") ??
    periodPieces[0];
  // getRecentPublicPieces ordena por fecha de publicación; dentro de una época
  // el lector espera cronología histórica, no orden de producción.
  const periodChronological = [...periodPieces].sort(
    (a, b) => (parseInt(a.yearLabel ?? "9999", 10) || 9999) - (parseInt(b.yearLabel ?? "9999", 10) || 9999),
  );

  const hero = epoca
    ? periodHero
      ? {
          id: periodHero.id,
          href: periodHero.href,
          title: periodHero.title,
          desc: periodHero.summary,
          periodCode: periodHero.periodCode,
          kicker: periodHero.label,
          imageUrl: periodHero.imageUrl,
          kind: periodHero.kind,
          docCount: null,
          wordCount: null,
          fragmentCount: 0,
        }
      : null
    : home.hero;
  // La curaduría manda solo en la vista general; filtrando por época, la fila
  // "En el archivo" tiene que hablar de ESA época.
  const heroQueue = epoca ? [] : home.featured.slice(0, 3);
  const queue = heroQueue.length
    ? heroQueue
    : recent
        .filter((piece) => piece.id !== hero?.id)
        .slice(0, 3)
        .map((piece) => ({
          id: piece.id,
          href: piece.href,
          title: piece.title,
          desc: piece.summary,
          periodCode: piece.periodCode,
          kicker: piece.label,
          imageUrl: piece.imageUrl,
          kind: piece.kind,
          docCount: null,
          wordCount: null,
          fragmentCount: 0,
        }));

  const curatedFacts = (home.collection?.cards ?? []).filter((card) => card.kind === "hecho");
  const sequence: SequenceCard[] = epoca
    ? // Con época elegida, la secuencia son SUS hechos en orden cronológico.
      periodChronological
        .filter((p) => p.kind === "hecho" && p.id !== hero?.id)
        .slice(0, 3)
        .map((p) => ({
          id: p.id,
          href: p.href,
          title: p.title,
          summary: p.summary,
          imageUrl: p.imageUrl,
          periodCode: p.periodCode,
          yearLabel: p.yearLabel,
        }))
    : curatedFacts.length >= 3
      ? curatedFacts.slice(0, 3).map(sequenceFromHome)
      : hechos.slice(0, 3).map(sequenceFromTypology);
  const biographies = entidades.filter((card) => card.meta === "Persona").slice(0, 3);
  const epocaByCode = new Map(epocas.map((card) => [card.periodCode, card]));
  const timelineEvents = timeline
    ? Object.values(timeline.periods).reduce((total, period) => total + period.events.length, 0)
    : 0;
  const readingMinutes = hero?.wordCount ? Math.max(1, Math.round(hero.wordCount / 220)) : null;

  const directoryGroups = [
    {
      key: "personas" as const,
      label: "Personas",
      href: "/personas",
      count: personas.length,
      entries: personas.slice(0, 5).map(({ name, href, mentions }) => ({ name, href, mentions })),
    },
    {
      key: "lugares" as const,
      label: "Lugares",
      href: "/lugares",
      count: lugares.length,
      entries: lugares.slice(0, 5).map(({ name, href, mentions }) => ({ name, href, mentions })),
    },
    {
      key: "ideas" as const,
      label: "Ideas",
      href: "/ideas",
      count: ideas.length,
      entries: ideas.slice(0, 5).map(({ name, href, mentions }) => ({ name, href, mentions })),
    },
  ];

  return (
    <PublicShell>
      {/* Cinta de épocas: FILTRA el home en vez de salir de él. Cada época es un
          enlace a /?epoca=CODE, así que funciona sin JavaScript, se puede
          compartir y el botón atrás hace lo esperado. */}
      <div className="hp-atlas" aria-label="Recorrer por época">
        <div className="hp-atlas-inner">
          <div className="hp-atlas-count">
            {epoca ? (
              <Link href="/" className="hp-atlas-reset">Todas las épocas</Link>
            ) : (
              `${archive.epocas} épocas`
            )}
          </div>
          <div className="hp-atlas-track">
            {ATLAS_CODES.map((code) => {
              const period = PERIODS[code];
              const active = epoca ? code === epoca : code === hero?.periodCode;
              return (
                <Link
                  key={code}
                  href={code === epoca ? "/" : `/?epoca=${code}`}
                  scroll={false}
                  aria-current={code === epoca ? "true" : undefined}
                  className={active ? "is-active" : ""}
                  style={{ "--period-color": getPeriodColor(code) } as React.CSSProperties}
                >
                  <span className="hp-atlas-label">{period.label}</span>
                  <span className="hp-atlas-dot" />
                </Link>
              );
            })}
          </div>
          <Link href="/linea-de-tiempo" className="hp-atlas-arrow" aria-label="Abrir línea de tiempo"><Arrow /></Link>
        </div>
      </div>

      {epoca ? (
        <div className="hp-filter-note">
          <span style={{ "--period-color": getPeriodColor(epoca) } as React.CSSProperties}>
            {PERIODS[epoca].label} · {PERIODS[epoca].yearRange}
          </span>
          <b>{periodPieces.length} {periodPieces.length === 1 ? "pieza" : "piezas"}</b>
          {epocaByCode.get(epoca) ? (
            <Link href={epocaByCode.get(epoca)!.href}>Leer la época <Arrow /></Link>
          ) : null}
          <Link href={`/linea-de-tiempo?p=${epoca}`}>Ver en la línea de tiempo <Arrow /></Link>
        </div>
      ) : null}

      <div className="hp-mobile-years" aria-label="Anclas cronológicas">
        {["1499", "1810", "1948", "1991", "hoy"].map((year, index) => (
          <span key={year} className={index === 0 ? "is-active" : ""}><b>{year}</b><i /></span>
        ))}
      </div>

      {hero ? (
        <section className="hp-hero">
          <div className="hp-hero-media">{cardImage(hero.imageUrl, hero.title, "hp-hero-image", true, 1400)}</div>
          <div className="hp-hero-copy">
            <div className="hp-kicker">{hero.kicker} <span>·</span> {hero.periodCode ? PERIODS[hero.periodCode as PeriodCode]?.label : "Transversal"}</div>
            <h1>{hero.title}</h1>
            {hero.desc ? <p className="hp-hero-dek">{hero.desc}</p> : null}
            <div className="hp-hero-actions">
              <Link href={hero.href}>Leer la historia <Arrow /></Link>
              <span>Alejandro Gutiérrez</span>
            </div>
            <div className="hp-provenance">
              {hero.docCount != null ? <span>{formatNumber(hero.docCount)} documentos</span> : null}
              <span>{formatNumber(hero.fragmentCount)} fragmentos</span>
              {readingMinutes ? <span>{readingMinutes} min</span> : null}
            </div>
          </div>
        </section>
      ) : null}

      {queue.length ? (
        <section className="hp-queue hp-wide">
          <div className="hp-section-label">En el archivo <Arrow /></div>
          <div className="hp-queue-list">
            {queue.map((item) => (
              <Link href={item.href} key={item.id}>
                <span className="hp-row-type">{item.kicker}</span>
                <strong>{item.title}</strong>
                <span className="hp-row-period">{item.periodCode ? PERIODS[item.periodCode as PeriodCode]?.yearRange : ""}</span>
                <Arrow />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="hp-wide hp-content">
        <section className="hp-index-section">
          <header className="hp-major-head">
            <span>01</span>
            <h2>{formatNumber(archive.total)} piezas publicadas</h2>
          </header>
          <div className="hp-index-list">
            <Link href="/hechos" className="hp-index-row">
              <b>{archive.hechos}</b><div><h3>Hechos</h3><p>Acontecimientos con fecha, lugares, protagonistas, causas y consecuencias.</p></div><Arrow />
              <div className="hp-index-media">{cardImage(hechos[0]?.imageUrl ?? null, hechos[0]?.titulo ?? "Hechos", "", false, 320)}</div>
            </Link>
            <Link href="/epocas" className="hp-index-row">
              <b>{archive.epocas}</b><div><h3>Épocas</h3><p>Períodos con panorama, hitos, actores y legado.</p></div><Arrow />
              <div className="hp-mini-timeline" aria-hidden>{ATLAS_CODES.slice(0, 6).map((code) => <i key={code} style={{ background: getPeriodColor(code) }} />)}</div>
            </Link>
            <Link href="/personas" className="hp-index-row">
              <b>{archive.biografias}</b><div><h3>Biografías</h3><p>Personas con historia propia, fuentes y conexiones.</p></div><Arrow />
              <div className="hp-index-portraits">{biographies.map((card) => <span key={card.id}>{cardImage(card.imageUrl, card.titulo, "", false, 160)}</span>)}</div>
            </Link>
            <Link href="/ensayos" className="hp-index-row">
              <b>{archive.preguntas}</b><div><h3>Pregunta</h3><p>Una lectura razonada desde las fuentes.</p></div><Arrow />
              <div className="hp-index-question">{hero?.title ?? "Lecturas del archivo"}</div>
            </Link>
          </div>
        </section>

        <section className="hp-evidence">
          <div className="hp-evidence-intro">
            <span>02</span>
            <h2>Un archivo construido con fuentes</h2>
            <p>Totales calculados desde las piezas publicadas y los fragmentos que citan.</p>
            <Link href="/acerca#metodo">Método y fuentes <Arrow /></Link>
          </div>
          <dl>
            <div><dt>{formatNumber(archive.documents)}</dt><dd>documentos citados</dd></div>
            <div><dt>{formatNumber(archive.fragments)}</dt><dd>fragmentos</dd></div>
            <div><dt>{formatNumber(archive.words)}</dt><dd>palabras</dd></div>
            <div><dt>{formatNumber(archive.readingHours)}</dt><dd>horas de lectura</dd></div>
          </dl>
        </section>

        {sequence.length ? (
          <section className="hp-sequence">
            <div className="hp-side-head">
              <span>03</span>
              <h2>Hechos en secuencia</h2>
              {epoca ? (
                <p>Los hechos de {PERIODS[epoca].label}, en orden cronológico.</p>
              ) : home.collection?.title ? (
                <p>{home.collection.title}</p>
              ) : null}
              <Link href={epoca ? `/hechos?periodo=${epoca}` : "/hechos"}>
                {epoca ? "Ver los hechos de la época" : `Ver los ${archive.hechos} hechos`} <Arrow />
              </Link>
            </div>
            <div className="hp-sequence-list">
              {sequence.map((card) => (
                <article key={card.id} className="hp-sequence-item">
                  <div className="hp-sequence-year">{card.yearLabel ?? "—"}<i /></div>
                  <Link href={card.href} className="hp-sequence-image">{cardImage(card.imageUrl, card.title, "", false, 640)}</Link>
                  <div className="hp-sequence-copy">
                    <h3><Link href={card.href}>{card.title}</Link></h3>
                    {card.summary ? <p>{card.summary}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="hp-epochs">
          <div className="hp-side-head">
            <span>04</span>
            <h2>Quince épocas, {formatNumber(timelineEvents)} eventos</h2>
            <p>Panorama de largo plazo, con hitos y actores clave.</p>
          </div>
          <div className="hp-epochs-body">
            <div className="hp-epochs-rail">
              {epocas.map((card) => (
                <Link key={card.id} href={card.href} style={{ "--period-color": getPeriodColor(card.periodCode ?? "TRANS") } as React.CSSProperties}>
                  <span>{card.titulo.replace(/\s*\([^)]*\)\s*$/, "")}</span>
                  <small>{card.meta}</small>
                  <i />
                </Link>
              ))}
            </div>
            <div className="hp-epochs-actions">
              <Link href="/epocas">Ver las {archive.epocas} épocas <Arrow /></Link>
              <span>La línea de tiempo reúne {formatNumber(timelineEvents)} eventos.</span>
              <Link href="/linea-de-tiempo">Abrir línea de tiempo <Arrow /></Link>
            </div>
          </div>
        </section>

        <section className="hp-connected">
          <div className="hp-side-head">
            <span>05</span>
            <h2>El archivo conectado</h2>
            <p>Biografías propias y entidades presentes en piezas publicadas.</p>
          </div>
          <div className="hp-connected-body">
            {biographies.length ? (
              <div className="hp-biographies">
                <div className="hp-subhead"><strong>Con historia propia</strong><span>{biographies.length} biografías publicadas</span></div>
                <div className="hp-biography-list">
                  {biographies.map((card) => (
                    <Link key={card.id} href={card.href}>
                      {cardImage(card.imageUrl, card.titulo, "", false, 160)}
                      <span><strong>{card.titulo}</strong><small>{card.meta} · {card.periodCode ? PERIODS[card.periodCode as PeriodCode]?.yearRange : ""}</small></span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <ConnectedDirectory groups={directoryGroups} />
          </div>
        </section>

        {home.questionOfWeek ? (
          <section className="hp-question">
            <div><span>Pregunta abierta</span><h2>{home.questionOfWeek.title}</h2></div>
            <p>{home.questionOfWeek.answer}</p>
            <Link href={home.questionOfWeek.href}>Leer la respuesta <Arrow /></Link>
          </section>
        ) : null}

        <section className="hp-latest">
          <div className="hp-side-head">
            <span>06</span>
            <h2>{epoca ? `Todo sobre ${PERIODS[epoca].label}` : "Lo recién publicado"}</h2>
            <p>Las últimas piezas añadidas al archivo.</p>
            <Link href="/archivo">Abrir todo el archivo <Arrow /></Link>
          </div>
          <div className="hp-latest-list">
            {recent.slice(0, 5).map((piece) => (
              <Link href={piece.href} key={piece.id}>
                <span className="hp-row-type" style={{ "--dot": getPeriodColor(piece.periodCode ?? "TRANS") } as React.CSSProperties}>{piece.label}</span>
                <strong>{piece.title}</strong>
                <span>{piece.yearLabel ?? ""}</span>
                <Arrow />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
