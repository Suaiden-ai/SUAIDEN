// Simple AI proposal generator service
// Usage prefers a secure proxy endpoint via VITE_AI_PROXY_URL.
// If not configured, falls back to a local heuristic generator.

import { checkRateLimit, logRequestAttempt, type RateLimitResult } from './supabase';

export type GeneratedProposal = {
  title: string;
  summary: string;
  sections: Array<{ heading: string; content: string[] }>;
  timeline: Array<{ phase: string; duration: string; details: string }>;
  budgetNote: string;
};

export type RateLimitError = {
  type: 'RATE_LIMIT_EXCEEDED';
  message: string;
  rateLimitInfo: RateLimitResult;
};

// Função para obter o IP do usuário
async function getUserIP(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (res.ok) {
      const data = await res.json();
      return data.ip || null;
    }
  } catch (error) {
    console.log('Erro ao obter IP:', error);
  }
  return null;
}

// Global guardrails applied to every prompt
function buildPrompt(description: string, locale: 'pt' | 'en'): string {
  const language = locale === 'pt' ? 'Portuguese (pt-BR)' : 'English';

  const globalRules = [
    `Write in ${language}.`,
    'Be concise, practical and free of hype.',
    'Stay strictly on the project scope; do not invent missing details.',
    'If information is insufficient, ask for clarifications briefly in the summary OR make minimal safe assumptions and state them explicitly as assumptions.',
    'Avoid sensitive, illegal or harmful content.',
    'Prefer bullet points and short paragraphs in strings where appropriate.',
    'Do not include markdown code fences or markdown headings; plain text only inside JSON strings.',
    'Keep timelines realistic; do not promise guaranteed results.',
    'Do not include pricing unless asked. If currency appears, use BRL format: R$ 12.345,67.',
    'All fields MUST be short and skimmable; avoid long paragraphs.',
  ].join('\n- ');

  const schemaInstruction = `Return ONLY valid JSON that matches this TypeScript type:\n` +
`type GeneratedProposal = {\n` +
`  title: string;\n` +
`  summary: string;\n` +
`  sections: Array<{ heading: string; content: string[] }>;\n` +
`  timeline: Array<{ phase: string; duration: string; details: string }>;\n` +
`  budgetNote: string;\n` +
`};\n` +
`Do not include markdown code fences.`;

  const formattingRules = [
    'title: 6–12 words, specific to the project.',
    'summary: 2–4 concise sentences. If assumptions are made, prefix with "Assumptions:".',
    'sections: 3–6 sections. Each section content is 3–6 bullet strings, each 6–18 words.',
    'timeline: 4–6 phases. For duration, use one of: "X–Y weeks", "X–Y days", "X–Y months", or "Ongoing"/"Contínuo". Keep units consistent with locale.',
    'timeline.details: 1–2 short sentences; avoid marketing language.',
    'budgetNote: one sentence; do NOT include prices unless explicitly requested.',
  ].join('\n- ');

  const localization = locale === 'pt'
    ? [
        'Use units in Portuguese: dias, semanas, meses, Contínuo.',
        'Use vírgula decimal apenas quando natural ao texto; evite números desnecessários.',
      ].join('\n- ')
    : [
        'Use units in English: days, weeks, months, Ongoing.',
      ].join('\n- ');

  const guardrails = `Global rules:\n- ${globalRules}`;

  return [
    schemaInstruction,
    guardrails,
    `Output formatting constraints:\n- ${formattingRules}`,
    `Localization rules:\n- ${localization}`,
    `User description:\n${description}`
  ].join('\n\n');
}


