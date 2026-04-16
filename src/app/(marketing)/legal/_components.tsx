/**
 * Shared layout helpers for legal pages.
 * Import from here instead of duplicating in each page.
 */

export function LegalPage({
  title,
  icon,
  updated,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container max-w-3xl py-12">
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2 text-primary">
          {icon}
          <span className="text-sm font-bold uppercase tracking-widest">Legal</span>
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última actualización: {updated}
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold text-foreground">{title}</h2>
      <div className="space-y-3 [&_p]:text-muted-foreground [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
