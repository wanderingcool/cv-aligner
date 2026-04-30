import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Positioned</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Sign in to align your CV." : "Start aligning CVs in seconds."}
          </p>

          <Button type="button" variant="outline" className="w-full mt-6" onClick={handleGoogle}>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </main>
    </div>
  );
}