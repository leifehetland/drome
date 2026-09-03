import "server-only";

const BASE = "https://api.themoviedb.org/3";

export function tmdbConfigured() {
  return Boolean(process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY);
}

async function tmdbGet(path: string) {
  const token = process.env.TMDB_READ_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (!token && !key) throw new Error("TMDB credentials not configured");
  const url = `${BASE}${path}${key ? (path.includes("?") ? "&" : "?") + "api_key=" + key : ""}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export type TmdbDetails = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  releaseYear: number | null;
  genres: string | null;
  director: string | null;
  topCast: string | null;
  voteAverage: number | null;
};

export async function fetchTmdbDetails(mediaType: "movie" | "tv", id: number): Promise<TmdbDetails> {
  const isTv = mediaType === "tv";
  const d = await tmdbGet(`/${isTv ? "tv" : "movie"}/${id}?append_to_response=credits`);
  const date = isTv ? d.first_air_date : d.release_date;
  const director = isTv
    ? (d.created_by || []).map((c: { name: string }) => c.name).join(", ") || null
    : (d.credits?.crew || []).find((c: { job: string }) => c.job === "Director")?.name ?? null;
  return {
    tmdbId: d.id,
    mediaType,
    posterPath: d.poster_path ?? null,
    backdropPath: d.backdrop_path ?? null,
    overview: d.overview || null,
    releaseYear: date ? Number(String(date).slice(0, 4)) || null : null,
    genres: (d.genres || []).map((g: { name: string }) => g.name).join(", ") || null,
    director,
    topCast: (d.credits?.cast || []).slice(0, 4).map((c: { name: string }) => c.name).join(", ") || null,
    voteAverage: d.vote_average ?? null,
  };
}
