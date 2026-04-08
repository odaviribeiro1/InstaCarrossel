import { create } from 'zustand';
import type { Workspace, WorkspaceMember } from '@content-hub/shared';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  members: WorkspaceMember[];
  userRole: WorkspaceMember['role'] | null;
  loading: boolean;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setMembers: (members: WorkspaceMember[]) => void;
  setUserRole: (role: WorkspaceMember['role'] | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  members: [],
  userRole: null,
  loading: true,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setMembers: (members) => set({ members }),
  setUserRole: (role) => set({ userRole: role }),
  setLoading: (loading) => set({ loading }),
}));
