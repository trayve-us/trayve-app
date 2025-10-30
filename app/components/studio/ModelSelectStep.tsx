import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { 
  enrichModelsWithAccess, 
  type SubscriptionTier, 
  type EnrichedModel 
} from "../../lib/model-access";

interface BaseModel {
  id: string;
  name: string;
  description?: string;
  gender: "male" | "female" | "unisex";
  body_type: "slim" | "athletic" | "curvy" | "plus-size";
  ethnicity?: string;
  age_range?: string;
  image_url: string;
  supabase_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ModelSelectStepProps {
  selectedModel: string | null;
  onModelSelect: (modelId: string) => void;
  subscriptionTier: SubscriptionTier;
}

export function ModelSelectStep({
  selectedModel,
  onModelSelect,
  subscriptionTier,
}: ModelSelectStepProps) {
  const [models, setModels] = useState<EnrichedModel<BaseModel>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedBodyType, setSelectedBodyType] = useState<string>("all");

  // Fetch models function
  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters: any = {
        is_active: true,
        promoted_only: false, // Show all active models, not just promoted
      };
      
      if (selectedGender !== "all") filters.gender = selectedGender;
      if (selectedBodyType !== "all") filters.body_type = selectedBodyType;

      console.log('🔍 Fetching models with filters:', filters);

      // Call local Shopify API (uses Supabase directly)
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters }),
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 API Response data:', data);
      
      if (data.success && data.models) {
        console.log(`✅ Received ${data.models.length} models from API`);
        
        // Enrich models with access information based on subscription tier
        const enrichedModels = enrichModelsWithAccess<BaseModel>(data.models, subscriptionTier);
        console.log('🔐 Enriched models count:', enrichedModels.length);
        
        setModels(enrichedModels);
      } else {
        console.warn('⚠️ No models returned');
        setModels([]);
      }
    } catch (error) {
      console.error("❌ Error fetching models:", error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch models on component mount and when filters change (with debouncing)
  useEffect(() => {
    // Debounce the API call to prevent rate limiting
    const timer = setTimeout(() => {
      fetchModels();
    }, 500); // Wait 500ms after last filter change

    return () => clearTimeout(timer);
  }, [selectedGender, selectedBodyType, subscriptionTier]);

  return (
    <div className="space-y-6 pb-20 sm:pb-24 md:pb-28">

      {/* Filters */}
      <div className="w-full px-3 sm:px-4 md:px-6">
        <div className="flex gap-4 flex-wrap">
          {/* Gender Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedGender("all")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedGender === "all" ? "#702dff" : "#f3f4f6",
                color: selectedGender === "all" ? "white" : "#6b7280",
                fontWeight: "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              All Genders
            </button>
            <button
              onClick={() => setSelectedGender("male")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedGender === "male" ? "#702dff" : "#f3f4f6",
                color: selectedGender === "male" ? "white" : "#6b7280",
                fontWeight: "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Male
            </button>
            <button
              onClick={() => setSelectedGender("female")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedGender === "female" ? "#702dff" : "#f3f4f6",
                color: selectedGender === "female" ? "white" : "#6b7280",
                fontWeight: "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Female
            </button>
          </div>

          {/* Body Type Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedBodyType("all")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedBodyType === "all" ? "#702dff" : "#f3f4f6",
                color: selectedBodyType === "all" ? "white" : "#6b7280",
                fontWeight: "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              All Body Types
            </button>
            <button
              onClick={() => setSelectedBodyType("slim")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedBodyType === "slim" ? "#702dff" : "#f3f4f6",
                color: selectedBodyType === "slim" ? "white" : "#6b7280",
                fontWeight: "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Slim
            </button>
            <button
              onClick={() => setSelectedBodyType("athletic")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedBodyType === "athletic" ? "#702dff" : "#f3f4f6",
                color: selectedBodyType === "athletic" ? "white" : "#6b7280",
                fontWeight: "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Athletic
            </button>
            <button
              onClick={() => setSelectedBodyType("curvy")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedBodyType === "curvy" ? "#702dff" : "#f3f4f6",
                color: selectedBodyType === "curvy" ? "white" : "#6b7280",
                fontWeight: "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Curvy
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ color: "#6b7280", fontSize: "16px" }}>
            Loading models...
          </div>
        </div>
      )}

      {/* Models Grid */}
      {!loading && models.length > 0 && (
        <div className="w-full px-3 sm:px-4 md:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
            {models.map((model) => {
              const isSelected = selectedModel === model.id;
              const isLocked = model.accessInfo.isLocked;

              return (
                <div
                  key={model.id}
                  onClick={() => {
                    if (!isLocked) {
                      onModelSelect(model.id);
                    }
                  }}
                  className="group cursor-pointer"
                  style={{
                    opacity: isLocked ? 0.7 : 1,
                    cursor: isLocked ? "not-allowed" : "pointer",
                  }}
                >
                  <div
                    className={`relative overflow-hidden rounded-xl transition-all duration-200 ${
                      isSelected
                        ? "ring-2 ring-primary shadow-lg"
                        : "hover:shadow-md"
                    }`}
                  >
                    {/* Model Image */}
                    <div className="relative aspect-[2/3] overflow-hidden">
                      <img
                        src={model.image_url}
                        alt={model.name}
                        className="w-full h-full object-cover object-top"
                        style={{
                          objectPosition: "center top",
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.parentElement!.innerHTML = `<div style="width: 100%; height: 100%; background: #f3f4f6; display: flex; align-items: center; justify-content: center;"><span style="color: #6b7280; font-size: 14px;">${model.name}</span></div>`;
                        }}
                      />

                      {/* Simple Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                      {/* Lock Badge - Top Left Corner (for locked models) */}
                      {isLocked && (
                        <div className="absolute top-3 left-3 z-20">
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary backdrop-blur-sm rounded-lg shadow-lg">
                            <Lock className="w-3.5 h-3.5 text-white" />
                            <span className="text-white text-xs font-medium">
                              Locked
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Selection Indicator */}
                      {!isLocked && (
                        <div className="absolute top-3 right-3">
                          <div
                            className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                              isSelected
                                ? "bg-primary border-primary"
                                : "bg-white/20 border-white/40 backdrop-blur-sm"
                            }`}
                          >
                            {isSelected && (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bottom Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-white/90 text-xs bg-black/40 px-2 py-1 rounded backdrop-blur-sm truncate font-medium">
                            {model.name}
                          </span>
                        </div>

                        {/* Model Details */}
                        <div className="mt-1 flex gap-1.5">
                          <span className="text-white/70 text-xs bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm capitalize">
                            {model.gender}
                          </span>
                          <span className="text-white/70 text-xs bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm capitalize">
                            {model.body_type}
                          </span>
                        </div>

                        {/* Selected State */}
                        {isSelected && !isLocked && (
                          <div className="mt-2 text-center">
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/90 backdrop-blur-sm rounded-md">
                              <span className="text-white text-xs font-medium">
                                Selected
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && models.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ color: "#6b7280", fontSize: "16px", marginBottom: "8px" }}>
            No models found
          </div>
          <div style={{ color: "#9ca3af", fontSize: "14px" }}>
            Try adjusting your filters
          </div>
        </div>
      )}
    </div>
  );
}
