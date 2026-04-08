import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface BootstrapProviderProps {
  children: ReactNode;
  wizard: ReactNode;
}

/**
 * Wraps the app and manages the bootstrap flow.
 * - No credentials + /setup route → show wizard Step 1 (platform admin setup)
 * - No credentials + any other route → redirect to /login
 * - Credentials exist + user authenticated + no workspace → show wizard (onboarding)
 * - Credentials exist + user authenticated + has workspace → show app
 */
export function BootstrapProvider({ children, wizard }: BootstrapProviderProps) {
  const { state } = useBootstrap();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();

  if (state === 'loading' || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#3B82F6]" />
          <p className="text-sm text-[#94A3B8]">Carregando...</p>
        </div>
      </div>
    );
  }

  // No Supabase credentials — only show wizard if explicitly on /setup
  if (state === 'no_credentials') {
    if (location.pathname === '/setup') {
      return <>{wizard}</>;
    }
    return <Navigate to="/login" replace />;
  }

  // Credentials exist but setup incomplete + user authenticated → onboarding wizard
  if (state === 'setup_incomplete' && isAuthenticated) {
    return <>{wizard}</>;
  }

  return <>{children}</>;
}
