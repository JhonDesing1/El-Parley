import { MercadoPagoConfig, Preference } from "mercadopago";

export type MPPlan = "monthly" | "yearly";

export interface MPPlanConfig {
  referencePrefix: string;
  amount: number; // COP
  description: string;
}

export const MP_PLANS: Record<MPPlan, MPPlanConfig> = {
  monthly: {
    referencePrefix: "EP-M",
    amount: 5000,
    description: "El Parley Premium — Mensual",
  },
  yearly: {
    referencePrefix: "EP-Y",
    amount: Math.round(5000 * 12 * 0.8),
    description: "El Parley Premium — Anual",
  },
};

export function getMPClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  return new MercadoPagoConfig({ accessToken });
}

export async function createMPPreference({
  plan,
  userId,
  userEmail,
  referenceCode,
}: {
  plan: MPPlan;
  userId: string;
  userEmail: string;
  referenceCode: string;
}) {
  const client = getMPClient();
  const preference = new Preference(client);
  const planConfig = MP_PLANS[plan];
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elparley.com";
  // MP exige HTTPS en back_urls — forzamos https aunque la env var use http
  const siteUrl = rawSiteUrl.replace(/^http:\/\//, "https://").replace(/\/$/, "");

  const response = await preference.create({
    body: {
      items: [
        {
          id: referenceCode,
          title: planConfig.description,
          quantity: 1,
          unit_price: planConfig.amount,
          currency_id: "COP",
        },
      ],
      payer: { email: userEmail },
      external_reference: referenceCode,
      metadata: { user_id: userId, plan },
      back_urls: {
        success: `${siteUrl}/dashboard?welcome=premium`,
        failure: `${siteUrl}/premium?payment=declined`,
        pending: `${siteUrl}/dashboard?welcome=premium&pending=true`,
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/webhooks/mp`,
    },
  });

  return response;
}
