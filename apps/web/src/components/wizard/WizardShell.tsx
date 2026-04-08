import { type ReactNode } from 'react';
import { useWizardStore } from '@/stores/wizard-store';

interface WizardShellProps {
  children: ReactNode;
}

const stepLabels = [
  'Supabase',
  'Conta',
  'Workspace',
  'Aparência',
  'Brand Kit',
  'IA',
  'Instagram',
  'Primeiro Carrossel',
];

export function WizardShell({ children }: WizardShellProps) {
  const { currentStep, totalSteps } = useWizardStore();

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="glass-header px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-bold text-[#F8FAFC]">
            Configuracao Inicial
          </h1>
          <p className="text-sm text-[#94A3B8]">
            Passo {currentStep} de {totalSteps}
          </p>
          {/* Progress bar */}
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  i + 1 <= currentStep ? 'progress-gradient shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-[rgba(59,130,246,0.08)]'
                }`}
              />
            ))}
          </div>
          {/* Step labels */}
          <div className="mt-2 flex justify-between">
            {stepLabels.map((label, i) => (
              <span
                key={label}
                className={`text-[10px] transition-colors ${
                  i + 1 <= currentStep
                    ? 'font-medium text-[#3B82F6]'
                    : 'text-[#94A3B8]/50'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-xl">{children}</div>
      </div>
    </div>
  );
}
