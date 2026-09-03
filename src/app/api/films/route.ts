import { NextRequest, NextResponse } from "next/server";
import { getFilms, countFilms } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filters = {
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    format: searchParams.get("format") ?? undefined,
    rating: searchParams.get("rating") ?? undefined,
    limit: Number(searchParams.get("limit")) || 48,
    offset: Number(searchParams.get("offset")) || 0,
  };

  try {
    const [films, total] = await Promise.all([getFilms(filters), countFilms(filters)]);
    return NextResponse.json({ total, count: films.length, films });
  } catch (err) {
    console.error("GET /api/films failed:", err);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
