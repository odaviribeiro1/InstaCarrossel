import { create } from 'zustand';

interface WizardState {
  currentStep: number;
  totalSteps: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConnecting: boolean;
  isRunningMigrations: boolean;
  migrationProgress: number;
  migrationTotal: number;
  currentMigration: string;
  setCurrentStep: (step: number) => void;
  setSupabaseCredentials: (url: string, anonKey: string) => void;
  setIsConnecting: (value: boolean) => void;
  setIsRunningMigrations: (value: boolean) => void;
  setMigrationProgress: (current: number, total: number, name: string) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  currentStep: 1,
  totalSteps: 8,
  supabaseUrl: '',
  supabaseAnonKey: '',
  isConnecting: false,
  isRunningMigrations: false,
  migrationProgress: 0,
  migrationTotal: 0,
  currentMigration: '',
  setCurrentStep: (step) => set({ currentStep: step }),
  setSupabaseCredentials: (url, anonKey) => set({ supabaseUrl: url, supabaseAnonKey: anonKey }),
  setIsConnecting: (value) => set({ isConnecting: value }),
  setIsRunningMigrations: (value) => set({ isRunningMigrations: value }),
  setMigrationProgress: (current, total, name) =>
    set({ migrationProgress: current, migrationTotal: total, currentMigration: name }),
  reset: () =>
    set({
      currentStep: 1,
      supabaseUrl: '',
      supabaseAnonKey: '',
      isConnecting: false,
      isRunningMigrations: false,
      migrationProgress: 0,
      migrationTotal: 0,
      currentMigration: '',
    }),
}));
