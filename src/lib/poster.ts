/** TMDB image helper (poster paths are public; safe on the client). */
export function posterUrl(path: string | null | undefined, size = "w342") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}
