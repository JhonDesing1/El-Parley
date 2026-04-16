import type { DB, Insert, Update } from "./types";

export function matchesRepo(db: DB) {
  return {
    /** Partidos de las próximas N horas con equipo y liga. Usado en home y parlays builder. */
    async getUpcoming(from: string, to: string, limit = 12) {
      return db
        .from("matches")
        .select(
          `*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), league:leagues(*)`,
        )
        .gte("kickoff", from)
        .lte("kickoff", to)
        .order("kickoff", { ascending: true })
        .limit(limit);
    },

    /** Partidos programados sin modelo xG, para las próximas 72h. Usado en sync-fixtures. */
    async getNeedingXG(from: string, to: string) {
      return db
        .from("matches")
        .select("id, league_id, model_expected_goals_home, model_expected_goals_away")
        .gte("kickoff", from)
        .lte("kickoff", to)
        .eq("status", "scheduled")
        .is("model_expected_goals_home", null);
    },

    /** Partidos live + scheduled cuyo kickoff ya superó el umbral. Usado en sync-results. */
    async getLiveAndStale(staleThreshold: string, limit = 10) {
      return db
        .from("matches")
        .select("id, status, home_score, away_score")
        .or(
          [
            "status.eq.live",
            `and(status.eq.scheduled,kickoff.lte.${staleThreshold})`,
          ].join(","),
        )
        .limit(limit);
    },

    /** Partidos live o que arrancan pronto (próximas 2h) en ligas de alta prioridad. sync-live-odds. */
    async getLiveAndSoon(leagueIds: number[], withinMinutes = 120) {
      const inXh = new Date(Date.now() + withinMinutes * 60 * 1000).toISOString();
      return db
        .from("matches")
        .select(
          "id, league_id, model_expected_goals_home, model_expected_goals_away, status",
        )
        .or(
          `status.eq.live,and(status.eq.scheduled,kickoff.gte.${new Date().toISOString()},kickoff.lte.${inXh})`,
        )
        .in("league_id", leagueIds);
    },

    /** Partidos de hoy y mañana con status scheduled/live. Usado en sync-odds. */
    async getScheduledForSync(from: string, to: string) {
      return db
        .from("matches")
        .select("id")
        .gte("kickoff", from)
        .lte("kickoff", to)
        .in("status", ["scheduled", "scheduled", "live"]);
    },

    /** Partidos terminados anteriores a `threshold`. Usado en cleanup-odds. */
    async getFinishedBefore(threshold: string) {
      return db
        .from("matches")
        .select("id")
        .eq("status", "finished")
        .lt("kickoff", threshold);
    },

    /** Todos los partidos futuros para el sitemap. */
    async forSitemap() {
      return db
        .from("matches")
        .select("id, kickoff")
        .gte("kickoff", new Date().toISOString())
        .order("kickoff", { ascending: true })
        .limit(2000);
    },

    /** Upsert masivo de fixtures provenientes de API-Football. */
    async upsertMany(fixtures: Insert<"matches">[]) {
      return db.from("matches").upsert(fixtures, { onConflict: "id" });
    },

    /** Actualiza campos del partido (score, status, xG, etc.). */
    async update(id: number, data: Update<"matches">) {
      return db.from("matches").update(data).eq("id", id);
    },
  };
}
