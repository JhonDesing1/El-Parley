"use client";

import { useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";

type Webhook = Database["public"]["Tables"]["user_webhooks"]["Row"];

const AVAILABLE_EVENTS = ["value_bet", "parlay", "result"] as const;

export function WebhooksClient({
  userId,
  initialWebhooks,
}: {
  userId: string;
  initialWebhooks: Webhook[];
}) {
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["value_bet"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!newUrl.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/webhooks/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim(), events: newEvents }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error al crear el webhook.");
        return;
      }
      const { webhook } = await res.json();
      setWebhooks((prev) => [webhook, ...prev]);
      setNewUrl("");
      setNewEvents(["value_bet"]);
      setAdding(false);
    } catch {
      setError("Error de red al crear el webhook.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/webhooks/user?id=${id}`, { method: "DELETE" });
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch("/api/webhooks/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !isActive }),
    });
    setWebhooks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, is_active: !isActive } : w)),
    );
  }

  async function copySecret(secret: string) {
    await navigator.clipboard.writeText(secret);
  }

  return (
    <div className="space-y-4">
      {webhooks.length === 0 && !adding ? (
        <div className="rounded-xl border border-border/50 bg-muted/20 py-10 text-center">
          <p className="text-sm text-muted-foreground">No tienes webhooks configurados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <Card key={w.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{w.url}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {w.events.map((e) => (
                      <span
                        key={e}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <button
                      onClick={() => copySecret(w.secret)}
                      className="flex items-center gap-1 hover:text-foreground"
                      title="Copiar secreto"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar secreto
                    </button>
                    {w.failure_count > 0 && (
                      <span className="text-red-400">{w.failure_count} fallos</span>
                    )}
                    {w.last_triggered_at && (
                      <span>
                        Último: {new Date(w.last_triggered_at).toLocaleDateString("es-CO")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={w.is_active ? "default" : "outline"}
                    className={w.is_active ? "bg-emerald-500/15 text-emerald-400" : ""}
                  >
                    {w.is_active ? "Activo" : "Pausado"}
                  </Badge>
                  <button
                    onClick={() => handleToggle(w.id, w.is_active)}
                    className="text-muted-foreground hover:text-foreground"
                    title={w.is_active ? "Pausar" : "Activar"}
                  >
                    {w.is_active ? (
                      <ToggleRight className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="text-muted-foreground hover:text-red-400"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {adding ? (
        <Card className="p-4">
          <div className="space-y-3">
            <input
              type="url"
              placeholder="https://tu-servidor.com/hook"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm focus:border-amber-500/50 focus:outline-none"
            />
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Eventos</p>
              <div className="flex gap-2">
                {AVAILABLE_EVENTS.map((evt) => (
                  <label key={evt} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={newEvents.includes(evt)}
                      onChange={(e) =>
                        setNewEvents((prev) =>
                          e.target.checked ? [...prev, evt] : prev.filter((x) => x !== evt),
                        )
                      }
                      className="accent-amber-400"
                    />
                    <span className="font-mono text-xs">{evt}</span>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={saving || !newUrl.trim() || newEvents.length === 0}
                className="gap-2"
              >
                {saving ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4" />
          Agregar webhook
        </Button>
      )}
    </div>
  );
}
