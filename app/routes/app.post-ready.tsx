import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams, useFetcher } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { getUserCreditBalance } from "../lib/credits";
import { type SubscriptionTier } from "../lib/services/model-access.service";
import { getActiveSubscription, getSubscriptionHistory } from "../lib/services/subscription.service";
import { getPostReadyBackgrounds, getThemes } from "../lib/services/resources.service"; // Import Services
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { CreditsDisplay } from "../components/CreditsDisplay";
import { UserProfile } from "../components/UserProfile";
import { UploadStep } from "../components/studio/UploadStep";
import { ReferenceModelStep, type BaseModel } from "../components/studio/ReferenceModelStep";
import { ThemeSelectStep } from "../components/studio/ThemeSelectStep"; // To created
import { BackgroundSelectStep } from "../components/studio/BackgroundSelectStep";
import { PoseSelectStep } from "../components/studio/PoseSelectStep";
import { PostReadyConfirmStep } from "../components/studio/PostReadyConfirmStep";
import { GalleryResultCard } from "../components/results/GalleryResultCard";
import { Upload, Users, Wand2, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { TestingPanel } from "../components/TestingPanel";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const user = await getShopifyUserByShop(shop);
  const balance = user ? await getUserCreditBalance(user.trayve_user_id) : null;

  // Resource Fetching
  const [backgrounds, themes] = await Promise.all([
    getPostReadyBackgrounds(),
    getThemes()
  ]);

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
    resources: {
      backgrounds,
      themes
    }
  });
};

