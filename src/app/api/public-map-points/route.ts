import { NextRequest, NextResponse } from "next/server";
import { HISTORICAL_PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { getMapPoints } from "@/lib/public-data";

export const dynamic = "force-dynamic";

function validPeriod(value: string | null): PeriodCode | null {
  if (!value) return null;
  return HISTORICAL_PERIODS.includes(value as PeriodCode) ? (value as PeriodCode) : null;
}

export async function GET(request: NextRequest) {
  const rawPeriod = request.nextUrl.searchParams.get("epoca");
  const period = validPeriod(rawPeriod);
  if (rawPeriod && !period) {
    return NextResponse.json({ error: "Época no válida" }, { status: 400 });
  }

  const allPoints = await getMapPoints();
  const points = period
    ? allPoints.filter((point) => point.periodCode === period)
    : allPoints;

  return NextResponse.json(
    { points },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
      },
    },
  );
}
