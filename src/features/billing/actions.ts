"use server";

import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase-server";
import { checkoutSchema } from "@/lib/schemas";

export async function createCheckoutSession(
  priceId: string,
  storeId: string,
): Promise<void> {
  const result = checkoutSchema.safeParse({ priceId, storeId });
  if (!result.success) {
    throw new Error(result.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("stripe_customer_id, name")
    .eq("id", storeId)
    .single();

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { store_id: storeId },
    },
    metadata: { store_id: storeId },
    ...(store?.stripe_customer_id
      ? { customer: store.stripe_customer_id }
      : {}),
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano?canceled=true`,
  });

  if (session.url) {
    redirect(session.url);
  }
}

export async function createCheckoutWithLaunchOffer(
  priceId: string,
  storeId: string,
  couponId: string,
): Promise<void> {
  const result = checkoutSchema.safeParse({ priceId, storeId });
  if (!result.success) {
    throw new Error(result.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("stripe_customer_id")
    .eq("id", storeId)
    .single();

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    discounts: [{ coupon: couponId }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { store_id: storeId },
    },
    metadata: { store_id: storeId },
    ...(store?.stripe_customer_id
      ? { customer: store.stripe_customer_id }
      : {}),
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano?canceled=true`,
  });

  if (session.url) {
    redirect(session.url);
  }
}

export async function redirectToPortal(
  stripeCustomerId: string,
): Promise<void> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano`,
  });

  redirect(session.url);
}
