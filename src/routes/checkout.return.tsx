import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Payment received</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session_id ? "Your account is being upgraded — this usually takes a few seconds." : "No session info found."}
        </p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Go to app
        </Link>
      </div>
    </div>
  );
}