import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Calendar, Tag, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/blog/markdown-renderer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("seo_title, seo_description, title, excerpt, published_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) return { title: "Artículo no encontrado · Coutazo" };

  return {
    title: post.seo_title ?? post.title,
    description: post.seo_description ?? post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.seo_title ?? post.title,
      description: post.seo_description ?? post.excerpt ?? undefined,
      type: "article",
      locale: "es_CO",
      publishedTime: post.published_at ?? undefined,
    },
  };
}

export const revalidate = 3600;

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) notFound();

  // Incrementar vistas (best-effort, sin bloquear render)
  supabase
    .from("blog_posts")
    .update({ views: (post.views ?? 0) + 1 })
    .eq("id", post.id)
    .then(() => {});

  // Posts relacionados del mismo partido o categoría
  const { data: related } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, published_at, category")
    .eq("is_published", true)
    .neq("slug", slug)
    .eq("category", post.category ?? "")
    .order("published_at", { ascending: false })
    .limit(3);

  return (
    <div className="container max-w-4xl py-10">
      {/* Breadcrumb */}
      <Link
        href="/blog"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Análisis
      </Link>

      <article>
        {/* Header */}
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {post.category && (
              <Badge variant="value" className="uppercase">
                <TrendingUp className="mr-1 h-3 w-3" />
                {post.category}
              </Badge>
            )}
            {(post.tags as string[] | null)?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="mr-1 h-2.5 w-2.5" />
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="font-display text-3xl font-black leading-tight tracking-tight md:text-4xl">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border/40 pt-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {post.published_at
                ? format(new Date(post.published_at), "d 'de' MMMM yyyy", { locale: es })
                : "—"}
            </span>
            <span className="font-semibold text-foreground">{post.author ?? "Coutazo"}</span>
            {(post.views ?? 0) > 0 && (
              <span>{post.views?.toLocaleString("es-CO")} lecturas</span>
            )}
          </div>
        </header>

        {/* Contenido */}
        <MarkdownRenderer content={post.content} />
      </article>

      {/* Artículos relacionados */}
      {(related ?? []).length > 0 && (
        <aside className="mt-16 border-t border-border/40 pt-10">
          <h2 className="mb-5 font-display text-xl font-bold">Más análisis</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {(related ?? []).map((r) => (
              <Link key={r.slug} href={`/blog/${r.slug}`}>
                <Card className="h-full p-4 transition-all hover:border-primary/30 hover:shadow-md">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{r.title}</p>
                  {r.excerpt && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                      {r.excerpt}
                    </p>
                  )}
                  {r.published_at && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {format(new Date(r.published_at), "d MMM yyyy", { locale: es })}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
