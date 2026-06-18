import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Loader2 } from 'lucide-react';

interface KanbanGuardProps {
  children: React.ReactNode;
}

const KanbanGuard: React.FC<KanbanGuardProps> = ({ children }) => {
  const { boardId } = useParams<{ boardId: string }>();
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    const checkAccess = async () => {
      if (!boardId) {
        setStatus('unauthorized');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('unauthorized');
        return;
      }

      const userId = session.user.id;

      // 1. Verificar se o usuário é administrador
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        setStatus('unauthorized');
        return;
      }

      if (profile && profile.role === 'admin') {
        setStatus('authorized');
        return;
      }

      // 2. Verificar se é dono do quadro
      const { data: board, error: boardError } = await supabase
        .from('boards')
        .select('owner_id')
        .eq('id', boardId)
        .maybeSingle();

      if (boardError) {
        setStatus('unauthorized');
        return;
      }

      if (board && board.owner_id === userId) {
        setStatus('authorized');
        return;
      }

      // 3. Verificar se é membro do quadro
      const { data: member, error: memberError } = await supabase
        .from('board_members')
        .select('board_id')
        .eq('board_id', boardId)
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) {
        setStatus('unauthorized');
        return;
      }

      if (member) {
        setStatus('authorized');
      } else {
        setStatus('unauthorized');
      }
    };

    checkAccess();
  }, [boardId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default KanbanGuard;
