import { PublicShell } from "@/components/public/public-shell";
import { HomeChronology } from "@/components/public/home/home-chronology";
import { HomeConnected } from "@/components/public/home/home-connected";
import { HomeEditionHeader } from "@/components/public/home/home-edition-header";
import { HomeEssays } from "@/components/public/home/home-essays";
import { HomeImprint } from "@/components/public/home/home-imprint";
import { HomeLead } from "@/components/public/home/home-lead";
import { HomeRecentIndex } from "@/components/public/home/home-recent-index";
import { JsonLd } from "@/components/public/json-ld";
import type {
  HomeEditionCounts,
  HomeEntity,
  HomeStory,
} from "@/components/public/home/types";
import {
  HISTORICAL_PERIODS,
  PERIODS,
  type PeriodCode,
} from "@/lib/design-tokens";
import {
  getConnectedEntityDirectory,
  getHome,
  getPeriodHub,
  getPublicArchiveStats,
  getRecentPublicPieces,
  getTypologyList,
  type EntityChip,
  type HomeCard,
  type HubPiece,
  type PublicArchivePiece,
  type PublicEntity,
  type TypologyCard,
} from "@/lib/public-data";
import { homeJsonLd } from "@/lib/seo";
import "@/components/public/home/home-redesign.css";

export const dynamic = "force-dynamic";

const HOME_DESCRIPTION =
  "Una portada histórica que conecta hechos, épocas, ensayos, personas, lugares e ideas con las fuentes siempre a la vista.";

export const metadata = {
  title: { absolute: "Historia de Colombia · Archivo abierto y citable" },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
};

function validPeriod(raw: string | string[] | undefined): PeriodCode | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return HISTORICAL_PERIODS.includes(value as PeriodCode) ? (value as PeriodCode) : null;
}

function periodCode(value: string | null): PeriodCode | null {
  return value && value in PERIODS ? (value as PeriodCode) : null;
}

function storyFromArchive(piece: PublicArchivePiece): HomeStory {
  return {
    id: piece.id,
    href: piece.href,
    title: piece.title,
    summary: piece.summary,
    label: piece.label,
    periodCode: periodCode(piece.periodCode),
    yearLabel: piece.yearLabel,
    imageUrl: piece.imageUrl,
    publishedAt: piece.publishedAt?.toISOString() ?? null,
  };
}

function storyFromHome(card: HomeCard): HomeStory {
  const period = periodCode(card.periodCode);
  return {
    id: card.id,
    href: card.href,
    title: card.title,
    summary: card.desc,
    label: card.kicker,
    periodCode: period,
    yearLabel: period ? PERIODS[period].yearRange : null,
    imageUrl: card.imageUrl,
    publishedAt: null,
  };
}

function entityFromChip(entity: EntityChip): HomeEntity {
  return {
    name: entity.name,
    href: entity.href,
    count: entity.count,
    imageUrl: entity.imageUrl,
  };
}

function entityFromDirectory(entity: PublicEntity): HomeEntity {
  return {
    name: entity.name,
    href: entity.href,
    count: entity.mentions,
    imageUrl: entity.imageUrl,
  };
}

function storyFromHub(piece: HubPiece, index: number): HomeStory {
  const label = piece.kind === "hecho" ? "Hecho" : piece.kind === "pregunta" ? "Pregunta" : "Ensayo";
  return {
    id: `${piece.href}:${index}`,
    href: piece.href,
    title: piece.titulo,
    summary: piece.resumen,
    label,
    periodCode: null,
    yearLabel: piece.yearLabel,
    imageUrl: piece.imageUrl,
    publishedAt: null,
    people: piece.protagonistas.map(entityFromChip),
  };
}

function storyFromFact(card: TypologyCard): HomeStory {
  return {
    id: card.id,
    href: card.href,
    title: card.titulo,
    summary: card.resumen,
    label: "Hecho",
    periodCode: periodCode(card.periodCode),
    yearLabel: card.meta,
    imageUrl: card.imageUrl,
    publishedAt: null,
  };
}

/** Conserva diversidad tipológica en la columna secundaria. */
function diverseStories(stories: HomeStory[], omitId: string, limit: number): HomeStory[] {
  const candidates = stories.filter((story) => story.id !== omitId);
  const chosen: HomeStory[] = [];
  const labels = ["Hecho", "Época", "Ensayo", "Pregunta", "Biografía", "Lugar", "Idea"];
  for (const label of labels) {
    const match =
      candidates.find(
        (story) => story.label === label && story.imageUrl && !chosen.some((item) => item.id === story.id),
      ) ??
      candidates.find((story) => story.label === label && !chosen.some((item) => item.id === story.id));
    if (match) chosen.push(match);
    if (chosen.length === limit) return chosen;
  }
  for (const story of candidates) {
    if (!chosen.some((item) => item.id === story.id)) chosen.push(story);
    if (chosen.length === limit) break;
  }
  return chosen;
}

function periodLead(stories: HomeStory[]): HomeStory | undefined {
  return [...stories].sort((a, b) => {
    const score = (story: HomeStory) =>
      (story.imageUrl ? 100 : 0) +
      (story.people?.length ?? 0) * 7 -
      Math.max(0, story.title.length - 48) * .65;
    return score(b) - score(a);
  })[0];
}

function takeAcrossHistory(stories: HomeStory[], limit: number): HomeStory[] {
  if (stories.length <= limit) return stories;
  const result: HomeStory[] = [];
  const last = stories.length - 1;
  for (let index = 0; index < limit; index++) {
    result.push(stories[Math.round((index * last) / (limit - 1))]);
  }
  return result;
}

