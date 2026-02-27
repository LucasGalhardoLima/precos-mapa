import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const processedEvents = new Set<string>();

function mapPriceToB2bPlan(priceId: string): string {
  const priceMap: Record<string, string> = {
    [process.env.STRIPE_PREMIUM_PRICE_ID ?? ""]: "premium",
    [process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID ?? ""]: "premium",
    [process.env.STRIPE_PREMIUM_PLUS_PRICE_ID ?? ""]: "premium_plus",
    [process.env.STRIPE_PREMIUM_PLUS_ANNUAL_PRICE_ID ?? ""]: "premium_plus",
    [process.env.STRIPE_ENTERPRISE_PRICE_ID ?? ""]: "enterprise",
  };
  return priceMap[priceId] ?? "premium";
}

async function handleCheckoutCompleted(
  session: Record<string, unknown>,
): Promise<void> {
  const storeId = (session.metadata as Record<string, string>)?.store_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!storeId) return;

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

  if (processedEvents.has(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  processedEvents.add(event.id);

  // Limit set size to prevent memory leak
  if (processedEvents.size > 10000) {
    const entries = [...processedEvents];
    entries.slice(0, 5000).forEach((id) => processedEvents.delete(id));
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
