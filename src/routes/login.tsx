import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Sparkles, Zap, ShieldCheck, TrendingUp, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setInfoMsg("Account created. Check your inbox to confirm your email before signing in.");
          setMode("signin");
          return;
        }
        toast.success("Account created.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = /invalid login credentials/i.test(error.message)
            ? "Incorrect email or password. If you don't have an account yet, click \"Sign up\" below."
            : error.message;
          throw new Error(msg);
        }
      }
      navigate({ to: "/" });
    } catch (err: any) {
      const msg = err?.message ?? "Authentication failed.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result?.error) {
        const msg = result.error.message || "Google sign-in could not start. Please try again.";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      if (!result?.redirected) navigate({ to: "/" });
    } catch (e: any) {
      const msg = e?.message ?? "Google sign-in failed.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <Toaster richColors position="top-center" />

      {/* Left branding panel — hidden on mobile */}
      <div
        className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 overflow-hidden"
        style={{ background: "linear-gradient(145deg, oklch(0.20 0.10 268) 0%, oklch(0.28 0.18 280) 55%, oklch(0.21 0.12 268) 100%)" }}
      >
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 90% 65% at 45% 25%, oklch(0.58 0.22 278 / 0.22) 0%, transparent 65%)" }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Blurred accent circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "oklch(0.62 0.24 285)" }} />
        <div className="absolute bottom-10 -left-10 w-56 h-56 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "oklch(0.55 0.22 265)" }} />

        {/* Logo mark */}
        <div className="relative flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 270), oklch(0.52 0.28 288))" }}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Positioned</span>
          <span
            className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: "oklch(1 0 0 / 0.1)", color: "oklch(0.80 0.12 278)", border: "1px solid oklch(1 0 0 / 0.15)" }}
          >
            Beta
          </span>
        </div>

        {/* Main copy */}
        <div className="relative space-y-10">
          <div>
            <h2 className="text-5xl font-extrabold leading-[1.1] tracking-tight" style={{ color: "oklch(0.98 0.005 270)" }}>
              Land the role.<br />
              <span style={{ color: "oklch(0.80 0.16 278)" }}>Not just any role.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed" style={{ color: "oklch(0.72 0.05 270)" }}>
              AI-powered CV alignment that speaks the recruiter's language — every application, every time.
            </p>
          </div>

          <div className="space-y-5">
            {[
              { icon: Zap, label: "AI-aligned in 10 seconds", desc: "From paste to polished in one click" },
              { icon: ShieldCheck, label: "ATS-proof formatting", desc: "Four templates built for parsers" },
              { icon: TrendingUp, label: "Keyword gap analysis", desc: "See exactly what's missing and why" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "oklch(1 0 0 / 0.07)", border: "1px solid oklch(1 0 0 / 0.10)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "oklch(0.80 0.16 278)" }} />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "oklch(0.95 0.005 270)" }}>{label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "oklch(0.60 0.04 270)" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer tagline */}
        <div className="relative">
          <p className="text-xs italic" style={{ color: "oklch(0.48 0.04 270)" }}>
            "Stop applying. Start aligning."
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Mobile-only header */}
        <header className="lg:hidden border-b border-border px-6 h-14 flex items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Positioned</span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-[360px] space-y-7">
            {/* Heading */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {mode === "signin" ? "Sign in to continue aligning your CV." : "Start aligning CVs in seconds."}
              </p>
            </div>

            {/* Google button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-3 font-medium"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              {googleLoading ? "Opening Google…" : "Continue with Google"}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or continue with email
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Form */}
            <form onSubmit={handleEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="login-email">Email</label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="login-password">Password</label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
              </div>

              {errorMsg && (
                <div className="rounded-lg border-l-4 border-destructive bg-destructive/8 px-4 py-3 text-xs text-destructive leading-relaxed">
                  {errorMsg}
                </div>
              )}
              {infoMsg && (
                <div className="rounded-lg border-l-4 border-primary bg-primary/8 px-4 py-3 text-xs leading-relaxed">
                  {infoMsg}
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-semibold gap-2 shadow-md" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Please wait…
                  </span>
                ) : (
                  <>
                    {mode === "signin" ? "Sign in" : "Create account"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle mode */}
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErrorMsg(null); setInfoMsg(null); }}
                className="font-semibold text-primary hover:underline underline-offset-4 transition-colors"
              >
                {mode === "signin" ? "Sign up free" : "Sign in"}
              </button>
            </p>
          </div>
        </main>

        <footer className="px-6 py-4 text-center text-xs text-muted-foreground border-t border-border">
          Your data is processed securely and never stored beyond your session.
        </footer>
      </div>
    </div>
  );
}
