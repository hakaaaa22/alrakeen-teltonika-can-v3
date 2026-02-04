export async function getWikimediaThumb(query: string): Promise<string | null> {
  // Wikimedia REST: page summary gives thumbnail if page exists. We try a simple search first.
  const q = encodeURIComponent(query);
  const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${q}&limit=1`;
  const s = await fetch(searchUrl, { next: { revalidate: 86400 } });
  if (!s.ok) return null;
  const sj = await s.json();
  const title = sj?.pages?.[0]?.title;
  if (!title) return null;

  const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const r = await fetch(sumUrl, { next: { revalidate: 86400 } });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.thumbnail?.source ?? null;
}

export function deviceImageUrl(device: string): string | null {
  // Conservative: link to official product pages (actual embedding happens in PDF/Excel as URL).
  if (device === "FMC650") return "https://www.teltonika-gps.com/products/trackers/professional/fmc650";
  if (device === "FMC150") return "https://wiki.teltonika-gps.com/view/FMC150";
  return null;
}
