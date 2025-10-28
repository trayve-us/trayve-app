import { ArrowLeft, ArrowRight, Wand2 } from "lucide-react";

interface Step {
  id: number;
  title: string;
}

interface StepNavigationProps {
  currentStep: number;
  steps: Step[];
  onStepClick: (step: number) => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  canProceedToStep: (step: number) => boolean;
  selectedPosesCount: number;
}

export function StepNavigation({
  currentStep,
  steps,
  onStepClick,
  onPreviousStep,
  onNextStep,
  canProceedToStep,
  selectedPosesCount,
}: StepNavigationProps) {
  return (
    <div className="flex-shrink-0 bg-background border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side: Step indicators on desktop, Back button + current step on mobile */}
        <div className="flex items-center space-x-3">
          {/* Mobile: Back button - only show if not on first step */}
          {currentStep > 1 && (
            <button
              onClick={onPreviousStep}
              className="lg:hidden text-muted-foreground hover:text-foreground px-2 py-1 hover:bg-muted rounded-md transition-colors flex items-center space-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Back</span>
            </button>
          )}

          {/* Mobile: Current step indicator */}
          <div className="flex items-center space-x-2 lg:hidden">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">
                {currentStep}
              </span>
            </div>
            <div className="hidden sm:block">
              <h3 className="text-lg font-semibold text-foreground">
                {steps[currentStep - 1]?.title}
              </h3>
            </div>
          </div>

          {/* Desktop: All step indicators */}
          <div className="hidden lg:flex items-center space-x-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => onStepClick(step.id)}
                  disabled={!canProceedToStep(step.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    step.id === currentStep
                      ? "bg-primary text-primary-foreground"
                      : step.id < currentStep
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : "text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <span>{step.title}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Next Step button */}
        <button
          onClick={onNextStep}
          disabled={
            currentStep === steps.length
              ? selectedPosesCount === 0
              : !canProceedToStep(currentStep + 1)
          }
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {currentStep === steps.length ? (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Generate</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Next Step</span>
              <span className="sm:hidden">Next</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
