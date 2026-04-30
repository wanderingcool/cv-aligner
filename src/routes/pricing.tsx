import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, isOpen, checkoutElement, closeCheckout } = useStripeCheckout();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => { if (pending) setPending(null); }, [isOpen]);

  const buy = (priceId: string) => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    setPending(priceId);
    openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Positioned</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to app</Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-14 pb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">Choose your plan</h1>
        <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
          Land the role faster. Pick the option that matches how actively you're applying.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-5">
        <PlanCard
          name="Free"
          price="$0"
          tagline="Try it out"
          features={["3 optimizations / month", "Watermarked exports", "All templates"]}
          cta={<Button variant="outline" className="w-full" onClick={() => navigate({ to: "/" })}>Use free</Button>}
        />

        <PlanCard
          name="Active Hunter"
          price="$19"
          period="/month"
          tagline="Best value"
          highlight
          features={[
            "Unlimited CV optimizations",
            "No watermarks",
            "Tailored cover letters",
            "Format inspiration & all templates",
            "Priority processing",
          ]}
          cta={
            <Button className="w-full" onClick={() => buy("active_hunter_monthly")} disabled={pending === "active_hunter_monthly"}>
              {pending === "active_hunter_monthly" ? "Loading…" : "Subscribe"}
            </Button>
          }
        />

        <PlanCard
          name="Passive Leap"
          price="$4.99"
          tagline="One-time"
          features={["1 high-powered optimization", "No watermark", "All templates", "Format inspiration"]}
          cta={
            <Button variant="outline" className="w-full" onClick={() => buy("passive_leap_one")} disabled={pending === "passive_leap_one"}>
              {pending === "passive_leap_one" ? "Loading…" : "Buy once"}
            </Button>
          }
        />
      </section>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur p-4 overflow-y-auto">
          <div className="mx-auto max-w-3xl mt-8">
            <div className="flex justify-end mb-2">
              <button className="text-sm text-muted-foreground hover:text-foreground" onClick={closeCheckout}>
                Close
              </button>
            </div>
            <div className="rounded-xl bg-card p-2 border border-border">{checkoutElement}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  name, price, period, tagline, features, cta, highlight,
}: {
  name: string; price: string; period?: string; tagline: string;
  features: string[]; cta: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border ${highlight ? "border-primary shadow-lg ring-1 ring-primary/30" : "border-border"} bg-card p-6 flex flex-col`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        {highlight && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Best value</span>}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{tagline}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        {period && <span className="text-sm text-muted-foreground">{period}</span>}
      </div>
      <ul className="mt-5 space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">{cta}</div>
    </div>
  );
}