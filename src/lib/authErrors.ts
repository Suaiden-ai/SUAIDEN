import type { AuthError } from '@supabase/supabase-js';

// ============================================================
// Tradução de erros de autenticação do Supabase para PT-BR.
//
// O Supabase devolve mensagens genéricas em inglês ("Invalid
// login credentials", etc). Aqui mapeamos para mensagens claras
// e, quando possível, indicamos qual campo do formulário deve
// destacar o erro (para feedback inline).
// ============================================================

export type AuthErrorField = 'email' | 'password' | 'form';

export interface MappedAuthError {
  /** Mensagem amigável em PT-BR. */
  message: string;
  /** Campo a destacar no formulário, ou 'form' para erro geral. */
  field: AuthErrorField;
}

/**
 * Traduz um erro de autenticação (ou mensagem crua) para uma
 * mensagem em PT-BR e o campo associado. Nunca lança.
 */
export function mapAuthError(error: unknown): MappedAuthError {
  const raw =
    (error as AuthError | Error | null)?.message?.toLowerCase().trim() ?? '';
  const status = (error as AuthError | null)?.status;

  // Credenciais inválidas (senha errada ou e-mail inexistente).
  // O Supabase não distingue os dois por segurança.
  if (raw.includes('invalid login credentials')) {
    return {
      message: 'E-mail ou senha incorretos. Verifique e tente novamente.',
      field: 'password',
    };
  }

  // E-mail ainda não confirmado.
  if (raw.includes('email not confirmed')) {
    return {
      message:
        'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.',
      field: 'email',
    };
  }

  // Rate limit / muitas tentativas.
  if (
    status === 429 ||
    raw.includes('too many requests') ||
    raw.includes('rate limit')
  ) {
    return {
      message: 'Muitas tentativas. Aguarde alguns instantes e tente de novo.',
      field: 'form',
    };
  }

  // E-mail mal formatado.
  if (raw.includes('invalid email') || raw.includes('unable to validate email')) {
    return { message: 'Endereço de e-mail inválido.', field: 'email' };
  }

  // Usuário não encontrado (alguns fluxos retornam isso).
  if (raw.includes('user not found')) {
    return { message: 'Não encontramos uma conta com esse e-mail.', field: 'email' };
  }

  // Senha muito curta (fluxo de definição de nova senha).
  if (raw.includes('password should be at least')) {
    return {
      message: 'A senha deve ter pelo menos 6 caracteres.',
      field: 'password',
    };
  }

  // Nova senha igual à atual.
  if (raw.includes('new password should be different')) {
    return {
      message: 'A nova senha deve ser diferente da anterior.',
      field: 'password',
    };
  }

  // Link de recuperação expirado/inválido.
  if (
    raw.includes('token has expired') ||
    raw.includes('invalid') && raw.includes('token')
  ) {
    return {
      message: 'O link de recuperação expirou ou é inválido. Solicite um novo.',
      field: 'form',
    };
  }

  // Falha de rede.
  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return {
      message: 'Falha de conexão. Verifique sua internet e tente novamente.',
      field: 'form',
    };
  }

  // Fallback: usa a mensagem original se houver, senão genérica.
  return {
    message:
      (error as Error | null)?.message ||
      'Não foi possível concluir a operação. Tente novamente.',
    field: 'form',
  };
}

/** Validação simples de formato de e-mail no cliente. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
