import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { StepNavigation } from "../components/studio/StepNavigation";
import { UploadStep } from "../components/studio/UploadStep";
import { ModelSelectStep } from "../components/studio/ModelSelectStep";
import { PoseSelectStep } from "../components/studio/PoseSelectStep";
import { ConfirmStep } from "../components/studio/ConfirmStep";
import { GenerationResults } from "../components/studio/GenerationResults";

// Mock data for testing - Replace with real API calls later
const MOCK_RESULTS = [
  {
    id: "1",
    url: "https://placehold.co/600x800/5537c9/white?text=Generated+Image+1",
    pose_name: "Front View",
  },
  {
    id: "2",
    url: "https://placehold.co/600x800/5537c9/white?text=Generated+Image+2",
    pose_name: "Side View",
  },
  {
    id: "3",
    url: "https://placehold.co/600x800/5537c9/white?text=Generated+Image+3",
    pose_name: "Back View",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ step: 1 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    if (action === "upload") {
      return json({ success: true, step: 2 });
    } else if (action === "selectModel") {
      return json({ success: true, step: 3 });
    } else if (action === "selectPose") {
      return json({ success: true, step: 4 });
    } else if (action === "generate") {
      // Mock generation success
      return json({ 
        success: true, 
        generated: true,
        message: "Generation completed!" 
      });
    }
  } catch (error) {
    return json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }

  return json({ success: false });
};

export default function Studio() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [currentStep, setCurrentStep] = useState(loaderData.step);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedPoses, setSelectedPoses] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [projectName, setProjectName] = useState("My Fashion Project");

  const steps = [
    { id: 1, title: "Upload Clothing" },
    { id: 2, title: "Select Model" },
    { id: 3, title: "Choose Poses" },
    { id: 4, title: "Confirm & Generate" },
  ];

  // Check if generation completed
  if (actionData?.generated && !showResults) {
    setShowResults(true);
  }

  const handleFileSelect = useCallback((file: File) => {
    if (file && file.type.startsWith("image/")) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }, []);

  const removeFile = useCallback(() => {
    setUploadedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
  };

  const handlePoseSelect = (poseId: string) => {
    if (selectedPoses.includes(poseId)) {
      setSelectedPoses(selectedPoses.filter((id) => id !== poseId));
    } else if (selectedPoses.length < 4) {
      setSelectedPoses([...selectedPoses, poseId]);
    }
  };

  const handleGenerate = () => {
    const formData = new FormData();
    formData.append("action", "generate");
    submit(formData, { method: "post" });
  };

  const handleBackToStudio = () => {
    setShowResults(false);
    setCurrentStep(1);
    setUploadedFile(null);
    setPreviewUrl(null);
    setSelectedModel(null);
    setSelectedPoses([]);
  };

  const handleStepClick = (stepId: number) => {
    if (canProceedToStep(stepId)) {
      setCurrentStep(stepId);
    }
  };

  const canProceedToStep = (stepId: number) => {
    if (stepId === 1) return true;
    if (stepId === 2) return uploadedFile !== null;
    if (stepId === 3) return uploadedFile !== null && selectedModel !== null;
    if (stepId === 4) return uploadedFile !== null && selectedModel !== null && selectedPoses.length > 0;  
    return false;
  };

  const handleNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === steps.length) {
      handleGenerate();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Show results screen if generation completed
  if (showResults) {
    return (
      <GenerationResults
        projectName={projectName}
        images={MOCK_RESULTS}
        onBack={handleBackToStudio}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Step Navigation Bar */}
      <StepNavigation
        currentStep={currentStep}
        steps={steps}
        onStepClick={handleStepClick}
        onPreviousStep={handlePreviousStep}
        onNextStep={handleNextStep}
        canProceedToStep={canProceedToStep}
        selectedPosesCount={selectedPoses.length}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 min-h-0 px-6 flex flex-col transition-all duration-300 ease-in-out"
        style={{
          position: "relative",
          height: "calc(100vh - 180px)",
        }}
      >
        {/* Content Container - Allow scrolling */}
        <div className="flex-1 pt-2 sm:pt-6 lg:pt-6 scrollbar-hide transition-all duration-300 ease-in-out overflow-y-auto">
          <div className="max-w-7xl px-0 sm:px-4 lg:px-0 pb-4 sm:pb-6 lg:pb-8">
            {/* Error/Success Messages */}
            {actionData?.error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg">
                <p className="text-sm text-destructive">{actionData.error}</p>
              </div>
            )}

            {actionData?.message && !showResults && (
              <div className="mb-6 p-4 bg-primary/10 border border-primary rounded-lg">
                <p className="text-sm text-primary">{actionData.message}</p>
              </div>
            )}

            <div className="px-2 sm:px-4 lg:px-0">
              {/* Step 1: Upload Clothing */}
              {currentStep === 1 && (
                <UploadStep
                  uploadedFile={uploadedFile}
                  previewUrl={previewUrl}
                  onFileSelect={handleFileSelect}
                  onRemoveFile={removeFile}
                />
              )}

              {/* Step 2: Select Model */}
              {currentStep === 2 && (
                <ModelSelectStep
                  selectedModel={selectedModel}
                  onModelSelect={handleModelSelect}
                />
              )}

              {/* Step 3: Choose Poses */}
              {currentStep === 3 && (
                <PoseSelectStep
                  selectedPoses={selectedPoses}
                  onPoseSelect={handlePoseSelect}
                />
              )}

              {/* Step 4: Confirm & Generate */}
              {currentStep === 4 && (
                <ConfirmStep
                  previewUrl={previewUrl}
                  selectedModel={selectedModel}
                  selectedPoses={selectedPoses}
                  onGenerate={handleGenerate}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
