import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams, useFetcher } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { getUserCreditBalance } from "../lib/credits";
import { type SubscriptionTier } from "../lib/services/model-access.service";
import { getActiveSubscription, getSubscriptionHistory } from "../lib/services/subscription.service";
import { useState, useEffect } from "react";
import { CreditsDisplay } from "../components/CreditsDisplay";
import { UserProfile } from "../components/UserProfile";
import { UploadStep } from "../components/studio/UploadStep";
import { ModelSelectStep } from "../components/studio/ModelSelectStep";
import { PoseSelectStep } from "../components/studio/PoseSelectStep";
import { ConfirmStep } from "../components/studio/ConfirmStep";
import { Upload, Users, Wand2, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { TestingPanel } from "../components/TestingPanel";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const user = await getShopifyUserByShop(shop);
  const balance = user ? await getUserCreditBalance(user.trayve_user_id) : null;

  // Fetch actual subscription tier from database
  let subscriptionTier: SubscriptionTier = "free";
  
  if (user?.trayve_user_id) {
    const activeSubscription = await getActiveSubscription(user.trayve_user_id);
    
    if (activeSubscription && activeSubscription.status === "active") {
      // Map plan_tier to SubscriptionTier
      const planTier = activeSubscription.plan_tier;
      
      if (planTier === "professional") {
        subscriptionTier = "professional";
      } else if (planTier === "enterprise") {
        subscriptionTier = "enterprise";
      } else if (planTier === "creator") {
        subscriptionTier = "creator"; // Creator plan
      } else if (planTier === "free") {
        subscriptionTier = "free";
      }
      
      console.log(`✅ User ${user.trayve_user_id} has active ${planTier} subscription - tier: ${subscriptionTier}`);
    } else {
      // Check if user has a cancelled paid subscription with remaining credits
      const subscriptionHistory = await getSubscriptionHistory(user.trayve_user_id);
      const cancelledPaidPlan = subscriptionHistory.find(
        (sub) => sub.status === "cancelled" && sub.plan_tier !== "free"
      );
      
      if (cancelledPaidPlan && balance && balance.available_credits > 0) {
        // Maintain previous tier access while credits remain
        const planTier = cancelledPaidPlan.plan_tier;
        
        if (planTier === "professional") {
          subscriptionTier = "professional";
        } else if (planTier === "enterprise") {
          subscriptionTier = "enterprise";
        } else if (planTier === "creator") {
          subscriptionTier = "creator";
        }
        
        console.log(`✅ User ${user.trayve_user_id} has cancelled ${planTier} plan with ${balance.available_credits} credits remaining - maintaining tier: ${subscriptionTier}`);
      } else {
        console.log(`ℹ️ User ${user.trayve_user_id} has no active subscription - using free tier`);
      }
    }
  }

  return json({
    shop,
    user: user ? {
      email: user.shop_email || shop,
      shopName: user.shop_name || shop.replace('.myshopify.com', ''),
      subscriptionTier,
    } : null,
    credits: balance
      ? {
          available: balance.available_credits,
          total: balance.total_credits,
        }
      : { available: 0, total: 0 },
    testingMode: process.env.TESTING_MODE === "true",
  });
};

