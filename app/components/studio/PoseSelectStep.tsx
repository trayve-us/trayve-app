import { useState, useEffect } from "react";

interface ModelPose {
  id: string;
  base_model_id: string;
  name: string;
  description?: string;
  pose_type: "front" | "side" | "three-quarter" | "back" | "dynamic" | "seated";
  image_url: string;
  supabase_path: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface PoseSelectStepProps {
  selectedModel: string | null;
  selectedPoses: string[];
  onPoseSelect: (poseId: string) => void;
  onPoseObjectsChange?: (poses: ModelPose[]) => void;
}

export function PoseSelectStep({
  selectedModel,
  selectedPoses,
  onPoseSelect,
  onPoseObjectsChange,
}: PoseSelectStepProps) {
  const [poses, setPoses] = useState<ModelPose[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch poses function
  const fetchPoses = async () => {
    if (!selectedModel) {
      setPoses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      console.log('🔍 Fetching poses for model:', selectedModel);
      
      // Call local Shopify API (uses Supabase directly)
      const response = await fetch(
        `/api/models?type=poses&base_model_id=${selectedModel}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📡 Poses API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 Poses API Response:', data);
      
      if (data.success && data.poses) {
        console.log(`✅ Received ${data.poses.length} poses`);
        setPoses(data.poses);
        
        // Notify parent component of pose objects
        if (onPoseObjectsChange) {
          onPoseObjectsChange(data.poses);
        }
      } else {
        console.warn('⚠️ No poses returned');
        setPoses([]);
      }
    } catch (error) {
      console.error("❌ Error fetching poses:", error);
      setPoses([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch poses when model is selected (with debouncing)
  useEffect(() => {
    // Debounce to prevent rate limiting
    const timer = setTimeout(() => {
      fetchPoses();
    }, 300); // Wait 300ms

    return () => clearTimeout(timer);
  }, [selectedModel]);

  // Show message if no model selected
  if (!selectedModel) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <div style={{ color: "#6b7280", fontSize: "16px", marginBottom: "8px" }}>
          Please select a model first
        </div>
        <div style={{ color: "#9ca3af", fontSize: "14px" }}>
          Go back to the previous step to choose a model
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6 pb-20 sm:pb-24 md:pb-28">
      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ color: "#6b7280", fontSize: "16px" }}>
            Loading poses...
          </div>
        </div>
      )}

      {/* Poses Grid */}
      {!loading && poses.length > 0 && (
        <div className="w-full px-3 sm:px-4 md:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 w-full">
            {poses.map((pose) => {
              const isSelected = selectedPoses.includes(pose.id);
              const selectedIndex = selectedPoses.indexOf(pose.id);

              return (
                <div
                  key={pose.id}
                  onClick={() => onPoseSelect(pose.id)}
                  className="group cursor-pointer"
                >
                  <div
                    className={`relative overflow-hidden rounded-xl transition-all duration-200 ${
                      isSelected
                        ? "ring-2 ring-primary shadow-lg"
                        : "hover:shadow-md"
                    }`}
                  >
                    {/* Pose Image */}
                    <div className="relative overflow-hidden bg-gray-50">
                      <img
                        src={pose.image_url}
                        alt={pose.name}
                        style={{
                          width: "100%",
                          aspectRatio: "3/4",
                          objectFit: "contain",
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.parentElement!.innerHTML = `<div style="width: 100%; aspect-ratio: 3/4; background: #f3f4f6; display: flex; align-items: center; justify-content: center;"><span style="color: #6b7280; font-size: 14px;">${pose.name}</span></div>`;
                        }}
                      />

                      {/* Numbered Selection Indicator */}
                      <div className="absolute top-3 right-3">
                        <div
                          className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "bg-white/20 border-white/40 backdrop-blur-sm"
                          }`}
                        >
                          {isSelected ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                {selectedIndex + 1}
                              </span>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pose Info */}
                      <div className="absolute bottom-3 left-3 right-3">
                        <span className="text-white/90 text-xs bg-black/40 px-2 py-1 rounded backdrop-blur-sm font-medium capitalize">
                          {pose.pose_type || pose.name}
                        </span>
                      </div>

                      {/* Selected State */}
                      {isSelected && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary rounded-md shadow-lg">
                            <span className="text-white text-sm font-medium">
                              #{selectedIndex + 1}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && poses.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ color: "#6b7280", fontSize: "16px", marginBottom: "8px" }}>
            No poses available
          </div>
          <div style={{ color: "#9ca3af", fontSize: "14px" }}>
            This model doesn't have any poses yet
          </div>
        </div>
      )}
    </div>
  );
}
