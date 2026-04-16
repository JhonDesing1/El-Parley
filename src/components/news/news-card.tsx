import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import type { NewsArticle } from "@/types";

interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-md"
    >
      {article.urlToImage && (
        <div className="relative h-44 w-full overflow-hidden bg-muted">
          <Image
            src={article.urlToImage}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">
            {article.source.name}
          </span>
          <time dateTime={article.publishedAt}>
            {format(new Date(article.publishedAt), "d MMM yyyy", { locale: es })}
          </time>
        </div>

        <h2 className="line-clamp-2 text-sm font-bold leading-snug text-foreground group-hover:text-value">
          {article.title}
        </h2>

        {article.description && (
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {article.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-value">
          Leer artículo
          <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </a>
  );
}
