import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/jobs/use-toast';
import { Lock, Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/jobs/ui/button';
import { Input } from '../../components/jobs/ui/input';
import { Label } from '../../components/jobs/ui/label';
import { cn } from '@/lib/utils';
import { mapAuthError, isValidEmail, type AuthErrorField } from '../../lib/authErrors';

type Mode = 'login' | 'forgot';

const AdminLogin: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Erro inline: mensagem + campo a destacar.
  const [error, setError] = useState<{ message: string; field: AuthErrorField } | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Limpa o erro inline assim que o usuário corrige a entrada.
  const clearError = () => setError(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validação no cliente antes de bater no servidor.
    if (!isValidEmail(email)) {
      setError({ message: 'Informe um e-mail válido.', field: 'email' });
      return;
    }
    if (!password) {
      setError({ message: 'Informe sua senha.', field: 'password' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      // Verificar se é admin, user ou developer através do perfil.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (
        profileError ||
        !profile ||
        (profile.role !== 'admin' && profile.role !== 'user' && profile.role !== 'developer')
      ) {
        await supabase.auth.signOut();
        setError({
          message: 'Acesso restrito a administradores, desenvolvedores e usuários cadastrados.',
          field: 'form',
        });
        return;
      }

      toast({
        title: 'Bem-vindo de volta!',
        description: 'Login realizado com sucesso.',
      });

      navigate(profile.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      toast({
        title: 'Erro no login',
        description: mapped.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError({ message: 'Informe um e-mail válido para recuperação.', field: 'email' });
      return;
    }

    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;

      // Sucesso: mostramos confirmação. Não revelamos se o e-mail
      // existe ou não (boa prática de segurança).
      setResetSent(true);
      toast({
        title: 'E-mail enviado',
        description: 'Se houver uma conta com esse e-mail, você receberá as instruções.',
      });
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      toast({
        title: 'Não foi possível enviar',
        description: mapped.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  const hasFieldError = (field: AuthErrorField) => error?.field === field;
  const inputErrorClass = (field: AuthErrorField) =>
    hasFieldError(field) ? 'border-red-500/70 focus:ring-red-500/40' : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(210_100%_56%/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(210_100%_56%/0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card/50 backdrop-blur-xl border border-border p-8 rounded-2xl shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              {mode === 'login' ? 'Login' : 'Recuperar senha'}
            </h1>
            {mode === 'forgot' && !resetSent && (
              <p className="text-sm text-muted-foreground">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            )}
          </div>

          {/* Erro geral do formulário (não atrelado a um campo). */}
          <AnimatePresence>
            {error?.field === 'form' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Tela de confirmação de e-mail de recuperação ── */}
          {mode === 'forgot' && resetSent ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-500/10 p-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Se houver uma conta associada a <span className="text-white font-medium">{email}</span>,
                você receberá um e-mail com as instruções para redefinir sua senha.
              </p>
              <Button
                type="button"
                variant="hero"
                className="w-full h-12 text-base font-semibold"
                onClick={() => switchMode('login')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={mode === 'login' ? handleLogin : handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                  }}
                  autoFocus
                  required
                  className={cn('bg-muted/50 border-border focus:ring-primary/50', inputErrorClass('email'))}
                />
                {hasFieldError('email') && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error?.message}
                  </p>
                )}
              </div>

              {mode === 'login' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError();
                    }}
                    required
                    className={cn('bg-muted/50 border-border focus:ring-primary/50', inputErrorClass('password'))}
                  />
                  {hasFieldError('password') && (
                    <p className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {error?.message}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                variant="hero"
                className="w-full h-12 text-base font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {mode === 'login' ? 'Verificando...' : 'Enviando...'}
                  </>
                ) : mode === 'login' ? (
                  'Entrar'
                ) : (
                  'Enviar link de recuperação'
                )}
              </Button>

              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao login
                </button>
              )}
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
