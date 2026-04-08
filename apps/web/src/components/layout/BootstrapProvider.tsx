import { type ReactNode } from 'react';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { Loader2 } from 'lucide-react';

interface BootstrapProviderProps {
  children: ReactNode;
  wizard: ReactNode;
}

/**
 * Wraps the app and manages the bootstrap flow.
 * Shows wizard if setup is incomplete, loading while checking,
 * or the main app if setup is complete.
 */
export function BootstrapProvider({ children, wizard }: BootstrapProviderProps) {
  const { state } = useBootstrap();

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#3B82F6]" />
          <p className="text-sm text-[#94A3B8]">Carregando...</p>
        </div>
      </div>
    );
  }

  if (state === 'no_credentials' || state === 'setup_incomplete') {
    return <>{wizard}</>;
  }

  return <>{children}</>;
}
