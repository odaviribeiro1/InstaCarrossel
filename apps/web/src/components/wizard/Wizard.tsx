import { useWizardStore } from '@/stores/wizard-store';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useEffect } from 'react';
import { WizardShell } from './WizardShell';
import { WizardStep1Supabase } from './WizardStep1Supabase';
import { WizardStepAuth } from './WizardStepAuth';
import { WizardStep2Workspace } from './WizardStep2Workspace';
import { WizardStep3WhiteLabel } from './WizardStep3WhiteLabel';
import { WizardStep4BrandKit } from './WizardStep4BrandKit';
import { WizardStep5AI } from './WizardStep5AI';
import { WizardStep6Instagram } from './WizardStep6Instagram';
import { WizardStep7FirstCarousel } from './WizardStep7FirstCarousel';

export function Wizard() {
  const { currentStep, setCurrentStep } = useWizardStore();
  const { state } = useBootstrap();

  // If credentials exist (setup started before), skip Step 1
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state === 'setup_incomplete' && currentStep === 1) {
      // Credentials exist but setup not complete — go to auth step
      setCurrentStep(2);
    }
  }, [state, setCurrentStep]);

  function renderStep() {
    switch (currentStep) {
      case 1:
        return <WizardStep1Supabase />;
      case 2:
        return <WizardStepAuth />;
      case 3:
        return <WizardStep2Workspace />;
      case 4:
        return <WizardStep3WhiteLabel />;
      case 5:
        return <WizardStep4BrandKit />;
      case 6:
        return <WizardStep5AI />;
      case 7:
        return <WizardStep6Instagram />;
      case 8:
        return <WizardStep7FirstCarousel />;
      default:
        return <WizardStep1Supabase />;
    }
  }

  return <WizardShell>{renderStep()}</WizardShell>;
}
