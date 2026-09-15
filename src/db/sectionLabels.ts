// The store's CLASS_DES field is only 15 chars, so many curated-section names are
// truncated ("ALFRED HITCHCOC") or were misspelled at data-entry ("FREDERIC FELLIN").
// Map the raw values to clean display names; anything not listed is Title-Cased.

const FIXES: Record<string, string> = {
  "ALFRED HITCHCOC": "Alfred Hitchcock",
  "QUINTIN TARANTI": "Quentin Tarantino",
  "FREDERIC FELLIN": "Federico Fellini",
  "IGMAR BERGMAN": "Ingmar Bergman",
  "AKIRA KURISAWA": "Akira Kurosawa",
  "STEVEN SODERBUR": "Steven Soderbergh",
  "STEVEN SPIELBER": "Steven Spielberg",
  "JEAN LUC GODARD": "Jean-Luc Godard",
  "DAVID CRONENBUR": "David Cronenberg",
  "BRIAN DEPALMA": "Brian De Palma",
  "PEDRO ALMODAVAR": "Pedro Almodóvar",
  "FRANCIS COPPOLA": "Francis Ford Coppola",
  "FRANCOIS TRUFFE": "François Truffaut",
  "FRANCOIS OZON": "François Ozon",
  "MICHAEL WINTERB": "Michael Winterbottom",
  "CLAUDE CHARBROL": "Claude Chabrol",
  "RICH LINKLATTER": "Richard Linklater",
  "ZIANG YIMOU": "Zhang Yimou",
  "KIYOSHI KUROSAW": "Kiyoshi Kurosawa",
  "PASSOLINI": "Pier Paolo Pasolini",
  "M. ANTONIONI": "Michelangelo Antonioni",
  "ABBAS KIAROSTAM": "Abbas Kiarostami",
  "JP MELVILLE": "Jean-Pierre Melville",
  "KRYZSTOF KIESLO": "Krzysztof Kieślowski",
  "J. MANIEWICZ": "Joseph L. Mankiewicz",
  "NICK ROEG": "Nicolas Roeg",
  "R. RODRIGUEZ": "Robert Rodriguez",
  "BARBET SCHROEDR": "Barbet Schroeder",
  "ANDREI TARKOVSK": "Andrei Tarkovsky",
  "TSAI MING-LANG": "Tsai Ming-liang",
  "A. WEERASETHAKU": "Apichatpong Weerasethakul",
  "ALEN RENAIS": "Alain Resnais",
  "PT ANDERSON": "Paul Thomas Anderson",
  "BERNARD BERTOLU": "Bernardo Bertolucci",
  "SEIJAN SUZUKI": "Seijun Suzuki",
  "NICOLAS REFN": "Nicolas Winding Refn",
  "JIA ZHANG-KE": "Jia Zhangke",
  "ALEX JODEROWSKY": "Alejandro Jodorowsky",
  "MONTE HELLEMAN": "Monte Hellman",
  "CHING SIU TENG": "Ching Siu-tung",
  "HERSHEL G LEWIS": "Herschell Gordon Lewis",
  "JOHN SCHLESINGE": "John Schlesinger",
  "DENIS VILLENEUV": "Denis Villeneuve",
  "ALEX DE LA IGLE": "Álex de la Iglesia",
  "DAVID O'RUSSEL": "David O. Russell",
  "DAVID O'RUSEL": "David O. Russell",
  "EMIR KURSTARICA": "Emir Kusturica",
  "PETER BOGDANOVI": "Peter Bogdanovich",
  "SAM RAMI": "Sam Raimi",
  "WILLIAM FRIEDKI": "William Friedkin",
  "JOHN FRANKENHEI": "John Frankenheimer",
  "CHRIS NOLAN": "Christopher Nolan",
  "SHAW BROS": "Shaw Brothers",
  "OZU": "Yasujirō Ozu",
  "TATI": "Jacques Tati",
  "MAYSLES": "Maysles Brothers",
  "HAYAO MIYAZAKI": "Hayao Miyazaki",
  "PEDRO COSTA": "Pedro Costa",
};

const KEEP_UPPER = new Set(["MST3K", "SNL", "LBGTQ", "TV", "US", "UK", "HK", "GG", "WC"]);

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function sectionLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toUpperCase();
  return FIXES[key] ?? titleCase(raw.trim());
}

// Generic store stock buckets (not curated) — hidden from the landing + section filter.
export const GENERIC_CLASS_CODES = ["NEW", "DVD", "MIS"];
