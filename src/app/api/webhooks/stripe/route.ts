import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const uuidSchema = z.string().uuid();

function mapPriceToB2bPlan(priceId: string): string {
  const priceMap: Record<string, string> = {
    [process.env.STRIPE_PREMIUM_PRICE_ID ?? ""]: "premium",
    [process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID ?? ""]: "premium",
    [process.env.STRIPE_PREMIUM_PLUS_PRICE_ID ?? ""]: "premium_plus",
    [process.env.STRIPE_PREMIUM_PLUS_ANNUAL_PRICE_ID ?? ""]: "premium_plus",
    [process.env.STRIPE_ENTERPRISE_PRICE_ID ?? ""]: "enterprise",
  };
  const plan = priceMap[priceId];
  if (!plan) {
    console.error("Unknown Stripe price ID, defaulting to free:", priceId);
    return "free";
  }
  return plan;
}

async function handleCheckoutCompleted(
  session: Record<string, unknown>,
): Promise<void> {
  const storeId = (session.metadata as Record<string, string>)?.store_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!storeId || !uuidSchema.safeParse(storeId).success) {
    if (storeId) console.error("Invalid store_id in webhook metadata:", storeId);
    return;
  }

  // Verify store ownership: if store already has a stripe_customer_id, it must match
  const { data: store } = await getSupabaseAdmin()
    .from("stores")
    .select("stripe_customer_id")
    .eq("id", storeId)
    .single();

  if (!store) {
    console.error("Webhook: store not found for id:", storeId);
    return;
  }

  if (store.stripe_customer_id && store.stripe_customer_id !== customerId) {
    console.error(
      "Webhook ownership mismatch: store",
      storeId,
      "has customer",
      store.stripe_customer_id,
      "but webhook sent customer",
      customerId,
    );
    return;
  }

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const plan = mapPriceToB2bPlan(priceId);
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  await getSupabaseAdmin()
    .from("stores")
    .update({
      b2b_plan: plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      trial_ends_at: trialEnd,
    })
    .eq("id", storeId);
}

async function handleSubscriptionUpdated(
  subscription: Record<string, unknown>,
): Promise<void> {
  const subId = subscription.id as string;
  const items = subscription.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const priceId = items?.data?.[0]?.price?.id ?? "";
  const plan = mapPriceToB2bPlan(priceId);
  const trialEnd = subscription.trial_end
    ? new Date((subscription.trial_end as number) * 1000).toISOString()
    : null;

  await getSupabaseAdmin()
    .from("stores")
    .update({
      b2b_plan: plan,
      trial_ends_at: trialEnd,
    })
    .eq("stripe_subscription_id", subId);
}

async function handleSubscriptionDeleted(
  subscription: Record<string, unknown>,
): Promise<void> {
  const subId = subscription.id as string;

  await getSupabaseAdmin()
    .from("stores")
    .update({
      b2b_plan: "free",
      stripe_subscription_id: null,
      trial_ends_at: null,
    })
    .eq("stripe_subscription_id", subId);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Database-backed idempotency check
  const { error: dedupError } = await getSupabaseAdmin()
    .from("webhook_events")
    .insert({ stripe_event_id: event.id });

  if (dedupError) {
    // Unique constraint violation = duplicate event
    if (dedupError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Webhook dedup insert error:", dedupError);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as unknown as Record<string, unknown>,
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as unknown as Record<string, unknown>,
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as unknown as Record<string, unknown>,
        );
        break;
      case "invoice.payment_succeeded":
        // Log for record keeping — no store update needed
        break;
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
