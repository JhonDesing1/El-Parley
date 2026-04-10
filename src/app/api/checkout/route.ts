import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-09-30.acacia" as Stripe.LatestApiVersion,
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?redirect=/premium", req.url));
  }

  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan") ?? "premium";
  const priceId =
    plan === "yearly"
      ? process.env.STRIPE_PRICE_ID_YEARLY!
      : process.env.STRIPE_PRICE_ID_MONTHLY!;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?welcome=premium`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/premium`,
    allow_promotion_codes: true,
  });

  return NextResponse.redirect(session.url!, 303);
}
