import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import {
  Sparkles, Copy, Download, Check, Wand2, ShieldCheck, Zap,
  FileText, Upload, X, Image, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { optimizeCv } from "@/server/optimize-cv.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
});

// ── Types ─────────────────────────────────────────────────────────────────
type InputMode = "text" | "file";
type Template = "classic" | "modern" | "minimal";

interface InspirationImage {
  base64: string;
  mediaType: string;
  name: string;
}

// ── File Parsers ──────────────────────────────────────────────────────────
async function parsePdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).href;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(" ") + "\n\n";
  }
  return text.trim();
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

async function parseFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf"))
    return parsePdf(file);
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return parseDocx(file);
  if (file.type === "text/plain" || name.endsWith(".txt"))
    return file.text();
  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
}

// ── Markdown → HTML ───────────────────────────────────────────────────────
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    if (t.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${esc(t.slice(2))}</h1>`);
    } else if (t.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${esc(t.slice(3))}</h2>`);
    } else if (t.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${esc(t.slice(4))}</h3>`);
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${esc(t.slice(2))}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${esc(t)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

// ── PDF Templates ─────────────────────────────────────────────────────────
const TEMPLATES: Record<Template, { label: string; description: string; accent: string; css: string }> = {
  classic: {
    label: "Classic",
    description: "Clean & ATS-safe",
    accent: "#1e293b",
    css: `
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; max-width: 760px; margin: 0 auto; padding: 48px 40px; }
      h1 { font-size: 26pt; font-weight: 700; margin: 0 0 6px; }
      h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; color: #1e293b; border-bottom: 2px solid #1e293b; padding-bottom: 4px; margin: 24px 0 10px; }
      h3 { font-size: 11.5pt; font-weight: 600; margin: 14px 0 4px; }
      p { font-size: 10.5pt; color: #334155; margin: 4px 0 8px; }
      ul { padding-left: 18px; margin: 6px 0 10px; }
      li { font-size: 10.5pt; color: #334155; margin-bottom: 4px; line-height: 1.5; }
    `,
  },
  modern: {
    label: "Modern",
    description: "Bold accent, contemporary",
    accent: "#2563eb",
    css: `
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; max-width: 760px; margin: 0 auto; padding: 48px 40px; }
      h1 { font-size: 28pt; font-weight: 800; margin: 0 0 6px; color: #1e3a8a; letter-spacing: -0.02em; }
      h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; color: #2563eb; border-left: 3px solid #2563eb; padding-left: 10px; margin: 26px 0 10px; }
      h3 { font-size: 11.5pt; font-weight: 700; color: #1e293b; margin: 14px 0 4px; }
      p { font-size: 10.5pt; color: #475569; margin: 4px 0 8px; }
      ul { padding-left: 0; margin: 6px 0 10px; list-style: none; }
      li { font-size: 10.5pt; color: #475569; margin-bottom: 5px; line-height: 1.55; padding-left: 14px; position: relative; }
      li::before { content: "▸"; color: #2563eb; position: absolute; left: 0; font-size: 8pt; top: 2px; }
    `,
  },
  minimal: {
    label: "Minimal",
    description: "Whitespace-first, elegant",
    accent: "#0f766e",
    css: `
      body { font-family: Georgia, 'Times New Roman', serif; color: #1c1917; max-width: 700px; margin: 0 auto; padding: 56px 48px; }
      h1 { font-size: 28pt; font-weight: 400; letter-spacing: -0.03em; margin: 0 0 8px; }
      h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 400; color: #0f766e; font-family: 'Segoe UI', Arial, sans-serif; margin: 32px 0 12px; border: none; }
      h3 { font-size: 11pt; font-weight: 600; font-style: italic; margin: 16px 0 4px; }
      p { font-size: 10.5pt; color: #44403c; margin: 4px 0 8px; line-height: 1.6; }
      ul { padding-left: 0; margin: 6px 0 12px; list-style: none; }
      li { font-size: 10.5pt; color: #44403c; margin-bottom: 5px; line-height: 1.6; }
      li::before { content: "— "; color: #0f766e; }
    `,
  },
};

function generatePdfHtml(md: string, template: Template): string {
  const { css } = TEMPLATES[template];
  const body = markdownToHtml(md);
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Aligned CV</title>
<style>
  * { box-sizing: border-box; }
  @page { margin: 0; size: A4; }
  ${css}
</style>
</head><body>
${body}
<script>window.onload = () => { window.print(); };<\/script>
</body></html>`;
}

// ── FileDropZone ──────────────────────────────────────────────────────────
function FileDropZone({ onFile, label }: { onFile: (f: File) => void; label: string }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-3 cursor-pointer rounded-lg border-2 border-dashed transition-colors min-h-[260px] px-6 text-center",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/40"
      )}
    >
      <div className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
        <Upload className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, or TXT — drag & drop or click</p>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ── InputPanel ────────────────────────────────────────────────────────────
function InputPanel({
  label, hint, value, onChange, placeholder,
}: {
  label: string; hint: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  const [mode, setMode] = useState<InputMode>("text");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const text = await parseFile(file);
      onChange(text);
      setFileName(file.name);
      setMode("text");
      toast.success(`Parsed: ${file.name}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to parse file.");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0 text-xs">
          <button
            onClick={() => setMode("text")}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 transition-colors",
              mode === "text" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
            )}
          >
            <FileText className="h-3 w-3" /> Text
          </button>
          <button
            onClick={() => setMode("file")}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 transition-colors border-l border-border",
              mode === "file" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
            )}
          >
            <Upload className="h-3 w-3" /> Upload
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col">
        {mode === "text" ? (
          <>
            {fileName && (
              <div className="px-4 py-2 bg-primary/5 border-b border-border flex items-center justify-between text-xs">
                <span className="text-primary font-medium flex items-center gap-1.5 truncate">
                  <FileText className="h-3.5 w-3.5 shrink-0" /> {fileName}
                </span>
                <button
                  onClick={() => { onChange(""); setFileName(null); }}
                  className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1 min-h-[300px] rounded-none border-0 focus-visible:ring-0 resize-none font-mono text-[13px] leading-relaxed"
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col p-4">
            {parsing ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm text-muted-foreground animate-pulse">Parsing file…</span>
              </div>
            ) : (
              <FileDropZone onFile={handleFile} label={`Upload your ${label}`} />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex justify-between">
        <span>{value.trim().length} chars</span>
        <span className={value.trim().length >= 50 ? "text-green-600" : ""}>
          {value.trim().length >= 50 ? "✓ Ready" : "Min 50 chars"}
        </span>
      </div>
    </div>
  );
}

// ── InspirationUpload ─────────────────────────────────────────────────────
function InspirationUpload({
  inspiration, onSet, onClear,
}: {
  inspiration: InspirationImage | null;
  onSet: (img: InspirationImage) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSet({ base64: dataUrl.split(",")[1], mediaType: file.type, name: file.name });
      toast.success("Style reference set.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Image className="h-4 w-4 text-muted-foreground" />
        <div>
          <span className="text-sm font-medium text-foreground">Style Inspiration</span>
          <span className="text-xs text-muted-foreground ml-2">(optional)</span>
        </div>
      </div>
      <div className="p-4">
        {inspiration ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <img
              src={`data:${inspiration.mediaType};base64,${inspiration.base64}`}
              alt="Inspiration preview"
              className="h-12 w-12 rounded-md object-cover border border-border shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{inspiration.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Claude will match this CV's structure and style
              </p>
            </div>
            <button onClick={onClear} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => ref.current?.click()}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border border-dashed cursor-pointer transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/40"
            )}
          >
            <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Image className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a screenshot of a CV layout you like — Claude will mirror its structure.{" "}
              <span className="text-primary font-medium">Browse</span>
            </p>
            <input
              ref={ref}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── TemplateSelector ──────────────────────────────────────────────────────
function TemplateSelector({
  selected, onSelect,
}: {
  selected: Template; onSelect: (t: Template) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        PDF Template
      </p>
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(TEMPLATES) as [Template, (typeof TEMPLATES)[Template]][]).map(([key, t]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={cn(
              "flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all",
              selected === key
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border hover:border-primary/40 hover:bg-secondary/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{t.label}</span>
              {selected === key && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <p className="text-[10px] text-muted-foreground">{t.description}</p>
            {/* Mini preview bars */}
            <div className="space-y-1 pt-1">
              <div className="h-2.5 rounded-sm w-2/3" style={{ backgroundColor: t.accent + "22" }} />
              <div className="h-0.5 rounded-full w-full" style={{ backgroundColor: t.accent + "44" }} />
              <div className="h-1 rounded-full bg-muted w-full" />
              <div className="h-1 rounded-full bg-muted w-5/6" />
              <div className="h-1 rounded-full bg-muted w-4/6" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
function Index() {
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inspiration, setInspiration] = useState<InspirationImage | null>(null);
  const [template, setTemplate] = useState<Template>("classic");

  const canSubmit = cv.trim().length >= 50 && jd.trim().length >= 50 && !loading;

  const handleOptimize = async () => {
    if (!canSubmit) {
      toast.error("Please provide both your CV and job description (50+ chars each).");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const res = await optimizeCv({
        data: {
          cv,
          jobDescription: jd,
          ...(inspiration && {
            inspirationImageBase64: inspiration.base64,
            inspirationMediaType: inspiration.mediaType,
          }),
        },
      });
      setResult(res.markdown);
      toast.success("Aligned CV ready.");
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
    const w = window.open("", "_blank", "width=960,height=1200");
    if (!w) { toast.error("Please allow popups to export PDF."); return; }
    w.document.write(generatePdfHtml(result, template));
    w.document.close();
  };

  const handleExportTxt = () => {
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aligned-cv.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as .txt");
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
          <span className="text-xs text-muted-foreground hidden sm:block">
            AI-aligned CVs for the role you actually want
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-14 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground mb-4">
          <Zap className="h-3 w-3" /> Powered by Claude Sonnet
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Stop applying. Start aligning.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Paste or upload your CV and the job description — get a precision-aligned,
          recruiter-ready CV in seconds.
        </p>
      </section>

      {/* Inputs */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputPanel
            label="Your CV"
            hint="Paste text or upload PDF / DOCX"
            value={cv}
            onChange={setCv}
            placeholder="Paste your full CV — work history, education, skills..."
          />
          <InputPanel
            label="Job Description"
            hint="Paste text or upload PDF / DOCX"
            value={jd}
            onChange={setJd}
            placeholder="Paste the full JD: responsibilities, requirements, company context..."
          />
        </div>
      </section>

      {/* Inspiration */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <InspirationUpload
          inspiration={inspiration}
          onSet={setInspiration}
          onClear={() => setInspiration(null)}
        />
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Your content is sent securely and used only to generate your CV.
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
                Conducting Value Analysis…
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Align My CV
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Output */}
      <section id="output" className="mx-auto max-w-4xl px-6 pb-24">
        {result ? (
          <div className="space-y-5">
            <TemplateSelector selected={template} onSelect={setTemplate} />
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium">Aligned CV</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportTxt}>
                    <FileText className="h-4 w-4 mr-1.5" /> .txt
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
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-12 text-center text-sm text-muted-foreground">
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
