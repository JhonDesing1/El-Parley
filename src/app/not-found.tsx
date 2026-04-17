import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
        <SearchX className="h-7 w-7 text-amber-400" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-bold">404</h1>
        <p className="text-lg font-medium">Página no encontrada</p>
        <p className="text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
