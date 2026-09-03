import { NextRequest, NextResponse } from "next/server";
import { getFilms } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const limit = Number(searchParams.get("limit")) || 60;
  const offset = Number(searchParams.get("offset")) || 0;

  try {
    const films = await getFilms({ q, limit, offset });
    return NextResponse.json({ count: films.length, films });
  } catch (err) {
    console.error("GET /api/films failed:", err);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
