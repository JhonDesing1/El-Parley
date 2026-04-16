"use client";

import { useState, useEffect } from "react";
import { Copy, RefreshCw, Eye, EyeOff, Code2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ApiKeyPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/api-key")
      .then((r) => r.json())
      .then((d) => setApiKey(d.apiKey))
      .catch(() => setError("No se pudo cargar la API key."))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/api-key", { method: "POST" });
      if (res.status === 403) {
        setError("Requiere suscripción Pro activa.");
        return;
      }
      const data = await res.json();
      setApiKey(data.apiKey);
      setVisible(true);
    } catch {
      setError("Error al generar la API key.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const maskedKey = apiKey
    ? `${apiKey.slice(0, 12)}${"•".repeat(24)}${apiKey.slice(-6)}`
    : null;

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Code2 className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">API REST personal</h1>
          <p className="text-sm text-muted-foreground">
            Accede a tus value bets desde cualquier app o script
          </p>
        </div>
        <Badge className="ml-auto border-amber-500/50 bg-amber-500/10 text-amber-400">PRO</Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Tu API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="h-10 animate-pulse rounded-md bg-muted" />
          ) : apiKey ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 font-mono text-sm">
              <span className="flex-1 truncate">
                {visible ? apiKey : maskedKey}
              </span>
              <button
                onClick={() => setVisible((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={visible ? "Ocultar key" : "Mostrar key"}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Copiar"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tienes una API key generada todavía.
            </p>
          )}

          {copied && (
            <p className="text-xs text-emerald-400">API key copiada al portapapeles.</p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {apiKey ? "Rotar API key" : "Generar API key"}
          </Button>

          {apiKey && (
            <p className="text-xs text-muted-foreground">
              Al rotar la key, la anterior queda inmediatamente invalidada.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso de la API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Autenticación</p>
            <pre className="overflow-x-auto rounded-md bg-muted/50 px-4 py-3 font-mono text-xs">
              {`Authorization: Bearer <tu_api_key>`}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Obtener value bets recientes</p>
            <pre className="overflow-x-auto rounded-md bg-muted/50 px-4 py-3 font-mono text-xs">
              {`GET /api/v1/value-bets?limit=20&result=pending`}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Ejemplo con curl</p>
            <pre className="overflow-x-auto rounded-md bg-muted/50 px-4 py-3 font-mono text-xs">
              {`curl https://elparley.com/api/v1/value-bets \\
  -H "Authorization: Bearer <tu_api_key>" \\
  -G --data-urlencode "limit=10" \\
  --data-urlencode "result=pending"`}
            </pre>
          </div>

          <div className="rounded-md border border-border/50 bg-muted/20 px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">Parámetros disponibles</p>
            <ul className="mt-2 space-y-1">
              <li className="font-mono text-xs">
                <span className="text-amber-400">limit</span>
                <span className="text-muted-foreground"> — número de resultados (máx. 100)</span>
              </li>
              <li className="font-mono text-xs">
                <span className="text-amber-400">result</span>
                <span className="text-muted-foreground"> — pending | won | lost</span>
              </li>
              <li className="font-mono text-xs">
                <span className="text-amber-400">market</span>
                <span className="text-muted-foreground"> — 1x2 | btts | over_under_2_5 | …</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
