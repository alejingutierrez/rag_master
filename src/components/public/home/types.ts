import type { PeriodCode } from "@/lib/design-tokens";

export interface HomeEntity {
  name: string;
  href: string;
  count: number;
  imageUrl: string | null;
}

export interface HomeStory {
  id: string;
  href: string;
  title: string;
  summary: string;
  label: string;
  periodCode: PeriodCode | null;
  yearLabel: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  people?: HomeEntity[];
}

export interface HomeEditionCounts {
  pieces: number;
  facts: number;
  essays: number;
  people: number;
  places: number;
  ideas: number;
}

export interface HomeArchiveEvidence {
  documents: number;
  fragments: number;
  words: number;
  readingHours: number;
}
