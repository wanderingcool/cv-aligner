import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Copy, Download, Check, Wand2, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { optimizeCv } from "@/server/optimize-cv.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const canSubmit = cv.trim().length >= 50 && jd.trim().length >= 50 && !loading;

  const handleOptimize = async () => {
    if (!canSubmit) {
      toast.error("Please paste both your CV and the job description (50+ characters each).");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const res = await optimizeCv({ data: { cv, jobDescription: jd } });
      setResult(res.markdown);
      toast.success("Optimized CV ready.");
      setTimeout(() => {
        document.getElementById("output")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportPdf = () => {
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) {
      toast.error("Please allow popups to export PDF.");
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Optimized CV</title>
      <style>
        @page { margin: 0.6in; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; max-width: 780px; margin: 0 auto; padding: 24px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #334155; margin: 22px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        h3 { font-size: 13px; margin: 14px 0 4px; }
        p, li { font-size: 12.5px; }
        ul { padding-left: 18px; margin: 6px 0; }
      </style></head><body><pre style="white-space:pre-wrap;font-family:inherit;font-size:12.5px">${escapeHtml(result)}</pre>
      <script>window.onload = () => { window.print(); };</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Positioned</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">AI-aligned CVs for the role you actually want</span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground mb-5">
          <Zap className="h-3 w-3" /> 10-second AI alignment
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
          Stop applying. Start aligning.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Generate a job-winning, customized CV in 10 seconds — engineered to match the exact role you're targeting.
        </p>
      </section>

      {/* Input */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel
            label="Your CV"
            hint="Paste your current, generic CV here."
            value={cv}
            onChange={setCv}
            placeholder="Paste your full CV — work history, education, skills..."
          />
          <Panel
            label="Job Description"
            hint="Paste the exact job description you're targeting."
            value={jd}
            onChange={setJd}
            placeholder="Paste the full JD: responsibilities, requirements, company context..."
          />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Your text is sent securely and used only to generate your CV.
          </div>
          <Button
            size="lg"
            onClick={handleOptimize}
            disabled={!canSubmit}
            className="min-w-[260px] h-12 text-base font-medium shadow-sm"
          >
            {loading ? (
              <>
                <span className="mr-2 inline-block h-3 w-3 rounded-full bg-primary-foreground/80 animate-pulse" />
                Conducting Consumer Value Analysis…
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Optimize my CV
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Output */}
      <section id="output" className="mx-auto max-w-4xl px-6 pb-24">
        {result ? (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/50">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm font-medium">Aligned CV</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" onClick={handleExportPdf}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Export PDF
                </Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground p-6 max-h-[70vh] overflow-auto">
              {result}
            </pre>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-10 text-center text-sm text-muted-foreground">
            Your aligned CV will appear here.
          </div>
        )}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Positioned
      </footer>
    </div>
  );
}

function Panel({
  label, hint, value, onChange, placeholder,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[340px] rounded-none border-0 focus-visible:ring-0 resize-none font-mono text-[13px] leading-relaxed"
      />
      <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex justify-between">
        <span>{value.trim().length} chars</span>
        <span>{value.trim().length >= 50 ? "Ready" : "Min 50 characters"}</span>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
