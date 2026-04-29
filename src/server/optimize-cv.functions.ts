import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FileSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1),
  name: z.string().optional(),
});

const InputSchema = z.object({
  cvText: z.string().trim().max(30000).optional(),
  cvFile: FileSchema.optional(),
  jdText: z.string().trim().max(30000).optional(),
  jdFile: FileSchema.optional(),
  template: z.enum(["classic", "modern", "compact", "executive"]).default("classic"),
  inspirationImage: FileSchema.optional(),
}).refine(
  (d) => (d.cvText && d.cvText.length >= 30) || d.cvFile,
  { message: "Provide a CV (paste text or upload file)" },
).refine(
  (d) => (d.jdText && d.jdText.length >= 30) || d.jdFile,
  { message: "Provide a job description (paste text or upload file)" },
);

const TEMPLATES: Record<string, string> = {
  classic: `Classic professional Markdown layout:
# Name
Contact line
## Professional Summary
## Core Competencies (4-6 bullets)
## Professional Experience
### Title — Company (Dates)
- bullets
## Education
## Skills (grouped)`,
  modern: `Modern minimalist Markdown layout with strong summary:
# Name
**Title** • Contact
> One-line value proposition
## Highlights (3-4 bullets, metrics first)
## Experience
### Company — Title (Dates)
Brief context line.
- impact bullets
## Skills | Education (concise)`,
  compact: `One-page compact Markdown layout. Aggressively trim. Short bullets.
# Name | Contact
## Summary (2 lines)
## Skills (single line, comma-separated, JD-prioritized)
## Experience
### Title, Company (Dates)
- 2-3 tight bullets per role
## Education (one line)`,
  executive: `Executive Markdown layout focused on scope and outcomes:
# Name
Contact
## Executive Summary (3-4 sentences)
## Areas of Expertise (categorized list)
## Selected Achievements (4-6 standout bullets across career)
## Professional Experience
### Title — Company (Dates)
Scope: team size, budget, geography (if implied)
- outcome-led bullets
## Education & Credentials`,
};

const SYSTEM_PROMPT = `You are an elite career marketing strategist and CV writer.

Workflow (silent, then output via tool call):
1. CONSUMER VALUE ANALYSIS — extract from JD: stated requirements, unstated needs, success metrics, hiring-manager risks.
2. POSITIONING — map candidate to JD: Points-of-Parity (table-stakes met) and Points-of-Difference (unique edge). Never invent facts.
3. REWRITE every relevant bullet using FABV (Feature → Advantage → Benefit → Value-to-this-JD). Lead with strong verbs. Front-load JD keywords naturally. No first person, no "responsible for", no buzzword soup.
4. SCORE the alignment honestly (0-100). Be calibrated — most generic CVs against a specific JD score 40-70 before optimization, 70-90 after.

You MUST return a single tool call to "return_optimized_cv" with:
- matchScore: integer 0-100, post-optimization alignment
- summary: 1-2 sentence positioning verdict
- strengths: 3-5 specific candidate strengths that match JD requirements
- missingKeywords: 4-8 important JD terms/skills not evidenced in the CV
- improvements: 3-6 concrete, actionable suggestions (e.g. "Quantify the migration project at Acme", "Add a line about stakeholder management for VP audiences")
- markdown: the full optimized CV in clean ATS-friendly Markdown, following the requested template structure exactly

Markdown rules: plain Markdown only, no tables, no emojis, no exotic chars. No preamble, no commentary, no closing notes.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "return_optimized_cv",
    description: "Return the alignment analysis and the optimized CV.",
    parameters: {
      type: "object",
      properties: {
        matchScore: { type: "integer", minimum: 0, maximum: 100 },
        summary: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        missingKeywords: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        markdown: { type: "string" },
        styleSpec: {
          type: "object",
          description: "Visual style derived from the inspiration image (if provided) or sensible defaults for the chosen template.",
          properties: {
            accentColor: { type: "string", description: "Hex like #1E40AF" },
            headingFont: { type: "string", enum: ["serif", "sans", "mono"] },
            bodyFont: { type: "string", enum: ["serif", "sans", "mono"] },
            layout: { type: "string", enum: ["single-column", "two-column-left-sidebar", "two-column-right-sidebar"] },
            headerStyle: { type: "string", enum: ["centered", "left-aligned", "banner"] },
            sectionDivider: { type: "string", enum: ["underline", "rule", "uppercase-label", "none"] },
            density: { type: "string", enum: ["compact", "normal", "airy"] },
          },
          required: ["accentColor", "headingFont", "bodyFont", "layout", "headerStyle", "sectionDivider", "density"],
          additionalProperties: false,
        },
      },
      required: ["matchScore", "summary", "strengths", "missingKeywords", "improvements", "markdown", "styleSpec"],
      additionalProperties: false,
    },
  },
};

type FilePart = z.infer<typeof FileSchema>;

const SUPPORTED_BINARY_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const TEXT_MIME_PREFIXES = ["text/"];

function decodeBase64Utf8(b64: string): string {
  // Server runtime supports Buffer
  return Buffer.from(b64, "base64").toString("utf-8");
}

function normalizeFileForAI(f: FilePart, label: string): { kind: "text"; text: string } | { kind: "binary"; part: any } {
  const mime = (f.mimeType || "").toLowerCase();
  if (TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p)) || mime === "" || mime === "application/octet-stream" && /\.(txt|md)$/i.test(f.name ?? "")) {
    return { kind: "text", text: decodeBase64Utf8(f.base64) };
  }
  if (SUPPORTED_BINARY_MIME.has(mime)) {
    return {
      kind: "binary",
      part: { type: "image_url" as const, image_url: { url: `data:${mime};base64,${f.base64}` } },
    };
  }
  // Word docs etc — not supported by Gemini directly
  throw new Error(
    `${label}: "${f.name ?? "file"}" (${mime || "unknown type"}) isn't supported. Please upload a PDF, image (PNG/JPG), or .txt — or paste the text directly. Word documents: open the file and "Save as PDF".`,
  );
}

