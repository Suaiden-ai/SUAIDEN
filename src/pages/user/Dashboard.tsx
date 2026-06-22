import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Loader2 } from 'lucide-react';
import UserDashboard from './UserDashboard';
import DeveloperDashboard from './DeveloperDashboard';


const DashboardWrapper: React.FC = () => {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileData) {
          setRole(profileData.role);
        }
      } catch (err) {
        console.error('Erro ao obter a role do usuário no DashboardWrapper:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const lowerRole = role?.toLowerCase();

  if (lowerRole === 'developer') {
    return <DeveloperDashboard />;
  }

  // Padrão para 'user', 'admin' ou qualquer outro perfil
  return <UserDashboard />;
};

export default DashboardWrapper;