export default function Studio() {
  const { credits, user, testingMode } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedPoses, setSelectedPoses] = useState<string[]>([]);
  const [selectedPoseObjects, setSelectedPoseObjects] = useState<any[]>([]);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Check for subscription success message
  const subscribed = searchParams.get('subscribed');
  const planName = searchParams.get('plan');
  const creditsAdded = searchParams.get('credits');

  useEffect(() => {
    if (subscribed === 'true' && planName && creditsAdded) {
      setShowSuccessBanner(true);
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setShowSuccessBanner(false);
        // Clean up URL params
        searchParams.delete('subscribed');
        searchParams.delete('plan');
        searchParams.delete('credits');
        setSearchParams(searchParams, { replace: true });
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [subscribed, planName, creditsAdded, searchParams, setSearchParams]);

  const steps = [
    {
      id: 1,
      title: "Upload",
      subtitle: "Photos",
      icon: Upload,
      status: currentStep === 1 ? "current" : currentStep > 1 ? "complete" : "upcoming",
    },
    {
      id: 2,
      title: "Choose Model",
      subtitle: "AI Model Selection",
      icon: Users,
      status: currentStep === 2 ? "current" : currentStep > 2 ? "complete" : "upcoming",
    },
    {
      id: 3,
      title: "Select Poses",
      subtitle: "Pose Selection",
      icon: Wand2,
      status: currentStep === 3 ? "current" : currentStep > 3 ? "complete" : "upcoming",
    },
    {
      id: 4,
      title: "Generate & Results",
      subtitle: "AI Creation",
      icon: Sparkles,
      status: currentStep === 4 ? "current" : "upcoming",
    },
  ];

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepId: number) => {
    if (stepId <= currentStep) {
      setCurrentStep(stepId);
    }
  };

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setPreviewUrl(null);
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
  };

  const handlePoseSelect = (poseId: string) => {
    setSelectedPoses(prev => {
      if (prev.includes(poseId)) {
        return prev.filter(id => id !== poseId);
      } else if (prev.length < 4) {
        return [...prev, poseId];
      }
      return prev;
    });
  };

  const handleGenerate = async () => {
    const CREDITS_PER_IMAGE = 1000;
    const totalCredits = selectedPoses.length * CREDITS_PER_IMAGE;

    // Check if user has enough credits
    if (credits.available < totalCredits) {
      setGenerationError(`Insufficient credits. You need ${totalCredits} credits but only have ${credits.available}.`);
      return;
    }

    if (!uploadedFile) {
      setGenerationError("Please upload a clothing image first");
      return;
    }

    if (!selectedModel) {
      setGenerationError("Please select a model");
      return;
    }

    if (selectedPoses.length === 0) {
      setGenerationError("Please select at least one pose");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      // Step 1: Upload clothing image to Supabase Storage
      console.log("📤 Uploading clothing image...");
      
      const fileName = `${Date.now()}_${uploadedFile.name}`;
      const uploadFormData = new FormData();
      uploadFormData.append("file", uploadedFile);
      uploadFormData.append("bucket", "user-images");
      uploadFormData.append("path", `clothing/${fileName}`);

      const uploadResponse = await fetch("/api/storage/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success || !uploadResult.url) {
        setGenerationError(uploadResult.error || "Failed to upload clothing image");
        setIsGenerating(false);
        return;
      }

      const clothingImageUrl = uploadResult.url;
      console.log("✅ Clothing image uploaded:", clothingImageUrl);

      // Step 2: Deduct credits via API
      console.log("💳 Deducting credits...");
      
      const creditsResponse = await fetch("/api/credits/deduct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: totalCredits,
          description: `AI Generation: ${selectedPoses.length} images`,
          featureType: "ai_generation",
        }),
      });

      const creditsResult = await creditsResponse.json();

      if (!creditsResult.success) {
        setGenerationError(creditsResult.error || "Failed to deduct credits");
        setIsGenerating(false);
        return;
      }

      console.log("✅ Credits deducted:", creditsResult.creditsConsumed);
      console.log("✅ Remaining balance:", creditsResult.remainingBalance);

      // Step 3: Prepare poses array with URLs from selectedPoseObjects (only selected ones)
      const posesArray = selectedPoseObjects
        .filter(pose => selectedPoses.includes(pose.id))
        .map(pose => ({
          pose_id: pose.id,
          image_url: pose.image_url,
          pose_name: pose.pose_name || pose.name,
        }));

      console.log("📸 Sending poses:", posesArray.length, "poses");
      console.log("📝 Selected pose IDs:", selectedPoses);

      // Step 4: Execute the pipeline
      console.log("🚀 Starting pipeline execution...");
      
      const pipelineResponse = await fetch("/api/pipeline/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_model_id: selectedModel,
          clothing_image_url: clothingImageUrl,
          poses: posesArray,
          project_name: `Generation ${new Date().toLocaleString()}`,
          project_description: `AI try-on with ${selectedPoses.length} pose(s)`,
        }),
      });

      const pipelineResult = await pipelineResponse.json();

      if (!pipelineResult.success) {
        setGenerationError(pipelineResult.error || "Failed to start generation pipeline");
        setIsGenerating(false);
        return;
      }

      console.log("✅ Pipeline started:", pipelineResult);
      console.log(`✅ Credits deducted: ${creditsResult.creditsConsumed}, Remaining: ${creditsResult.remainingBalance}`);

      // Redirect to generation results page with the project ID
      navigate(`/app/generation-results/${pipelineResult.project_id}?generating=true`);
    } catch (error: any) {
      console.error("Generation error:", error);
      setGenerationError(error.message || "Failed to start generation");
      setIsGenerating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return uploadedFile !== null;
      case 2:
        return selectedModel !== null;
      case 3:
        return selectedPoses.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Page fullWidth>
      <TitleBar title="Virtual Try-On Studio" />

      {/* TOP NAVBAR WITH CREDITS */}
      <div style={{
        backgroundColor: "white",
        borderBottom: "1px solid #E1E3E5",
        padding: "16px 24px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "1400px",
          margin: "0 auto",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <img 
              src="/logo_trayve.png" 
              alt="Trayve" 
              style={{
                height: "32px",
                width: "auto",
              }}
            />
            
            {/* Navigation Tabs */}
            <nav style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => navigate("/app/studio")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#702dff",
                  backgroundColor: "rgba(112, 45, 255, 0.1)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Generate
              </button>
              <button
                onClick={() => navigate("/app/projects")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Projects
              </button>
              <button
                onClick={() => navigate("/app/pricing")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Pricing
              </button>
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CreditsDisplay />
            {user && <UserProfile email={user.email} shopName={user.shopName} />}
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {showSuccessBanner && (
        <div style={{
          backgroundColor: "#D1F4E0",
          borderBottom: "1px solid #9CDEBD",
          padding: "12px 24px",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "1400px",
            margin: "0 auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#00A663" />
                <path d="M6 10l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ color: "#004C3F", fontWeight: 500 }}>
                <strong>Payment successful!</strong> {creditsAdded} images have been added to your monthly allowance for the {planName}.
              </span>
            </div>
            <button
              onClick={() => {
                setShowSuccessBanner(false);
                searchParams.delete('subscribed');
                searchParams.delete('plan');
                searchParams.delete('credits');
                setSearchParams(searchParams, { replace: true });
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "#004C3F",
                fontSize: "20px",
                lineHeight: 1,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Container - Exact Trayve Design */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 120px)",
        backgroundColor: "#FAFBFC",
      }}>
        {/* Steps Navigation Bar */}
        <div style={{
          flexShrink: 0,
          backgroundColor: "white",
          borderBottom: "1px solid #E1E3E5",
          padding: "20px 24px",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            {/* Left: Step Indicators */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* All Steps */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {steps.map((step) => {
                  const isActive = step.id === currentStep;
                  const isComplete = step.status === "complete";
                  const isClickable = step.id <= currentStep;

                  return (
                    <button
                      key={step.id}
                      onClick={() => handleStepClick(step.id)}
                      disabled={!isClickable}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 24px",
                        backgroundColor: isActive ? "#702dff" : "#f3f4f6",
                        border: "none",
                        borderRadius: "100px",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: isActive ? "white" : "#6b7280",
                        cursor: isClickable ? "pointer" : "not-allowed",
                        transition: "all 0.2s ease",
                        opacity: isClickable ? 1 : 0.6,
                      }}
                      onMouseOver={(e) => {
                        if (isClickable && !isActive) {
                          e.currentTarget.style.backgroundColor = "#e5e7eb";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "#f3f4f6";
                        }
                      }}
                    >
                      <span>{step.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Next Button */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {currentStep < 4 && (
                <button
                  onClick={handleNextStep}
                  disabled={!canProceed()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 28px",
                    backgroundColor: canProceed() ? "#702dff" : "#e5e7eb",
                    border: "none",
                    borderRadius: "100px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: canProceed() ? "white" : "#9ca3af",
                    cursor: canProceed() ? "pointer" : "not-allowed",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    if (canProceed()) {
                      e.currentTarget.style.backgroundColor = "#5c24cc";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (canProceed()) {
                      e.currentTarget.style.backgroundColor = "#702dff";
                    }
                  }}
                >
                  <span>Next Step</span>
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{
          flex: 1,
          padding: "32px 24px",
          overflowY: "auto",
        }}>
          <div style={{
            maxWidth: "1400px",
            margin: "0 auto",
            width: "100%",
          }}>
            {/* Step 1: Upload */}
            {currentStep === 1 && (
              <UploadStep
                uploadedFile={uploadedFile}
                previewUrl={previewUrl}
                onFileSelect={handleFileSelect}
                onRemoveFile={handleRemoveFile}
              />
            )}

            {/* Step 2: Model Selection */}
            {currentStep === 2 && (
              <ModelSelectStep
                selectedModel={selectedModel}
                onModelSelect={handleModelSelect}
                subscriptionTier={user?.subscriptionTier || "free"}
              />
            )}

            {/* Step 3: Pose Selection */}
            {currentStep === 3 && (
              <PoseSelectStep
                selectedModel={selectedModel}
                selectedPoses={selectedPoses}
                onPoseSelect={handlePoseSelect}
                onPoseObjectsChange={setSelectedPoseObjects}
              />
            )}

            {/* Step 4: Confirm & Generate */}
            {currentStep === 4 && (
              <>
                {generationError && (
                  <div style={{
                    backgroundColor: "#FEE2E2",
                    borderLeft: "4px solid #EF4444",
                    padding: "16px",
                    marginBottom: "24px",
                    borderRadius: "8px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" fill="#EF4444" />
                        <path d="M10 6v5M10 13v1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <div>
                        <strong style={{ color: "#7F1D1D" }}>Error:</strong>
                        <span style={{ color: "#991B1B", marginLeft: "8px" }}>{generationError}</span>
                      </div>
                      <button
                        onClick={() => setGenerationError(null)}
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#7F1D1D",
                          fontSize: "20px",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
                <ConfirmStep
                  previewUrl={previewUrl}
                  selectedModel={selectedModel}
                  selectedPoses={selectedPoses}
                  selectedPoseObjects={selectedPoseObjects}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Testing Panel - Only visible in testing mode */}
      {testingMode && (
        <TestingPanel currentCredits={credits.available} />
      )}
    </Page>
  );
}
