import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Palette,
  Settings,
  PlusCircle,
  LogOut,
  LayoutTemplate,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/create', label: 'Novo Carrossel', icon: PlusCircle },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/settings/brand-kits', label: 'Brand Kits', icon: Palette },
  { href: '/settings', label: 'Configuracoes', icon: Settings },
];

export function AppShell({ children }: AppShellProps) {
  const { signOut } = useAuth();
  const { activeWorkspace } = useWorkspaceStore();
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col glass-sidebar">
        {/* Logo */}
        <div className="flex h-14 items-center px-4">
          {activeWorkspace?.logo_url ? (
            <img
              src={activeWorkspace.logo_url}
              alt={activeWorkspace.name}
              className="h-8 max-w-[140px] object-contain"
            />
          ) : (
            <span className="text-lg font-bold text-[#F8FAFC]">
              {activeWorkspace?.name ?? 'Plataforma'}
            </span>
          )}
        </div>

        <div className="h-[1px] w-full bg-[rgba(59,130,246,0.08)]" />

        {/* Workspace switcher */}
        <div className="px-2 py-2">
          <WorkspaceSwitcher />
        </div>

        <div className="h-[1px] w-full bg-[rgba(59,130,246,0.08)]" />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-[rgba(59,130,246,0.15)] text-[#3B82F6] border border-[rgba(59,130,246,0.25)] shadow-[0_0_20px_rgba(59,130,246,0.08)]'
                    : 'text-[#94A3B8] hover:bg-[rgba(59,130,246,0.06)] hover:text-[#F8FAFC] border border-transparent'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-[rgba(59,130,246,0.08)] p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-[#94A3B8] hover:text-[#F8FAFC]"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}
