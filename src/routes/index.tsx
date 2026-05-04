import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { redirect, useNavigate } from "@tanstack/react-router";
import {
  Sparkles, Copy, Download, Check, Wand2, ShieldCheck, Zap, LogOut,
  Upload, FileText, X, Image as ImageIcon, TrendingUp, AlertTriangle, Lightbulb, Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { optimizeCv } from "@/server/optimize-cv.functions";
import { renderCvHtml, TEMPLATE_DEFAULTS, type StyleSpec } from "@/lib/cv-renderer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: Index,
});

type UploadedFile = { name: string; mimeType: string; base64: string; size: number };
type Template = "classic" | "ats-clean" | "premium-executive" | "modern-minimal" | "inspiration";

const ACCEPT_DOC = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";
const ACCEPT_IMG = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cvText, setCvText] = useState("");
  const [cvFile, setCvFile] = useState<UploadedFile | null>(null);
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<UploadedFile | null>(null);
  const [template, setTemplate] = useState<Template>("classic");
  const [targetScore, setTargetScore] = useState<number>(90);
  const [inspiration, setInspiration] = useState<UploadedFile | null>(null);

  const [result, setResult] = useState<null | {
    matchScore: number; summary: string; strengths: string[];
    missingKeywords: string[]; improvements: string[]; markdown: string;
    styleSpec: StyleSpec | null; usedInspiration?: boolean;
    tier?: "free" | "passive_leap" | "active_hunter"; watermarked?: boolean;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoFit, setAutoFit] = useState(false);
  const autoFitPending = useRef(false);

  useEffect(() => { setAutoFit(false); }, [result?.markdown]);

  const cvHasContent = cvText.trim().length >= 30 || !!cvFile;
  const jdHasContent = jdText.trim().length >= 30 || !!jdFile;
  const canSubmit = cvHasContent && jdHasContent && !loading;

  const handleFile = async (
    file: File | undefined,
    setter: (f: UploadedFile | null) => void,
    accept: "doc" | "img",
  ) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error("File too large (max 10MB)."); return; }
    if (accept === "img" && !file.type.startsWith("image/")) { toast.error("Please upload an image."); return; }
    try {
      const base64 = await fileToBase64(file);
      setter({ name: file.name, mimeType: file.type || (accept === "doc" ? "application/octet-stream" : "image/png"), base64, size: file.size });
    } catch (e) {
      toast.error("Could not read file.");
    }
  };

  const handleOptimize = async () => {
    if (!canSubmit) { toast.error("Please provide both your CV and the job description."); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await optimizeCv({
        data: {
          cvText: cvText.trim() ? cvText : undefined,
          cvFile: cvFile ? { name: cvFile.name, mimeType: cvFile.mimeType, base64: cvFile.base64 } : undefined,
          jdText: jdText.trim() ? jdText : undefined,
          jdFile: jdFile ? { name: jdFile.name, mimeType: jdFile.mimeType, base64: jdFile.base64 } : undefined,
          template,
          targetScore,
          inspirationImage: inspiration ? { name: inspiration.name, mimeType: inspiration.mimeType, base64: inspiration.base64 } : undefined,
        },
      });
      setResult(res);
      toast.success("Aligned CV ready.");
      setTimeout(() => document.getElementById("output")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      let msg = "Something went wrong.";
      if (e instanceof Response) {
        try { msg = (await e.text()) || `Request failed (${e.status})`; }
        catch { msg = `Request failed (${e.status})`; }
      } else if (e?.message) {
        msg = e.message;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopied(false), 1800);
  };

  const effectiveStyle = (): StyleSpec => {
    const base = (result?.styleSpec && result.usedInspiration)
      ? result.styleSpec
      : (TEMPLATE_DEFAULTS[template] ?? TEMPLATE_DEFAULTS.classic);
    if (!autoFit) return base;
    return { ...base, density: "compact", sectionDivider: base.sectionDivider === "none" ? "uppercase-label" : base.sectionDivider };
  };

  const displayMarkdown = () => {
    if (!result) return "";
    return autoFit ? compactMarkdown(result.markdown) : result.markdown;
  };

  const buildStyledHtml = () =>
    result ? renderCvHtml(displayMarkdown(), effectiveStyle(), { titleHint: "Optimized CV", watermark: !!result.watermarked }) : "";

  const handleAutoFit = () => {
    autoFitPending.current = true;
    setAutoFit(true);
  };

  const handleMeasured = (overflow: boolean) => {
    if (!autoFitPending.current) return;
    autoFitPending.current = false;
    if (overflow) {
      toast.error("Your CV still exceeds one page. Please remove or shorten some content.");
    } else {
      toast.success("Your CV now fits one page.");
    }
  };

  const handleExportPdf = () => {
    if (!result) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) { toast.error("Please allow popups to export PDF."); return; }
    const html = buildStyledHtml() + `<script>window.onload = () => { setTimeout(() => window.print(), 150); };</script>`;
    w.document.write(html);
    w.document.close();
  };

  const handleDownloadHtml = () => {
    if (!result) return;
    const blob = new Blob([buildStyledHtml()], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "optimized-cv.html"; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success("HTML downloaded.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="border-b border-border bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.51 0.24 270), oklch(0.48 0.26 285))" }}
            >
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">Positioned</span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: "oklch(0.95 0.03 270)", color: "oklch(0.45 0.18 270)", border: "1px solid oklch(0.88 0.06 270)" }}
            >
              Beta
            </span>
          </div>
          <div className="flex items-center gap-2">
            {user?.email && (
              <span
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: "oklch(0.95 0.03 270)", color: "oklch(0.40 0.14 270)", border: "1px solid oklch(0.88 0.06 270)" }}
              >
                {user.email}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-14 pb-10 text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium mb-6"
          style={{ background: "oklch(0.95 0.03 270)", color: "oklch(0.45 0.18 270)", border: "1px solid oklch(0.88 0.06 270)" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "oklch(0.55 0.22 270)" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "oklch(0.51 0.24 270)" }} />
          </span>
          10-second AI alignment
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
          Stop applying.{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, oklch(0.51 0.24 270), oklch(0.55 0.28 295))" }}
          >
            Start aligning.
          </span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Generate a job-winning, customized CV in 10 seconds — engineered to match the exact role you're targeting.
        </p>
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-primary" />10s average</span>
          <span className="h-3 w-px bg-border" />
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-primary" />ATS-ready</span>
          <span className="h-3 w-px bg-border" />
          <span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-primary" />4 templates</span>
        </div>
      </section>

      {/* Input section */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputPanel
            label="Your CV"
            hint="Paste below or upload PDF or TXT. (Word: save as PDF first.)"
            value={cvText} onChange={setCvText}
            placeholder="Paste your full CV — work history, education, skills..."
            file={cvFile} onFile={(f) => handleFile(f, setCvFile, "doc")} onClearFile={() => setCvFile(null)}
            accept={ACCEPT_DOC}
          />
          <InputPanel
            label="Job Description"
            hint="Paste below or upload PDF or TXT. (Word: save as PDF first.)"
            value={jdText} onChange={setJdText}
            placeholder="Paste the full JD: responsibilities, requirements, company context..."
            file={jdFile} onFile={(f) => handleFile(f, setJdFile, "doc")} onClearFile={() => setJdFile(null)}
            accept={ACCEPT_DOC}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Output format card */}
          <div className="rounded-2xl border border-border bg-card p-5 ring-1 ring-border/40 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Output Format</div>
            <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic — clean professional</SelectItem>
                <SelectItem value="ats-clean">ATS Clean — recruiter-friendly one-page</SelectItem>
                <SelectItem value="premium-executive">Premium Executive — polished senior one-page</SelectItem>
                <SelectItem value="modern-minimal">Modern Minimal — clean modern one-page</SelectItem>
                <SelectItem value="inspiration">Inspiration Design — mirror your upload</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="font-medium text-foreground">Target match score</span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
                  style={{ background: "oklch(0.95 0.03 270)", color: "oklch(0.45 0.18 270)" }}
                >
                  {targetScore}%
                </span>
              </div>
              <Slider value={[targetScore]} min={80} max={100} step={1} onValueChange={(v) => setTargetScore(v[0] ?? 90)} />
              <div className="text-[11px] text-muted-foreground mt-2">Tune how aggressively we optimize toward the JD (80–100%).</div>
            </div>
          </div>

          <InspirationPanel file={inspiration} onFile={(f) => handleFile(f, setInspiration, "img")} onClear={() => setInspiration(null)} />
        </div>

        {/* CTA row */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary/60" />
            Your content is processed securely and only used to generate your CV.
          </div>
          <Button
            size="lg"
            onClick={handleOptimize}
            disabled={!canSubmit}
            className="min-w-[260px] h-13 text-base font-semibold shadow-lg gap-2.5 border-0"
            style={{
              background: canSubmit
                ? "linear-gradient(135deg, oklch(0.51 0.24 270), oklch(0.48 0.26 285))"
                : undefined,
            }}
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Conducting analysis…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Optimize my CV
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Output section */}
      <section id="output" className="mx-auto max-w-5xl px-6 pb-24">
        {result ? (
          <div className="space-y-4">
            <AnalysisCard result={result} />
            <A4Preview
              html={buildStyledHtml()}
              accent={effectiveStyle().accentColor}
              templateLabel={result.usedInspiration ? "Inspired by your screenshot" : labelForTemplate(template)}
              copied={copied}
              onCopy={handleCopy}
              onDownloadHtml={handleDownloadHtml}
              onExportPdf={handleExportPdf}
              onAutoFit={handleAutoFit}
              autoFit={autoFit}
              onMeasured={handleMeasured}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-6 py-14 text-center">
            <div
              className="mx-auto mb-4 h-12 w-12 rounded-2xl flex items-center justify-center"
              style={{ background: "oklch(0.95 0.03 270)" }}
            >
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Your aligned CV will appear here</p>
            <p className="text-xs text-muted-foreground mt-1">Paste your CV and job description above, then click "Optimize my CV"</p>
          </div>
        )}
      </section>

      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Positioned</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Engineered for job seekers who move fast.</p>
      </footer>
    </div>
  );
}

