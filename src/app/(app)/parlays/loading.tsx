export default function ParlaysLoading() {
  return (
    <div className="container max-w-5xl py-8 animate-pulse">
      <div className="mb-6 h-8 w-40 rounded-md bg-muted" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-md bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-5">
            <div className="mb-3 h-5 w-48 rounded bg-muted" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-4 w-full rounded bg-muted/60" />
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