function takeAcrossHistoryWithLead(
  stories: HomeStory[],
  limit: number,
  leadId: string | undefined,
): HomeStory[] {
  const sampled = takeAcrossHistory(stories, limit);
  if (!leadId || sampled.some((story) => story.id === leadId)) return sampled;
  const lead = stories.find((story) => story.id === leadId);
  if (!lead || !sampled.length) return sampled;

  const selectedIds = new Set(sampled.map((story) => story.id));
  selectedIds.delete(sampled[Math.floor(sampled.length / 2)].id);
  selectedIds.add(lead.id);
  return stories.filter((story) => selectedIds.has(story.id));
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ epoca?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedPeriod = validPeriod(params.epoca);

  const [home, archive, allPieces, facts, peopleDirectory, placesDirectory, ideasDirectory, hub] =
    await Promise.all([
      getHome(),
      getPublicArchiveStats(),
      getRecentPublicPieces(5000),
      getTypologyList("hecho", 1000),
      getConnectedEntityDirectory("persona"),
      getConnectedEntityDirectory("lugar"),
      getConnectedEntityDirectory("idea"),
      selectedPeriod ? getPeriodHub(selectedPeriod) : Promise.resolve(null),
    ]);

  const selectedInfo = selectedPeriod ? PERIODS[selectedPeriod] : null;
  const editionLabel = selectedInfo?.label ?? "todas las épocas";
  const editionTitle = selectedInfo ? `${selectedInfo.label} · ${selectedInfo.yearRange}` : "Edición general";
  const editionPieces = selectedPeriod
    ? allPieces.filter((piece) => piece.periodCode === selectedPeriod)
    : allPieces;
  const archiveStories = editionPieces.map(storyFromArchive);

  const periodFacts = hub?.hechos.map((piece, index) => ({
    ...storyFromHub(piece, index),
    periodCode: selectedPeriod,
  })) ?? [];

  const fallbackHero = archiveStories.find((story) => story.label === "Hecho" && story.imageUrl)
    ?? archiveStories.find((story) => story.imageUrl)
    ?? archiveStories[0];
  const hero = selectedPeriod
    ? periodLead(periodFacts) ?? fallbackHero
    : home.hero
      ? storyFromHome(home.hero)
      : fallbackHero;

  const generalFeatured = [
    ...home.featured.map(storyFromHome),
    ...allPieces.map(storyFromArchive),
  ];
  const secondary = hero
    ? diverseStories(selectedPeriod ? archiveStories : generalFeatured, hero.id, 3)
    : [];

  const firstFactByPeriod = HISTORICAL_PERIODS
    .map((code) => facts.find((fact) => fact.periodCode === code))
    .filter((fact): fact is TypologyCard => Boolean(fact))
    .map(storyFromFact);
  const chronology = selectedPeriod
    ? takeAcrossHistoryWithLead(periodFacts, 8, hero?.id)
    : takeAcrossHistory(firstFactByPeriod, 8);

  const people: HomeEntity[] = hub
    ? hub.personas.map(entityFromChip)
    : peopleDirectory.map(entityFromDirectory);
  const places: HomeEntity[] = hub
    ? hub.lugares.map(entityFromChip)
    : placesDirectory.map(entityFromDirectory);
  const ideas: HomeEntity[] = hub
    ? hub.ideas.map(entityFromChip)
    : ideasDirectory.map(entityFromDirectory);
  const essays = hub
    ? hub.ensayos.map((piece, index) => ({
        ...storyFromHub(piece, index),
        periodCode: selectedPeriod,
      }))
    : allPieces
        .filter((piece) => piece.kind === "ensayo" || piece.kind === "pregunta")
        .map(storyFromArchive);

  const counts: HomeEditionCounts = hub
    ? {
        pieces: hub.pieceCount,
        facts: hub.counts.hechos,
        essays: hub.counts.ensayos,
        people: hub.counts.personas,
        places: hub.counts.lugares,
        ideas: hub.counts.ideas,
      }
    : {
        pieces: archive.total,
        facts: archive.hechos,
        essays: archive.lecturas + archive.preguntas,
        people: peopleDirectory.length,
        places: placesDirectory.length,
        ideas: ideasDirectory.length,
      };

  const editionDate = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date());

  return (
    <PublicShell variant="edition">
      <div className="hc-home" data-mode="light">
        <JsonLd data={homeJsonLd(HOME_DESCRIPTION)} />
        <HomeEditionHeader
          selectedPeriod={selectedPeriod}
          counts={counts}
          editionDate={editionDate}
        />

        <main>
          {hero ? (
            <HomeLead lead={hero} secondary={secondary} editionLabel={editionLabel} />
          ) : null}

          <HomeChronology
            key={`chronology:${selectedPeriod ?? "general"}`}
            stories={chronology}
            editionLabel={editionLabel}
            allHref={selectedPeriod ? `/linea-de-tiempo?p=${selectedPeriod}` : "/linea-de-tiempo"}
            initialStoryId={selectedPeriod ? hero?.id : undefined}
          />

          <HomeConnected
            key={`connected:${selectedPeriod ?? "general"}`}
            people={people}
            places={places}
            ideas={ideas}
            selectedPeriod={selectedPeriod}
            editionLabel={editionLabel}
            totals={{ people: counts.people, places: counts.places, ideas: counts.ideas }}
          />

          <HomeEssays essays={essays} editionLabel={editionLabel} />
          <HomeRecentIndex stories={archiveStories} editionLabel={editionLabel} />
        </main>

        <HomeImprint
          editionLabel={editionTitle}
          counts={counts}
          evidence={{
            documents: archive.documents,
            fragments: archive.fragments,
            words: archive.words,
            readingHours: archive.readingHours,
          }}
        />
      </div>
    </PublicShell>
  );
}
