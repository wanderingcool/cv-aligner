import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  cv: z.string().trim().min(50, "CV is too short").max(20000, "CV is too long"),
  jobDescription: z
    .string()
    .trim()
    .min(50, "Job description is too short")
    .max(20000, "Job description is too long"),
  inspirationImageBase64: z.string().optional(),
  inspirationMediaType: z.string().optional(),
});

const SYSTEM_PROMPT = `You are an elite career marketing strategist and CV writer. Your job is to rewrite a candidate's CV so it is precision-aligned to a specific Job Description (JD), as if marketing a premium product to a specific buyer.

Operate in this strict order:

1. CONSUMER VALUE ANALYSIS — Silently extract from the JD:
   - Stated requirements (skills, tools, experience, qualifications)
   - Unstated needs (cultural cues, seniority signals, business outcomes the role exists to drive, risks the hiring manager wants to avoid)
   - Success metrics the role will be judged on

2. POSITIONING — Map the candidate to the JD:
   - Points-of-Parity (POPs): table-stakes the candidate must clearly meet
   - Points-of-Difference (PODs): unique strengths that set the candidate apart from likely competitors
   - De-emphasize or remove anything irrelevant to this JD. Never invent experience, employers, dates, degrees, or metrics. If a metric is implied but not stated, leave it qualitative.

3. REWRITE every relevant CV bullet using the FABV framework, in this voice:
   - Feature: what was done (the action / scope)
   - Advantage: how it was done better / differently
   - Benefit: the outcome for the team / company
   - Value: the strategic value tied to what THIS JD cares about
   Each bullet must read as ONE tight sentence (or two short clauses). Lead with a strong verb. Front-load JD keywords naturally. No buzzword soup, no first person, no "responsible for".

4. OUTPUT FORMAT — Clean professional Markdown, in this exact order:

# {Candidate Name}
{one-line contact info if present in original CV}

## Positioning Summary
A 2-3 sentence pitch positioning the candidate specifically for THIS role. Lead with their #1 POD.

## Core Strengths Aligned to This Role
- 4-6 short bullets. Each maps a candidate strength to a specific JD requirement.

## Experience
### {Title} - {Company} ({Dates})
- FABV bullets, prioritized by relevance to the JD.

(Repeat for each role. Trim or compress older / irrelevant roles.)

## Education
- Keep concise.

## Skills
- Group by category. Prioritize skills the JD explicitly asks for.

Rules:
- Output Markdown only. No preamble, no commentary, no "Here is your CV", no closing notes.
- Never fabricate facts. Reframe, don't invent.
- Keep it ATS-friendly: plain Markdown, no tables, no emojis, no exotic characters.`;

export const optimizeCv = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      throw new Error(
        "AI is not configured. Set ANTHROPIC_API_KEY in your environment."
      );

    const cvPrompt = `JOB DESCRIPTION:\n"""\n${data.jobDescription}\n"""\n\nCANDIDATE CV:\n"""\n${data.cv}\n"""\n\nProduce the optimized CV now.`;

    const userContent =
      data.inspirationImageBase64 && data.inspirationMediaType
        ? [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: data.inspirationMediaType,
                data: data.inspirationImageBase64,
              },
            },
            {
              type: "text",
              text: `The user has uploaded a screenshot of a CV layout they admire. Study it carefully: note the section order, level of detail per bullet, overall density, and structural hierarchy. Mirror these structural and stylistic preferences in your output while still following all formatting rules.\n\n${cvPrompt}`,
            },
          ]
        : cvPrompt;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const errorMsg = (errorBody as any)?.error?.message ?? "";
      if (res.status === 429)
        throw new Error("Rate limit reached. Please wait a moment and try again.");
      if (res.status === 401)
        throw new Error("Invalid API key. Check your ANTHROPIC_API_KEY.");
      if (res.status === 529)
        throw new Error(
          "Anthropic API is temporarily overloaded. Please try again shortly."
        );
      console.error("Anthropic API error:", res.status, errorMsg);
      throw new Error("AI service error. Please try again.");
    }

    const json = await res.json();
    const content: string = (json as any)?.content?.[0]?.text ?? "";
    if (!content) throw new Error("Empty response from AI.");

    return { markdown: content };
  });
