export default function LeaderboardLoading() {
  return (
    <div className="container max-w-4xl py-8 animate-pulse">
      <div className="mb-8">
        <div className="mb-3 h-4 w-24 rounded bg-muted" />
        <div className="h-9 w-64 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-80 rounded bg-muted" />
      </div>

      {/* Podio */}
      <div className="mb-8 flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-4">
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-muted" />
            <div className="mx-auto h-4 w-20 rounded bg-muted" />
            <div className="mx-auto mt-2 h-6 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border/50 bg-card">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/40 px-5 py-3.5 last:border-0">
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="mt-1 h-3 w-20 rounded bg-muted" />
            </div>
            <div className="h-6 w-14 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
