/**
 * Capa de repositorio — abstrae todas las queries a Supabase.
 *
 * Uso en Server Components (cliente con contexto de sesión):
 *   const supabase = await createClient();
 *   const matches = matchesRepo(supabase);
 *   const upcoming = await matches.getUpcoming(from, to);
 *
 * Uso en cron jobs / route handlers (cliente admin):
 *   const supabase = createAdminClient();
 *   const leagues = leaguesRepo(supabase);
 *   const { data } = await leagues.getFeatured();
 */

export { matchesRepo } from "./matches";
export { oddsRepo } from "./odds";
export { valueBetsRepo } from "./value-bets";
export { profilesRepo } from "./profiles";
export { userPicksRepo } from "./user-picks";
export { userParlaysRepo, userParlayLegsRepo } from "./user-parlays";
export { parlaysRepo } from "./parlays";
export { leaguesRepo } from "./leagues";
export { teamsRepo } from "./teams";
export { bookmakersRepo } from "./bookmakers";
export { subscriptionsRepo } from "./subscriptions";
export { blogPostsRepo } from "./blog-posts";
export { affiliateRepo } from "./affiliate";
export { notificationsRepo } from "./notifications";
export { leaderboardRepo } from "./leaderboard";
export { favoritesRepo } from "./favorites";

export type { DB } from "./types";
