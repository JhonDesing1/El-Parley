import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/utils/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Webhook } from "lucide-react";
import { WebhooksClient } from "./webhooks-client";

export const metadata = { title: "Webhooks — El Parley Pro" };

export default async function WebhooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/webhooks");

  const pro = await isProUser();
  if (!pro) redirect("/premium");

  const { data: webhooks } = await supabase
    .from("user_webhooks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Webhook className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Webhooks personalizados</h1>
          <p className="text-sm text-muted-foreground">
            Envía eventos de value bets a tus propios endpoints
          </p>
        </div>
        <Badge className="ml-auto border-amber-500/50 bg-amber-500/10 text-amber-400">PRO</Badge>
      </div>

      <WebhooksClient userId={user.id} initialWebhooks={webhooks ?? []} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Formato del payload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cada evento se envía como <code className="font-mono text-xs">POST</code> con{" "}
            <code className="font-mono text-xs">Content-Type: application/json</code>.
            La firma HMAC-SHA256 va en el header{" "}
            <code className="font-mono text-xs">X-El Parley-Signature</code>.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted/50 px-4 py-3 font-mono text-xs">
{`{
  "event": "value_bet",
  "data": {
    "id": 123,
    "market": "1x2",
    "selection": "home",
    "price": 2.15,
    "edge": 0.08,
    "confidence": "high",
    "bookmaker": "betplay",
    "match": {
      "home": "Millonarios",
      "away": "América",
      "kickoff": "2026-04-15T20:00:00Z"
    }
  },
  "timestamp": "2026-04-15T18:00:00Z"
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
