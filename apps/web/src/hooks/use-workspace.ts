import { useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import { getSupabaseClient } from '@/lib/supabase';
import type { Workspace } from '@content-hub/shared';

/**
 * Manages workspace resolution and switching.
 * Resolves workspace by hostname (custom_domain) or uses first available workspace.
 */
export function useWorkspace() {
  const {
    workspaces,
    activeWorkspace,
    members,
    userRole,
    loading,
    setWorkspaces,
    setActiveWorkspace,
    setMembers,
    setUserRole,
    setLoading,
  } = useWorkspaceStore();
  const { user } = useAuthStore();

  // Load workspaces on mount
  useEffect(() => {
    if (!user) return;

    async function loadWorkspaces() {
      const client = getSupabaseClient();
      if (!client) return;

      setLoading(true);

      try {
        // Get all workspaces the user is a member of
        const { data: memberRows } = await client
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user!.id);

        if (!memberRows || memberRows.length === 0) {
          setLoading(false);
          return;
        }

        const workspaceIds = memberRows.map((m) => m.workspace_id as string);

        const { data: workspaceRows } = await client
          .from('workspaces')
          .select('*')
          .in('id', workspaceIds);

        if (workspaceRows) {
          setWorkspaces(workspaceRows as Workspace[]);

          // Resolve active workspace by hostname
          const hostname = window.location.hostname;
          let resolved = workspaceRows.find(
            (w) => (w as Workspace).custom_domain === hostname
          ) as Workspace | undefined;

          // Fallback to first workspace
          if (!resolved && workspaceRows.length > 0) {
            resolved = workspaceRows[0] as Workspace;
          }

          if (resolved) {
            setActiveWorkspace(resolved);

            // Set user role for active workspace
            const memberRow = memberRows.find(
              (m) => m.workspace_id === resolved.id
            );
            if (memberRow) {
              setUserRole(memberRow.role as 'owner' | 'admin' | 'editor' | 'viewer');
            }

            // Apply brand colors
            applyBrandColors(resolved);
          }
        }
      } catch (err) {
        console.error('Error loading workspaces:', err);
      } finally {
        setLoading(false);
      }
    }

    void loadWorkspaces();
  }, [user, setWorkspaces, setActiveWorkspace, setUserRole, setLoading]);

  const switchWorkspace = useCallback(
    async (workspace: Workspace) => {
      setActiveWorkspace(workspace);
      applyBrandColors(workspace);

      if (!user) return;

      const client = getSupabaseClient();
      if (!client) return;

      const { data: memberRow } = await client
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspace.id)
        .eq('user_id', user.id)
        .single();

      if (memberRow) {
        setUserRole(memberRow.role as 'owner' | 'admin' | 'editor' | 'viewer');
      }
    },
    [user, setActiveWorkspace, setUserRole]
  );

  const loadMembers = useCallback(async () => {
    if (!activeWorkspace) return;

    const client = getSupabaseClient();
    if (!client) return;

    const { data } = await client
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', activeWorkspace.id);

    if (data) {
      setMembers(data);
    }
  }, [activeWorkspace, setMembers]);

  return {
    workspaces,
    activeWorkspace,
    members,
    userRole,
    loading,
    switchWorkspace,
    loadMembers,
  };
}

function applyBrandColors(workspace: Workspace) {
  if (workspace.brand_primary_color) {
    document.documentElement.style.setProperty(
      '--brand-primary',
      workspace.brand_primary_color
    );
  }
  if (workspace.brand_secondary_color) {
    document.documentElement.style.setProperty(
      '--brand-secondary',
      workspace.brand_secondary_color
    );
  }

  // Update favicon
  if (workspace.favicon_url) {
    const link =
      document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
      document.createElement('link');
    link.rel = 'icon';
    link.href = workspace.favicon_url;
    if (!link.parentNode) {
      document.head.appendChild(link);
    }
  }
}