async function generateWithGemini(description: string, locale: 'pt' | 'en'): Promise<GeneratedProposal | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-pro';
  
  console.log('🔧 Gemini config:', { 
    hasApiKey: !!apiKey, 
    model, 
    apiKeyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined'
  });
  
  if (!apiKey) {
    console.log('❌ Nenhuma chave de API encontrada');
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = buildPrompt(description, locale);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.6,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  } as any;

  console.log('🚀 Fazendo requisição para Gemini...', { endpoint, bodySize: JSON.stringify(body).length });
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  console.log('📡 Resposta da API:', { 
    status: res.status, 
    ok: res.ok, 
    statusText: res.statusText 
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.log('❌ Erro na API:', errorText);
    
    // Se for erro 429 (quota exceeded), tentar novamente após delay
    if (res.status === 429) {
      try {
        const errorData = JSON.parse(errorText);
        const retryDelay = errorData.error?.details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')?.retryDelay;
        
        if (retryDelay) {
          const delayMs = parseInt(retryDelay) * 1000;
          console.log(`⏳ Aguardando ${delayMs/1000}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          // Tentar novamente
          console.log('🔄 Tentando novamente após delay...');
          const retryRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryText = retryData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (retryText) {
              const parsed = JSON.parse(retryText) as GeneratedProposal;
              console.log('✅ Retry bem-sucedido!');
              return parsed;
            }
          }
        }
      } catch (retryError) {
        console.log('❌ Erro no retry:', retryError);
      }
    }
    
    return null;
  }
  
  const data = await res.json();
  console.log('📦 Dados recebidos:', data);
  
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('📝 Texto extraído:', text ? `${text.substring(0, 100)}...` : 'null');
  
  if (!text) {
    console.log('❌ Nenhum texto encontrado na resposta');
    return null;
  }
  
  try {
    const parsed = JSON.parse(text) as GeneratedProposal;
    console.log('✅ JSON parseado com sucesso:', parsed);
    return parsed;
  } catch (parseError) {
    console.log('❌ Erro ao fazer parse do JSON:', parseError, 'Texto:', text);
    return null;
  }
}

export async function generateProposal(
  description: string,
  locale: 'pt' | 'en' = 'pt'
): Promise<GeneratedProposal | null | RateLimitError> {
  // Verificar rate limiting antes de processar
  const userIP = await getUserIP();
  
  if (userIP) {
    try {
      const rateLimitInfo = await checkRateLimit(userIP, 'ai_generation', 10, 24);
      
      if (rateLimitInfo.is_blocked) {
        console.log('🚫 Rate limit excedido para IP:', userIP, rateLimitInfo);
        
        const resetTime = new Date(rateLimitInfo.reset_time);
        const now = new Date();
        const hoursUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60 * 60));
        
        return {
          type: 'RATE_LIMIT_EXCEEDED',
          message: `Limite de requisições excedido. Você pode tentar novamente em ${hoursUntilReset} horas.`,
          rateLimitInfo
        };
      }
      
      // Registrar tentativa de requisição
      await logRequestAttempt(
        userIP, 
        'ai_generation', 
        navigator.userAgent, 
        document.referrer || undefined
      );
      
      console.log('✅ Rate limit OK para IP:', userIP, `(${rateLimitInfo.remaining_attempts} tentativas restantes)`);
    } catch (error) {
      console.log('❌ Erro ao verificar rate limit:', error);
      // Continuar mesmo se houver erro na verificação de rate limit
    }
  }

  const proxyUrl = import.meta.env.VITE_AI_PROXY_URL as string | undefined;

  if (proxyUrl) {
    try {
      const res = await fetch(`${proxyUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Ensure server receives the already-guardrailed prompt to enforce consistency if it forwards directly
        body: JSON.stringify({ description, locale, prompt: buildPrompt(description, locale) })
      });
      if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
      const data = await res.json();
      return data as GeneratedProposal;
    } catch (err) {
      console.log('❌ Proxy error:', err);
      return null;
    }
  }

  // Try Gemini directly from the client (requires VITE_GEMINI_API_KEY)
  try {
    const gem = await generateWithGemini(description, locale);
    if (gem) return gem;
  } catch (error) {
    console.log('❌ Gemini error:', error);
  }

  return null;
}