function filePart(f: FilePart) {
  // Gemini via OpenAI-compatible gateway accepts image_url with data URLs for images & PDFs.
  return {
    type: "image_url" as const,
    image_url: { url: `data:${f.mimeType};base64,${f.base64}` },
  };
}

export const optimizeCv = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const userContent: any[] = [];
    userContent.push({
      type: "text",
      text: `TARGET FORMAT TEMPLATE:\n${TEMPLATES[data.template]}\n\nFollow this structure for the markdown output.`,
    });

    // CV
    userContent.push({ type: "text", text: "\n=== CANDIDATE CV ===" });
    if (data.cvText) userContent.push({ type: "text", text: data.cvText });
    if (data.cvFile) {
      const n = normalizeFileForAI(data.cvFile, "CV");
      userContent.push(n.kind === "text" ? { type: "text", text: n.text } : n.part);
    }

    // JD
    userContent.push({ type: "text", text: "\n=== JOB DESCRIPTION ===" });
    if (data.jdText) userContent.push({ type: "text", text: data.jdText });
    if (data.jdFile) {
      const n = normalizeFileForAI(data.jdFile, "Job description");
      userContent.push(n.kind === "text" ? { type: "text", text: n.text } : n.part);
    }

    // Inspiration
    if (data.inspirationImage) {
      userContent.push({
        type: "text",
        text: "\n=== FORMAT INSPIRATION (mimic the visual structure / section ordering / density of this layout in your Markdown output, while keeping it ATS-friendly) ===",
      });
      const n = normalizeFileForAI(data.inspirationImage, "Inspiration image");
      userContent.push(n.kind === "text" ? { type: "text", text: n.text } : n.part);
    }

    userContent.push({
      type: "text",
      text: "\nNow perform the analysis and return the result via the return_optimized_cv tool. Do not respond with plain text.",
    });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_optimized_cv" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in Workspace settings.");
      const text = await res.text();
      console.error("AI gateway error:", res.status, text);
      throw new Error("AI service error. Please try again.");
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr: string | undefined = call?.function?.arguments;
    if (!argsStr) {
      console.error("No tool call returned:", JSON.stringify(json).slice(0, 500));
      throw new Error("Empty response from AI.");
    }
    let parsed: any;
    try { parsed = JSON.parse(argsStr); } catch {
      throw new Error("AI returned malformed result.");
    }
    return {
      matchScore: Number(parsed.matchScore ?? 0),
      summary: String(parsed.summary ?? ""),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords.map(String) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String) : [],
      markdown: String(parsed.markdown ?? ""),
      styleSpec: parsed.styleSpec ?? null,
    };
  });
