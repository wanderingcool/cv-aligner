// Renders the AI-produced markdown CV into styled, print-ready HTML using a styleSpec.
// Pure utility: no React, no framework dependencies. ATS-friendliness preserved (semantic
// HTML, real text — no images, no exotic glyphs).

export type StyleSpec = {
  accentColor: string;
  headingFont: "serif" | "sans" | "mono";
  bodyFont: "serif" | "sans" | "mono";
  layout: "single-column" | "two-column-left-sidebar" | "two-column-right-sidebar";
  headerStyle: "centered" | "left-aligned" | "banner";
  sectionDivider: "underline" | "rule" | "uppercase-label" | "none";
  density: "compact" | "normal" | "airy";
};

const FONT_STACKS: Record<StyleSpec["headingFont"], string> = {
  serif: `Georgia, "Times New Roman", Times, serif`,
  sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
  mono: `"SF Mono", Menlo, Consolas, monospace`,
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Minimal markdown → HTML for the constrained subset the AI produces:
// # H1, ## H2, ### H3, > blockquote, **bold**, *italic*, - bullets, plain paragraphs.
function inlineMd(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[\s(])\*([^*\n]+?)\*(?=$|[\s).,!?])/g, "$1<em>$2</em>");
  return t;
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "p"; text: string };

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("# ")) { blocks.push({ kind: "h1", text: line.slice(2).trim() }); i++; continue; }
    if (line.startsWith("## ")) { blocks.push({ kind: "h2", text: line.slice(3).trim() }); i++; continue; }
    if (line.startsWith("### ")) { blocks.push({ kind: "h3", text: line.slice(4).trim() }); i++; continue; }
    if (line.startsWith("> ")) { blocks.push({ kind: "quote", text: line.slice(2).trim() }); i++; continue; }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, "").trim());
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    // paragraph: collect until blank line or heading-ish
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s+|>\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: para.join(" ").trim() });
  }
  return blocks;
}

function blocksToHtml(blocks: Block[], opts: { uppercaseH2: boolean }): string {
  return blocks.map((b) => {
    switch (b.kind) {
      case "h1": return `<h1>${inlineMd(b.text)}</h1>`;
      case "h2": {
        const t = opts.uppercaseH2 ? b.text.toUpperCase() : b.text;
        return `<h2>${inlineMd(t)}</h2>`;
      }
      case "h3": return `<h3>${inlineMd(b.text)}</h3>`;
      case "quote": return `<blockquote>${inlineMd(b.text)}</blockquote>`;
      case "ul": return `<ul>${b.items.map((it) => `<li>${inlineMd(it)}</li>`).join("")}</ul>`;
      case "p": return `<p>${inlineMd(b.text)}</p>`;
    }
  }).join("\n");
}

// Split blocks into header (everything before first H2), main (Experience-heavy), sidebar (Skills/Education/etc).
function splitForTwoColumn(blocks: Block[]): { header: Block[]; main: Block[]; side: Block[] } {
  const sidebarKeywords = /^(skills|education|certifications|languages|tools|technical skills|core competencies|areas of expertise|highlights)/i;
  const header: Block[] = [];
  const main: Block[] = [];
  const side: Block[] = [];
  let seenH2 = false;
  let bucket: "main" | "side" = "main";
  for (const b of blocks) {
    if (!seenH2 && b.kind !== "h2") { header.push(b); continue; }
    if (b.kind === "h2") {
      seenH2 = true;
      bucket = sidebarKeywords.test(b.text) ? "side" : "main";
    }
    (bucket === "side" ? side : main).push(b);
  }
  return { header, main, side };
}

function densityVars(d: StyleSpec["density"]) {
  if (d === "compact") return { line: "1.35", paraGap: "4px", h2Gap: "14px", h3Gap: "10px", base: "11.5px" };
  if (d === "airy")    return { line: "1.6",  paraGap: "10px", h2Gap: "26px", h3Gap: "16px", base: "12.5px" };
  return                       { line: "1.5",  paraGap: "6px",  h2Gap: "20px", h3Gap: "12px", base: "12px" };
}

