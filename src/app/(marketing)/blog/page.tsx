import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { fetchSportsNews } from "@/lib/api/newsapi";
import { NewsCard } from "@/components/news/news-card";

export const metadata: Metadata = {
  title: "Análisis y Noticias — El Parley",
  description:
    "Las últimas noticias del fútbol colombiano y LATAM relevantes para tus apuestas deportivas.",
};

export const revalidate = 3600; // 1 hora

export default async function BlogPage() {
  let articles: Awaited<ReturnType<typeof fetchSportsNews>> = [];
  try {
    articles = await fetchSportsNews(12);
  } catch {
    articles = [];
  }

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-value">
          <Newspaper className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-widest">Noticias</span>
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Análisis & Noticias
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Información relevante del fútbol colombiano y LATAM para tomar mejores decisiones
          de apuesta.
        </p>
      </header>

      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Newspaper className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No hay noticias disponibles ahora mismo.</p>
          <p className="mt-1 text-xs text-muted-foreground">Vuelve más tarde.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <NewsCard key={article.url} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
