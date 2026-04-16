import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elparley.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE}/parlays`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/premium`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/blog`, changeFrequency: "daily", priority: 0.8 },
  ];

  const { data: matches } = await supabase
    .from("matches")
    .select("id, kickoff")
    .gte("kickoff", new Date().toISOString())
    .order("kickoff")
    .limit(2000);

  const matchUrls: MetadataRoute.Sitemap = (matches ?? []).map((m) => ({
    url: `${SITE}/partido/${m.id}`,
    lastModified: new Date(m.kickoff),
    changeFrequency: "hourly",
    priority: 0.7,
  }));

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("is_published", true)
    .limit(1000);

  const blogUrls: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticUrls, ...matchUrls, ...blogUrls];
}
