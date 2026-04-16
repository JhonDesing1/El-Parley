import type { DB, Insert } from "./types";

export function blogPostsRepo(db: DB) {
  return {
    /** Post publicado por slug, con todos sus campos. Usado en blog/[slug]. */
    async getBySlug(slug: string) {
      return db
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();
    },

    /** Solo metadatos SEO para generateMetadata. */
    async getMetaBySlug(slug: string) {
      return db
        .from("blog_posts")
        .select("seo_title, seo_description, title, excerpt, published_at")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();
    },

    /** Posts relacionados por categoría, excluyendo el actual. */
    async getRelated(category: string, excludeSlug: string, limit = 3) {
      return db
        .from("blog_posts")
        .select("slug, title, excerpt, published_at, category")
        .eq("is_published", true)
        .neq("slug", excludeSlug)
        .eq("category", category)
        .order("published_at", { ascending: false })
        .limit(limit);
    },

    /** Incrementa el contador de vistas (fire-and-forget). */
    incrementViews(id: string) {
      db.from("blog_posts")
        .update({ views: db.rpc("increment_views" as never) as never })
        .eq("id", id)
        .then();
    },

    /** Verifica si ya existe un post con ese slug. Usado en generate-blog. */
    async existsBySlug(slug: string) {
      const { data } = await db
        .from("blog_posts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      return data !== null;
    },

    /** Inserta un post generado. Usado en generate-blog. */
    async insert(post: Insert<"blog_posts">) {
      return db.from("blog_posts").insert(post);
    },

    /** Elimina posts relacionados con partidos muy antiguos. Usado en cleanup-odds. */
    async deleteForMatches(matchIds: number[]) {
      return db
        .from("blog_posts")
        .delete({ count: "exact" })
        .in("related_match_id", matchIds);
    },

    /** Posts publicados para el sitemap. */
    async forSitemap() {
      return db
        .from("blog_posts")
        .select("slug, updated_at")
        .eq("is_published", true)
        .limit(1000);
    },
  };
}
