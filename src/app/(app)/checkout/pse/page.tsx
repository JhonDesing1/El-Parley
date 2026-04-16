import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPSEBanks } from "@/lib/pse/client";
import { PAYU_PLANS } from "@/lib/payu/client";
import { PSEForm } from "@/components/pse/pse-form";
import type { PSEBank } from "@/lib/pse/types";
import type { PayUPlan } from "@/lib/payu/types";

export const metadata = {
  title: "Pago PSE — El Parley",
  description: "Paga tu suscripción El Parley mediante débito bancario PSE.",
};

const PLAN_LABELS: Record<PayUPlan, string> = {
  monthly: "Premium — Mensual",
  yearly: "Premium — Anual",
  "pro-monthly": "Pro — Mensual",
  "pro-yearly": "Pro — Anual",
};

interface Props {
  searchParams: Promise<Record<string, string>>;
}

export default async function CheckoutPSEPage({ searchParams }: Props) {
  const params = await searchParams;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/checkout/pse?" + new URLSearchParams(params).toString());
  }

  // ── Validar plan ──────────────────────────────────────────────────────────
  const validPlans: PayUPlan[] = ["monthly", "yearly", "pro-monthly", "pro-yearly"];
  const plan = (params.plan ?? "monthly") as PayUPlan;

  if (!validPlans.includes(plan)) {
    redirect("/premium");
  }

  // ── Obtener bancos PSE ────────────────────────────────────────────────────
  let banks: PSEBank[] = [];
  try {
    banks = await getPSEBanks();
  } catch (err) {
    console.error("[checkout/pse] Error cargando bancos:", err);
    // Continúa con lista vacía — el form muestra mensaje de error
  }

  const planConfig = PAYU_PLANS[plan];
  const planLabel = PLAN_LABELS[plan];

  return (
    <div className="container max-w-lg py-10">
      {/* Volver */}
      <Link
        href="/premium"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a planes
      </Link>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Pago con PSE</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Débito bancario en línea · Colombia
          </p>
        </div>

        <PSEForm
          banks={banks}
          plan={plan}
          planLabel={planLabel}
          planAmount={parseInt(planConfig.amount).toLocaleString("es-CO")}
        />
      </div>

      {/* Seguridad */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Pago procesado de forma segura por PayU · Cifrado SSL</span>
      </div>
    </div>
  );
}
