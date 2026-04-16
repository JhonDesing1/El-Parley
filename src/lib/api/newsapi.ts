import type { NewsArticle } from "@/types";

const BASE = "https://newsapi.org/v2";

export async function fetchSportsNews(pageSize = 12): Promise<NewsArticle[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NEWS_API_KEY no configurada");

  const url = new URL(`${BASE}/everything`);
  url.searchParams.set("q", "fútbol apuestas Colombia liga");
  url.searchParams.set("language", "es");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), {
    next: { revalidate: 3600 }, // revalidar cada hora
  });

  if (!res.ok) {
    throw new Error(`NewsAPI error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.status !== "ok") {
    throw new Error(`NewsAPI: ${json.message ?? "Error desconocido"}`);
  }

  return (json.articles as NewsArticle[]).filter(
    (a) => a.title && a.title !== "[Removed]",
  );
}