export default function PostReady() {
  const { credits, user, testingMode, resources } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<BaseModel | null>(null);
  const [selectedResultImage, setSelectedResultImage] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [imageCount, setImageCount] = useState(1);

  // Generation Settings
  const [aspectRatio, setAspectRatio] = useState("3:4");

  // New state for Results Gallery mode
  const [viewingResults, setViewingResults] = useState(false);
  const [modelResults, setModelResults] = useState<any[]>([]);

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
      title: "Reference Model",
      subtitle: "AI Model Selection",
      icon: Users,
      status: currentStep === 1 ? "current" : currentStep > 1 ? "complete" : "upcoming",
    },
    {
      id: 2,
      title: "Select Theme",
      subtitle: "Theme Selection",
      icon: Wand2,
      status: currentStep === 2 ? "current" : currentStep > 2 ? "complete" : "upcoming",
    },
    {
      id: 3,
      title: "Select Background",
      subtitle: "Background Selection",
      icon: Sparkles,
      status: currentStep === 3 ? "current" : currentStep > 3 ? "complete" : "upcoming",
    },
    {
      id: 4,
      title: "Generate",
      subtitle: "Final Output",
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

  const handleModelSelect = async (model: BaseModel) => {
    setSelectedModel(model);

    // Switch to Results View
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/models/${model.id}/results`);
      const data = await res.json();

      if (data.success) {
        setModelResults(data.results);
        setViewingResults(true);
      } else {
        console.error("Failed to fetch results:", data.error);
        setModelResults([]);
        setViewingResults(true);
      }
    } catch (e) {
      console.error("Error fetching results:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResultSelect = (imageUrl: string) => {
    setSelectedResultImage(imageUrl);
    setViewingResults(false);
    setCurrentStep(2); // Advance to Theme
  };

  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId);
  };

  const handleBackgroundSelect = (backgroundId: string) => {
    setSelectedBackground(backgroundId);
  };

  const handleGenerate = async () => {
    const COST = 1000;
    const totalCost = COST * imageCount;

    // Check if user has enough credits
    if (credits.available < totalCost) {
      setGenerationError(`Insufficient credits. You need ${totalCost} credits but only have ${credits.available}.`);
      return;
    }

    if (!selectedModel || !selectedTheme || !selectedBackground) {
      setGenerationError("Please maintain selection of model, theme, and background.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    // 1. Get Resources Data
    const backgroundObj = resources.backgrounds.find(b => b.id === selectedBackground);
    const themeObj = resources.themes.find(t => t.id === selectedTheme);

    // Fallbacks for prompts
    const backgroundPrompt = (backgroundObj as any)?.prompt || (backgroundObj as any)?.description || "Lifestyle Background";
    const themePrompt = (themeObj as any)?.prompt || (themeObj as any)?.description || "Social Media Style";

    // 2. Construct Poses (Duplicates for multiple variations)
    // We treat each desired image count as a "pose" to trigger multiple generations in the pipeline
    const poses = Array.from({ length: imageCount }).map((_, index) => ({
      // CRITICAL: Database requires valid UUID for pose_identifier
      pose_id: crypto.randomUUID(),
      // CRITICAL: Use the specific result image if selected (VTO result)
      image_url: selectedResultImage || selectedModel.image_url,
      pose_name: `Variation ${index + 1}`
    }));

    try {
      console.log("🚀 Starting generation...");

      const response = await fetch("/api/pipeline/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_model_id: selectedModel.id,
          // CRITICAL: Pass the specific image URL we are viewing (e.g. VTO result)
          clothing_image_url: selectedResultImage || selectedModel.image_url,
          project_name: `Post Ready - ${selectedModel.name || 'Model'}`,
          mode: 'social_media',
          prompts: {
            theme: themePrompt,
            background: backgroundPrompt
          },
          poses: poses
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Generation failed to start");
      }

      const executionId = data.execution_id;
      const projectId = data.project_id;
      console.log(`✅ Generation started: ${executionId}, Project: ${projectId}`);

      // Redirect to generation results page
      navigate(`/app/generation-results/${projectId}?generating=true`);

    } catch (error: any) {
      console.error("Generation error:", error);
      setGenerationError(error.message || "Failed to start generation");
      setIsGenerating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedModel !== null;
      case 2:
        return selectedTheme !== null;
      case 3:
        return selectedBackground !== null;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Page fullWidth>
      <TitleBar title="Post Ready" />

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
                Virtual Try-on
              </button>
              <button
                onClick={() => navigate("/app/shop-ready")}
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
                Shop Ready
              </button>
              <button
                onClick={() => navigate("/app/post-ready")}
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
                Post Ready
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
                <path d="M6 10l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        height: "calc(100vh - 73px)",
        backgroundColor: "#FAFBFC",
        overflow: "hidden",
      }}>
        {/* Steps Navigation Bar - Fixed */}
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
            maxWidth: "1400px",
            margin: "0 auto",
            width: "100%",
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
                        padding: "8px 16px",
                        backgroundColor: isActive ? "#702dff" : "#f3f4f6",
                        border: "none",
                        borderRadius: "100px",
                        fontSize: "13px",
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
              {currentStep < 4 && !viewingResults && (
                <button
                  onClick={handleNextStep}
                  disabled={!canProceed()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 20px",
                    backgroundColor: canProceed() ? "#702dff" : "#e5e7eb",
                    border: "none",
                    borderRadius: "100px",
                    fontSize: "13px",
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
          overflowX: "hidden",
        }}>
          <div style={{
            maxWidth: "1400px",
            margin: "0 auto",
            width: "100%",
          }}>
            {/* Step 1: Model Selection */}
            {currentStep === 1 && !viewingResults && (
              <ReferenceModelStep
                selectedModel={selectedModel?.id || null}
                onModelSelect={handleModelSelect}
                subscriptionTier={user?.subscriptionTier || "free"}
                showGenerationStats={true}
              />
            )}

            {/* Results Gallery Mode */}
            {viewingResults && (
              <div className="w-full">
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                  <button
                    onClick={() => {
                      setViewingResults(false);
                      setSelectedModel(null);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      color: "#374151",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.2s"
                    }}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                  <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#111827", margin: 0 }}>
                    Generated Results ({modelResults.length})
                  </h2>
                </div>

                {isGenerating ? (
                  <div style={{ textAlign: "center", padding: "60px" }}>
                    <div style={{ color: "#6b7280" }}>Loading results...</div>
                  </div>
                ) : modelResults.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "60px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "12px",
                    border: "1px dashed #d1d5db"
                  }}>
                    <p style={{ color: "#6b7280", margin: 0 }}>No results found for this model.</p>
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "24px"
                  }}>
                    {modelResults.map((result) => (
                      <GalleryResultCard
                        key={result.id}
                        image={{
                          id: result.id,
                          image_url: result.result_image_url || result.image_url,
                          upscaled_image_url: result.upscaled_image_url,
                          upscale_status: result.upscale_status,
                        }}
                        userTier={user?.subscriptionTier as any || 'free'}
                        onImageClick={() => handleResultSelect(result.result_image_url || result.image_url)}
                        onSelect={() => handleResultSelect(result.result_image_url || result.image_url)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Theme Selection */}
            {currentStep === 2 && (
              <ThemeSelectStep
                themes={resources?.themes}
                selectedThemeId={selectedTheme}
                onThemeSelect={handleThemeSelect}
              />
            )}

            {/* Step 3: Background Selection */}
            {currentStep === 3 && (
              <BackgroundSelectStep
                backgrounds={resources?.backgrounds}
                selectedBackgroundId={selectedBackground}
                onBackgroundSelect={handleBackgroundSelect}
              />
            )}

            {/* Step 4: Generate */}
            {currentStep === 4 && (
              <PostReadyConfirmStep
                previewUrl={previewUrl}
                selectedModelImage={selectedResultImage || selectedModel?.image_url}
                selectedThemeImage={resources.themes.find(t => t.id === selectedTheme)?.preview_url}
                selectedBackgroundImage={resources.backgrounds.find(b => b.id === selectedBackground)?.thumbnail_url || resources.backgrounds.find(b => b.id === selectedBackground)?.url}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                imageCount={imageCount}
                onImageCountChange={setImageCount}
              />
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
