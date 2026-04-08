import { type ReactNode } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

const roleHierarchy: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

interface RoleGuardProps {
  minRole: Role;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if the user has the minimum required role.
 */
export function RoleGuard({ minRole, children, fallback }: RoleGuardProps) {
  const { userRole } = useWorkspaceStore();

  if (!userRole) return fallback ? <>{fallback}</> : null;

  const userLevel = roleHierarchy[userRole];
  const requiredLevel = roleHierarchy[minRole];

  if (userLevel < requiredLevel) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
