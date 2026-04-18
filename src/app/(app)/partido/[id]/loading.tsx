export default function PartidoLoading() {
  return (
    <div className="container max-w-4xl py-8 animate-pulse">
      {/* Back link */}
      <div className="mb-6 h-4 w-16 rounded bg-muted" />

      {/* Header partido */}
      <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
        <div className="mb-4 h-4 w-32 rounded bg-muted" />
        <div className="grid grid-cols-3 items-center gap-4">
          {/* Equipo local */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          {/* Marcador / hora */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-24 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
          {/* Equipo visitante */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
        </div>
        {/* xG / probabilidades */}
        <div className="mt-4 border-t border-border/40 pt-4">
          <div className="mx-auto mb-2 h-3 w-40 rounded bg-muted" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>

      {/* Value bets */}
      <div className="mb-8">
        <div className="mb-4 h-6 w-48 rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-4">
              <div className="mb-2 flex justify-between">
                <div className="space-y-1">
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-5 w-28 rounded bg-muted" />
                </div>
                <div className="h-8 w-14 rounded bg-muted" />
              </div>
              <div className="mb-3 flex gap-3">
                <div className="h-3 w-16 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
              <div className="h-8 w-full rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Comparador cuotas */}
      <div>
        <div className="mb-4 h-6 w-52 rounded bg-muted" />
        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="h-10 bg-muted/30" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/30 px-4 py-3 last:border-0">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="flex flex-1 justify-around">
                <div className="h-5 w-12 rounded bg-muted" />
                <div className="h-5 w-12 rounded bg-muted" />
                <div className="h-5 w-12 rounded bg-muted" />
              </div>
              <div className="h-7 w-20 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
