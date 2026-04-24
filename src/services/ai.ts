// Simple AI proposal generator service
// Calls the Supabase Edge Function generate-proposal, which holds the Gemini API key securely.

import { supabase, checkRateLimit, logRequestAttempt, type RateLimitResult } from './supabase';

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


async function generateWithEdgeFunction(description: string, locale: 'pt' | 'en'): Promise<GeneratedProposal | null> {
  const { data, error } = await supabase.functions.invoke('generate-proposal', {
    body: { description, locale }
  });

  if (error) {
    console.log('❌ Edge Function error:', error);
    return null;
  }

  if (data?.error) {
    console.log('❌ Erro retornado pela Edge Function:', data.error);
    return null;
  }

  return data?.proposal ?? null;
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

  try {
    const proposal = await generateWithEdgeFunction(description, locale);
    if (proposal) return proposal;
  } catch (error) {
    console.log('❌ Edge Function error:', error);
  }

  return null;
}