export function renderCvHtml(markdown: string, spec: StyleSpec, opts?: { titleHint?: string; watermark?: boolean }): string {
  const blocks = parseMarkdown(markdown);
  const accent = sanitizeColor(spec.accentColor);
  const headFont = FONT_STACKS[spec.headingFont];
  const bodyFont = FONT_STACKS[spec.bodyFont];
  const dv = densityVars(spec.density);
  const upperH2 = spec.sectionDivider === "uppercase-label";

  let bodyHtml = "";
  if (spec.layout === "single-column") {
    bodyHtml = `<main class="col">${blocksToHtml(blocks, { uppercaseH2: upperH2 })}</main>`;
  } else {
    const { header, main, side } = splitForTwoColumn(blocks);
    const sideOnLeft = spec.layout === "two-column-left-sidebar";
    const headerHtml = blocksToHtml(header, { uppercaseH2: upperH2 });
    const mainHtml = blocksToHtml(main, { uppercaseH2: upperH2 });
    const sideHtml = blocksToHtml(side, { uppercaseH2: upperH2 });
    bodyHtml = `
      <header class="hdr">${headerHtml}</header>
      <div class="grid">
        ${sideOnLeft
          ? `<aside class="side">${sideHtml}</aside><main class="main">${mainHtml}</main>`
          : `<main class="main">${mainHtml}</main><aside class="side">${sideHtml}</aside>`}
      </div>`;
  }

  const headerAlign =
    spec.headerStyle === "centered" ? "text-align:center;" :
    spec.headerStyle === "banner" ? `text-align:left; background:${accent}; color:#fff; padding:18px 22px; border-radius:6px;` :
    "text-align:left;";

  const dividerCss =
    spec.sectionDivider === "underline" ? `h2 { border-bottom: 2px solid ${accent}; padding-bottom: 4px; }` :
    spec.sectionDivider === "rule" ? `h2 { border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }` :
    spec.sectionDivider === "uppercase-label" ? `h2 { letter-spacing: 0.08em; color: ${accent}; }` :
    "";

  const css = `
    @page { margin: 0.55in; }
    * { box-sizing: border-box; }
    body { font-family: ${bodyFont}; color: #111827; line-height: ${dv.line}; font-size: ${dv.base}; max-width: 820px; margin: 0 auto; padding: 16px; }
    h1, h2, h3 { font-family: ${headFont}; color: #0f172a; }
    h1 { font-size: 26px; margin: 0 0 4px; color: ${spec.headerStyle === "banner" ? "#fff" : accent}; }
    h2 { font-size: 13px; text-transform: ${upperH2 ? "uppercase" : "none"}; margin: ${dv.h2Gap} 0 8px; color: #111827; }
    h3 { font-size: 13px; margin: ${dv.h3Gap} 0 2px; }
    p  { margin: ${dv.paraGap} 0; }
    ul { padding-left: 18px; margin: 4px 0 ${dv.paraGap}; }
    li { margin: 2px 0; }
    blockquote { margin: 6px 0 12px; padding: 6px 12px; border-left: 3px solid ${accent}; color: #374151; font-style: italic; }
    .hdr { ${headerAlign} margin-bottom: 14px; }
    .hdr h1 + p, .hdr p { margin-top: 2px; color: ${spec.headerStyle === "banner" ? "rgba(255,255,255,0.92)" : "#4b5563"}; }
    .grid { display: grid; grid-template-columns: ${spec.layout === "two-column-left-sidebar" ? "32% 1fr" : "1fr 32%"}; gap: 28px; }
    .side h2:first-of-type, .main h2:first-of-type { margin-top: 0; }
    .side { font-size: ${parseFloat(dv.base) - 0.5}px; }
    ${dividerCss}
    @media print { body { padding: 0; } a { color: inherit; text-decoration: none; } }
    .pos-watermark { position: fixed; bottom: 12px; right: 12px; font-family: ${bodyFont}; font-size: 10px; color: #9ca3af; opacity: 0.85; letter-spacing: 0.04em; }
    .pos-watermark-bg { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; transform: rotate(-28deg); font-size: 76px; color: rgba(17, 24, 39, 0.06); font-weight: 700; font-family: ${headFont}; letter-spacing: 0.1em; z-index: 0; }
    @media print { .pos-watermark, .pos-watermark-bg { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `;

  const title = escapeHtml(opts?.titleHint ?? "Optimized CV");
  const wm = opts?.watermark
    ? `<div class="pos-watermark-bg">POSITIONED</div><div class="pos-watermark">Optimized by Positioned · cvpositioned.com</div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>${css}</style></head><body>${wm}${bodyHtml}</body></html>`;
}

function sanitizeColor(c: string): string {
  if (typeof c !== "string") return "#1E3A8A";
  const m = c.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  return m ? `#${m[1]}` : "#1E3A8A";
}

export const TEMPLATE_DEFAULTS: Record<string, StyleSpec> = {
  classic:   { accentColor: "#1E3A8A", headingFont: "sans",  bodyFont: "serif", layout: "single-column",            headerStyle: "left-aligned", sectionDivider: "underline",        density: "normal" },
  modern:    { accentColor: "#0F766E", headingFont: "sans",  bodyFont: "sans",  layout: "single-column",            headerStyle: "left-aligned", sectionDivider: "rule",             density: "airy" },
  compact:   { accentColor: "#111827", headingFont: "sans",  bodyFont: "sans",  layout: "single-column",            headerStyle: "left-aligned", sectionDivider: "uppercase-label",  density: "compact" },
  executive: { accentColor: "#1F2937", headingFont: "serif", bodyFont: "serif", layout: "two-column-left-sidebar",  headerStyle: "banner",       sectionDivider: "rule",             density: "normal" },
  "ats-clean":         { accentColor: "#111827", headingFont: "sans",  bodyFont: "sans",  layout: "single-column",           headerStyle: "left-aligned", sectionDivider: "uppercase-label", density: "compact" },
  "premium-executive": { accentColor: "#1F2937", headingFont: "serif", bodyFont: "serif", layout: "single-column",           headerStyle: "centered",     sectionDivider: "rule",            density: "normal" },
  "modern-minimal":    { accentColor: "#0F172A", headingFont: "sans",  bodyFont: "sans",  layout: "single-column",           headerStyle: "left-aligned", sectionDivider: "uppercase-label", density: "normal" },
  inspiration:         { accentColor: "#1E3A8A", headingFont: "sans",  bodyFont: "sans",  layout: "single-column",           headerStyle: "left-aligned", sectionDivider: "rule",            density: "normal" },
};
