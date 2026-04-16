export default function DashboardLoading() {
  return (
    <div className="container max-w-6xl py-8 animate-pulse">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="h-8 w-48 rounded-md bg-muted" />
          <div className="mt-2 h-4 w-32 rounded bg-muted" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-5">
            <div className="mb-2 h-3 w-20 rounded bg-muted" />
            <div className="h-8 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-6">
            <div className="mb-4 h-5 w-40 rounded bg-muted" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 rounded-md bg-muted/60" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
