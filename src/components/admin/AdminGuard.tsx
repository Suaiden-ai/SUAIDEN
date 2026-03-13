import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setStatus('unauthorized');
        return;
      }

      // Verificar role admin no perfil
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || profile?.role !== 'admin') {
        setStatus('unauthorized');
      } else {
        setStatus('authorized');
      }
    };

    checkAuth();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
