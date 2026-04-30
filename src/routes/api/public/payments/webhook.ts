import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: SupabaseClient<Database> | null = null;
function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  // Mirror to profiles for fast tier lookups
  if (priceId === "active_hunter_monthly") {
    const isActive = ["active", "trialing"].includes(subscription.status);
    await getSupabase()
      .from("profiles")
      .update({
        subscription_tier: isActive ? "active_hunter" : "free",
        active_hunter_until: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        stripe_customer_id: subscription.customer,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  if (userId) {
    await getSupabase()
      .from("profiles")
      .update({ subscription_tier: "free", updated_at: new Date().toISOString() })
      .eq("id", userId);
  }
}

async function handleCheckoutCompleted(session: any) {
  // For one-time purchases (passive_leap), grant a credit.
  if (session.mode !== "payment") return;
  const userId = session.metadata?.userId;
  const priceId = session.metadata?.priceId;
  if (!userId || priceId !== "passive_leap_one") return;

  const sb = getSupabase();
  const { data: profile } = await sb
    .from("profiles")
    .select("passive_leap_credits")
    .eq("id", userId)
    .maybeSingle();
  const current = profile?.passive_leap_credits ?? 0;
  await sb
    .from("profiles")
    .update({
      passive_leap_credits: current + 1,
      stripe_customer_id: session.customer ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  // Idempotency
  const eventId = (event as any).id as string | undefined;
  if (eventId) {
    const { error } = await getSupabase()
      .from("stripe_events")
      .insert({ event_id: eventId, type: event.type, payload: event as any });
    if (error && (error as any).code === "23505") {
      // duplicate -> already processed
      return;
    }
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});