import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  description: string;
  locale: "pt" | "en";
}

function buildPrompt(description: string, locale: "pt" | "en"): string {
  const language = locale === "pt" ? "Portuguese (pt-BR)" : "English";

  const globalRules = [
    `Write in ${language}.`,
    "Be concise, practical and free of hype.",
    "Stay strictly on the project scope; do not invent missing details.",
    "If information is insufficient, ask for clarifications briefly in the summary OR make minimal safe assumptions and state them explicitly as assumptions.",
    "Avoid sensitive, illegal or harmful content.",
    "Prefer bullet points and short paragraphs in strings where appropriate.",
    "Do not include markdown code fences or markdown headings; plain text only inside JSON strings.",
    "Keep timelines realistic; do not promise guaranteed results.",
    "Do not include pricing unless asked. If currency appears, use BRL format: R$ 12.345,67.",
    "All fields MUST be short and skimmable; avoid long paragraphs.",
  ].join("\n- ");

  const schemaInstruction =
    `Return ONLY valid JSON that matches this TypeScript type:\n` +
    `type GeneratedProposal = {\n` +
    `  title: string;\n` +
    `  summary: string;\n` +
    `  sections: Array<{ heading: string; content: string[] }>;\n` +
    `  timeline: Array<{ phase: string; duration: string; details: string }>;\n` +
    `  budgetNote: string;\n` +
    `};\n` +
    `Do not include markdown code fences.`;

  const formattingRules = [
    "title: 6–12 words, specific to the project.",
    "summary: 2–4 concise sentences. If assumptions are made, prefix with \"Assumptions:\".",
    "sections: 3–6 sections. Each section content is 3–6 bullet strings, each 6–18 words.",
    "timeline: 4–6 phases. For duration, use one of: \"X–Y weeks\", \"X–Y days\", \"X–Y months\", or \"Ongoing\"/\"Contínuo\". Keep units consistent with locale.",
    "timeline.details: 1–2 short sentences; avoid marketing language.",
    "budgetNote: one sentence; do NOT include prices unless explicitly requested.",
  ].join("\n- ");

  const localization =
    locale === "pt"
      ? [
        "Use units in Portuguese: dias, semanas, meses, Contínuo.",
        "Use vírgula decimal apenas quando natural ao texto; evite números desnecessários.",
      ].join("\n- ")
      : ["Use units in English: days, weeks, months, Ongoing."].join("\n- ");

  return [
    schemaInstruction,
    `Global rules:\n- ${globalRules}`,
    `Output formatting constraints:\n- ${formattingRules}`,
    `Localization rules:\n- ${localization}`,
    `User description:\n${description}`,
  ].join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { description, locale }: GenerateRequest = await req.json();

    if (!description || !locale) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: description, locale" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-pro";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured in Supabase Secrets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const prompt = buildPrompt(description, locale);

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    };

    const callGemini = async () => {
      return await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    };

    let res = await callGemini();

    // Handle 429 rate limit with retry
    if (res.status === 429) {
      const errorText = await res.text();
      try {
        const errorData = JSON.parse(errorText);
        const retryDelay = errorData.error?.details?.find(
          (d: { "@type": string; retryDelay?: string }) =>
            d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
        )?.retryDelay;

        if (retryDelay) {
          const delayMs = parseInt(retryDelay) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          res = await callGemini();
        }
      } catch {
        // If retry parsing fails, fall through to error response
      }
    }

    if (!res.ok) {
      const errorText = await res.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${res.status}`, details: errorText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: res.status }
      );
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "No content returned from Gemini" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const proposal = JSON.parse(text);

    return new Response(JSON.stringify({ proposal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
