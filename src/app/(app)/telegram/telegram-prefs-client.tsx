"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

type Prefs = { value_bets: boolean; results: boolean; parlays: boolean };

const LABELS: { key: keyof Prefs; title: string; description: string }[] = [
  {
    key: "value_bets",
    title: "Value bets nuevas",
    description: "Cuando el sistema detecta una oportunidad de valor.",
  },
  {
    key: "results",
    title: "Resultados",
    description: "Cuando una value bet que seguiste se resuelve.",
  },
  {
    key: "parlays",
    title: "Parlays del día",
    description: "Cuando se genera la combinada diaria para suscriptores Pro.",
  },
];

export function TelegramPrefsClient({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    setError(null);

    try {
      const res = await fetch("/api/telegram/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setPrefs(prefs);
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {LABELS.map(({ key, title, description }) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Switch
            checked={prefs[key]}
            disabled={saving !== null}
            onCheckedChange={() => toggle(key)}
          />
        </div>
      ))}

      <p className="text-xs text-muted-foreground pt-1">
        Horario silencioso activo: 10 pm – 7 am (hora Colombia). No recibirás alertas en ese rango.
      </p>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