function labelForTemplate(t: Template) {
  return ({
    classic: "Classic",
    "ats-clean": "ATS Clean",
    "premium-executive": "Premium Executive",
    "modern-minimal": "Modern Minimal",
    inspiration: "Inspiration Design",
  } as const)[t];
}

function compactMarkdown(md: string): string {
  const LOW_PRIORITY = /^(interests|hobbies|references|volunteer|volunteering|awards|publications|languages)\b/i;
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let lastHeading: "h1" | "h2" | "h3" | null = null;
  let currentH2Skip = false;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      currentH2Skip = LOW_PRIORITY.test(title);
      if (!currentH2Skip) { out.push(line); lastHeading = "h2"; }
      i++; continue;
    }
    if (currentH2Skip) { i++; continue; }
    if (line.startsWith("# ")) { out.push(line); lastHeading = "h1"; i++; continue; }
    if (line.startsWith("### ")) { out.push(line); lastHeading = "h3"; i++; continue; }
    if (/^[-*]\s+/.test(line)) {
      const bullets: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { bullets.push(lines[i]); i++; }
      const cap = lastHeading === "h3" ? 4 : 6;
      out.push(...bullets.slice(0, cap));
      continue;
    }
    if (line.trim()) {
      const para: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s|>\s)/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      let text = para.join(" ").replace(/\s+/g, " ").trim();
      if (lastHeading === "h2" || lastHeading === "h1") {
        const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);
        if (sentences && sentences.length > 3) text = sentences.slice(0, 3).join("").trim();
      }
      out.push(text);
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

