import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Sparkles, Copy, Download, Check, Wand2, ShieldCheck, Zap,
  Upload, FileText, X, Image as ImageIcon, TrendingUp, AlertTriangle, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { optimizeCv } from "@/server/optimize-cv.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

type UploadedFile = { name: string; mimeType: string; base64: string; size: number };
type Template = "classic" | "modern" | "compact" | "executive";

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
  const [cvText, setCvText] = useState("");
  const [cvFile, setCvFile] = useState<UploadedFile | null>(null);
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<UploadedFile | null>(null);
  const [template, setTemplate] = useState<Template>("classic");
  const [inspiration, setInspiration] = useState<UploadedFile | null>(null);

  const [result, setResult] = useState<null | {
    matchScore: number; summary: string; strengths: string[];
    missingKeywords: string[]; improvements: string[]; markdown: string;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
          inspirationImage: inspiration ? { name: inspiration.name, mimeType: inspiration.mimeType, base64: inspiration.base64 } : undefined,
        },
      });
      setResult(res);
      toast.success("Aligned CV ready.");
      setTimeout(() => document.getElementById("output")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong.");
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

  const handleExportPdf = () => {
    if (!result) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) { toast.error("Please allow popups to export PDF."); return; }
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Optimized CV</title>
      <style>
        @page { margin: 0.6in; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; max-width: 780px; margin: 0 auto; padding: 24px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #334155; margin: 22px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        h3 { font-size: 13px; margin: 14px 0 4px; }
        p, li { font-size: 12.5px; }
        ul { padding-left: 18px; margin: 6px 0; }
      </style></head><body><pre style="white-space:pre-wrap;font-family:inherit;font-size:12.5px">${escapeHtml(result.markdown)}</pre>
      <script>window.onload = () => { window.print(); };</script></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
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

      <section className="mx-auto max-w-4xl px-6 pt-14 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground mb-5">
          <Zap className="h-3 w-3" /> 10-second AI alignment
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">Stop applying. Start aligning.</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Generate a job-winning, customized CV in 10 seconds — engineered to match the exact role you're targeting.
        </p>
      </section>

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
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-medium mb-1">Output format</div>
            <div className="text-xs text-muted-foreground mb-3">Choose a structure for your aligned CV.</div>
            <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic — clean professional</SelectItem>
                <SelectItem value="modern">Modern — minimalist with summary</SelectItem>
                <SelectItem value="compact">Compact — one-page tight</SelectItem>
                <SelectItem value="executive">Executive — scope & outcomes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <InspirationPanel file={inspiration} onFile={(f) => handleFile(f, setInspiration, "img")} onClear={() => setInspiration(null)} />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Your content is processed securely and only used to generate your CV.
          </div>
          <Button size="lg" onClick={handleOptimize} disabled={!canSubmit} className="min-w-[260px] h-12 text-base font-medium shadow-sm">
            {loading ? (
              <><span className="mr-2 inline-block h-3 w-3 rounded-full bg-primary-foreground/80 animate-pulse" />Conducting Consumer Value Analysis…</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" />Optimize my CV</>
            )}
          </Button>
        </div>
      </section>

      <section id="output" className="mx-auto max-w-5xl px-6 pb-24">
        {result ? (
          <div className="space-y-4">
            <AnalysisCard result={result} />
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium">Aligned CV</span>
                  <span className="text-xs text-muted-foreground ml-2">{labelForTemplate(template)}{inspiration ? " · format inspired by upload" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button size="sm" onClick={handleExportPdf}>
                    <Download className="h-4 w-4 mr-1.5" />Export PDF
                  </Button>
                </div>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground p-6 max-h-[70vh] overflow-auto">
                {result.markdown}
              </pre>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-10 text-center text-sm text-muted-foreground">
            Your aligned CV and match analysis will appear here.
          </div>
        )}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Positioned
      </footer>
    </div>
  );
}

function labelForTemplate(t: Template) {
  return ({ classic: "Classic", modern: "Modern", compact: "Compact", executive: "Executive" })[t];
}

function InputPanel({
  label, hint, value, onChange, placeholder, file, onFile, onClearFile, accept,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
  placeholder: string; file: UploadedFile | null;
  onFile: (f: File | undefined) => void; onClearFile: () => void; accept: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={() => ref.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />Upload
        </Button>
        <input ref={ref} type="file" accept={accept} className="hidden"
          onChange={(e) => { onFile(e.target.files?.[0]); if (ref.current) ref.current.value = ""; }} />
      </div>

      {file && (
        <div className="px-4 py-2 border-b border-border bg-secondary/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{file.name}</span>
            <span className="text-muted-foreground shrink-0">· {(file.size / 1024).toFixed(0)} KB</span>
          </div>
          <button onClick={onClearFile} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <Textarea
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={file ? "Optional: add extra context here…" : placeholder}
        className="min-h-[280px] rounded-none border-0 focus-visible:ring-0 resize-none font-mono text-[13px] leading-relaxed"
      />
      <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex justify-between">
        <span>{value.trim().length} chars{file ? " + file" : ""}</span>
        <span>{(value.trim().length >= 30 || file) ? "Ready" : "Add text or upload a file"}</span>
      </div>
    </div>
  );
}

function InspirationPanel({ file, onFile, onClear }: { file: UploadedFile | null; onFile: (f: File | undefined) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Format inspiration <span className="text-xs font-normal text-muted-foreground">(optional)</span></div>
          <div className="text-xs text-muted-foreground mt-0.5">Upload a screenshot of a CV layout you like — we'll mimic its structure.</div>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={() => ref.current?.click()}>
          <ImageIcon className="h-3.5 w-3.5 mr-1.5" />Upload
        </Button>
        <input ref={ref} type="file" accept={ACCEPT_IMG} className="hidden"
          onChange={(e) => { onFile(e.target.files?.[0]); if (ref.current) ref.current.value = ""; }} />
      </div>
      {file && (
        <div className="mt-3 flex items-center justify-between text-xs bg-secondary/40 border border-border rounded-md px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{file.name}</span>
            <span className="text-muted-foreground shrink-0">· {(file.size / 1024).toFixed(0)} KB</span>
          </div>
          <button onClick={onClear} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ result }: { result: { matchScore: number; summary: string; strengths: string[]; missingKeywords: string[]; improvements: string[] } }) {
  const score = Math.max(0, Math.min(100, Math.round(result.matchScore)));
  const tone = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-primary" : "text-amber-600";
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="p-5 flex flex-col items-center justify-center text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Match Score
          </div>
          <div className={`text-5xl font-semibold ${tone}`}>{score}<span className="text-2xl text-muted-foreground">%</span></div>
          <div className="mt-3 w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${score}%` }} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
        </div>

        <div className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Missing Keywords
          </div>
          {result.missingKeywords.length === 0 ? (
            <p className="text-xs text-muted-foreground">No critical gaps detected.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {result.missingKeywords.map((k, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-700 border border-amber-500/20">{k}</span>
              ))}
            </div>
          )}
          {result.strengths.length > 0 && (
            <>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-5 mb-2">Strengths Aligned</div>
              <ul className="space-y-1.5">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-xs flex gap-1.5 text-foreground"><Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /><span>{s}</span></li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Key Improvements
          </div>
          {result.improvements.length === 0 ? (
            <p className="text-xs text-muted-foreground">CV is already well aligned.</p>
          ) : (
            <ul className="space-y-2">
              {result.improvements.map((s, i) => (
                <li key={i} className="text-xs flex gap-2 text-foreground">
                  <span className="h-4 w-4 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
