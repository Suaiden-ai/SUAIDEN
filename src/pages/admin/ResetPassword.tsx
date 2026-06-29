import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/jobs/use-toast';
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/jobs/ui/button';
import { Input } from '../../components/jobs/ui/input';
import { Label } from '../../components/jobs/ui/label';
import { cn } from '@/lib/utils';
import { mapAuthError, type AuthErrorField } from '../../lib/authErrors';

const MIN_PASSWORD_LENGTH = 6;

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ message: string; field: AuthErrorField } | null>(null);
  // Garante que o usuário chegou com um link de recuperação válido.
  const [validLink, setValidLink] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Ao abrir a página, o Supabase processa o token do link e cria
  // uma sessão de recuperação. Detectamos isso via getSession e o
  // evento PASSWORD_RECOVERY.
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setValidLink(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) setValidLink(true);
    });

    // Se em ~2.5s não houver sessão, o link provavelmente é inválido.
    const timer = setTimeout(() => {
      if (mounted) setValidLink((prev) => (prev === null ? false : prev));
    }, 2500);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const clearError = () => setError(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError({ message: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, field: 'password' });
      return;
    }
    if (password !== confirm) {
      setError({ message: 'As senhas não coincidem.', field: 'password' });
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setDone(true);
      toast({
        title: 'Senha redefinida!',
        description: 'Você já pode entrar com sua nova senha.',
      });

      // Encerra a sessão de recuperação e leva ao login após um instante.
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      toast({
        title: 'Não foi possível redefinir',
        description: mapped.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasFieldError = (field: AuthErrorField) => error?.field === field;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-[linear-gradient(hsl(210_100%_56%/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(210_100%_56%/0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card/50 backdrop-blur-xl border border-border p-8 rounded-2xl shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Definir nova senha</h1>
          </div>

          {/* Link inválido / expirado */}
          {validLink === false && !done ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-red-500/10 p-3">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Este link de recuperação é inválido ou expirou. Solicite um novo a partir da tela de login.
              </p>
              <Button
                type="button"
                variant="hero"
                className="w-full h-12 text-base font-semibold"
                onClick={() => navigate('/login')}
              >
                Voltar ao login
              </Button>
            </div>
          ) : done ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-500/10 p-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Senha redefinida com sucesso! Redirecionando para o login...
              </p>
            </div>
          ) : validLink === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence>
                {error?.field === 'form' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Nova senha
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  autoFocus
                  required
                  className={cn(
                    'bg-muted/50 border-border focus:ring-primary/50',
                    hasFieldError('password') && 'border-red-500/70 focus:ring-red-500/40'
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Confirmar nova senha
                </Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    clearError();
                  }}
                  required
                  className={cn(
                    'bg-muted/50 border-border focus:ring-primary/50',
                    hasFieldError('password') && 'border-red-500/70 focus:ring-red-500/40'
                  )}
                />
                {hasFieldError('password') && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error?.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full h-12 text-base font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Redefinir senha'
                )}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