function A4Preview({
  html, accent, templateLabel, copied, onCopy, onDownloadHtml, onExportPdf,
  onAutoFit, autoFit, onMeasured,
}: {
  html: string; accent: string; templateLabel: string; copied: boolean;
  onCopy: () => void; onDownloadHtml: () => void; onExportPdf: () => void;
  onAutoFit: () => void; autoFit: boolean; onMeasured: (overflow: boolean) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const check = () => {
      const win = iframeRef.current?.contentWindow;
      const doc = iframeRef.current?.contentDocument;
      if (!win || !doc?.body) return;
      const pageHeightPx = 1122;
      const contentHeight = doc.body.scrollHeight;
      const isOver = contentHeight > pageHeightPx + 8;
      setOverflow(isOver);
      onMeasured(isOver);
    };
    const t = setTimeout(check, 250);
    return () => clearTimeout(t);
  }, [html, onMeasured]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-secondary/40">
        <div className="flex items-center gap-2.5">
          <div
            className="h-2.5 w-2.5 rounded-full ring-2"
            style={{ background: accent, ringColor: `${accent}40` }}
          />
          <span className="text-sm font-semibold">Aligned CV</span>
          <span className="text-xs text-muted-foreground ml-1">{templateLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={autoFit ? "default" : "outline"} size="sm" onClick={onAutoFit} disabled={autoFit} className="text-xs">
            <Minimize2 className="h-3.5 w-3.5 mr-1.5" />
            {autoFit ? "Auto-fitted" : "Auto-fit to one page"}
          </Button>
          <Button variant="outline" size="sm" onClick={onCopy} className="text-xs">
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={onDownloadHtml} className="text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />HTML
          </Button>
          <Button
            size="sm"
            onClick={onExportPdf}
            className="text-xs shadow-sm"
            style={{ background: "linear-gradient(135deg, oklch(0.51 0.24 270), oklch(0.48 0.26 285))" }}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />Export PDF
          </Button>
        </div>
      </div>

      {overflow && (
        <div className="px-5 py-2.5 border-b border-amber-400/30 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          Your CV is exceeding one page. Please shorten content or use a more compact format.
        </div>
      )}

      <div className="bg-secondary/30 p-6 flex justify-center">
        <div
          className="bg-white shadow-lg ring-1 ring-border/50 overflow-hidden"
          style={{ width: "min(100%, 794px)", aspectRatio: "210 / 297" }}
        >
          <iframe
            ref={iframeRef}
            title="CV preview"
            srcDoc={html}
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
}

function InputPanel({
  label, hint, value, onChange, placeholder, file, onFile, onClearFile, accept,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
  placeholder: string; file: UploadedFile | null;
  onFile: (f: File | undefined) => void; onClearFile: () => void; accept: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const isReady = value.trim().length >= 30 || !!file;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      <div
        className="px-4 py-3 border-b border-border flex items-start justify-between gap-3"
        style={{ background: "oklch(0.975 0.012 270)" }}
      >
        <div>
          <div className="text-sm font-semibold text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => ref.current?.click()}
          className="shrink-0 text-xs"
          style={{ borderColor: "oklch(0.88 0.06 270)", color: "oklch(0.45 0.18 270)" }}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />Upload
        </Button>
        <input ref={ref} type="file" accept={accept} className="hidden"
          onChange={(e) => { onFile(e.target.files?.[0]); if (ref.current) ref.current.value = ""; }} />
      </div>

      {file && (
        <div className="px-4 py-2 border-b border-border bg-primary/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="text-muted-foreground shrink-0">· {(file.size / 1024).toFixed(0)} KB</span>
          </div>
          <button onClick={onClearFile} className="text-muted-foreground hover:text-foreground ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={file ? "Optional: add extra context here…" : placeholder}
        className="min-h-[280px] rounded-none border-0 focus-visible:ring-0 resize-none font-mono text-sm leading-relaxed"
      />
      <div className="px-4 py-2 border-t border-border text-[11px] flex justify-between items-center bg-secondary/20">
        <span className="text-muted-foreground">{value.trim().length} chars{file ? " + file" : ""}</span>
        {isReady ? (
          <span className="flex items-center gap-1 font-medium text-emerald-600">
            <Check className="h-3 w-3" /> Ready
          </span>
        ) : (
          <span className="text-muted-foreground">Add text or upload a file</span>
        )}
      </div>
    </div>
  );
}

function InspirationPanel({ file, onFile, onClear }: {
  file: UploadedFile | null; onFile: (f: File | undefined) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 ring-1 ring-border/40 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Format Inspiration</div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Upload a screenshot of a CV layout you like — we'll mimic its structure.
          <span className="ml-1 text-xs">(optional)</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => ref.current?.click()}
          className="shrink-0 text-xs"
          style={{ borderColor: "oklch(0.88 0.06 270)", color: "oklch(0.45 0.18 270)" }}
        >
          <ImageIcon className="h-3.5 w-3.5 mr-1.5" />Upload
        </Button>
        <input ref={ref} type="file" accept={ACCEPT_IMG} className="hidden"
          onChange={(e) => { onFile(e.target.files?.[0]); if (ref.current) ref.current.value = ""; }} />
      </div>
      {file && (
        <div className="mt-3 flex items-center justify-between text-xs bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="text-muted-foreground shrink-0">· {(file.size / 1024).toFixed(0)} KB</span>
          </div>
          <button onClick={onClear} className="text-muted-foreground hover:text-foreground ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  const color = score >= 80 ? "oklch(0.59 0.18 155)" : score >= 60 ? "oklch(0.51 0.24 270)" : "oklch(0.72 0.18 60)";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="108" height="108" viewBox="0 0 108 108" className="-rotate-90">
        <circle cx="54" cy="54" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
        <circle
          cx="54" cy="54" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold leading-none" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

function AnalysisCard({ result }: {
  result: { matchScore: number; summary: string; strengths: string[]; missingKeywords: string[]; improvements: string[] };
}) {
  const score = Math.max(0, Math.min(100, Math.round(result.matchScore)));

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">

        {/* Score column */}
        <div className="p-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Match Score
          </div>
          <ScoreRing score={score} />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px]">{result.summary}</p>
        </div>

        {/* Keywords column */}
        <div className="p-6">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Missing Keywords
          </div>
          {result.missingKeywords.length === 0 ? (
            <p className="text-xs text-muted-foreground">No critical gaps detected.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {result.missingKeywords.map((k, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "oklch(0.97 0.04 70)", color: "oklch(0.52 0.16 60)", border: "1px solid oklch(0.88 0.08 65)" }}
                >
                  {k}
                </span>
              ))}
            </div>
          )}
          {result.strengths.length > 0 && (
            <div className="mt-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Strengths Aligned</div>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-xs flex gap-2 text-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Improvements column */}
        <div className="p-6">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Key Improvements
          </div>
          {result.improvements.length === 0 ? (
            <p className="text-xs text-muted-foreground">CV is already well aligned.</p>
          ) : (
            <ul className="space-y-3">
              {result.improvements.map((s, i) => (
                <li key={i} className="text-xs flex gap-2.5 text-foreground">
                  <span
                    className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "oklch(0.95 0.03 270)", color: "oklch(0.45 0.18 270)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
