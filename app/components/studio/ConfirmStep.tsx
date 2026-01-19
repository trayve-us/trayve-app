import { Camera, ChevronDown, Check, RectangleVertical, RectangleHorizontal, Square, Monitor } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const CREDITS_PER_GENERATION = 1000;

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

interface ConfirmStepProps {
  previewUrl: string | null;
  selectedModel: string | null;
  selectedPoses: string[];
  selectedPoseObjects?: ModelPose[];
  onGenerate: () => void;
  isGenerating?: boolean;
  aspectRatio?: string;
  onAspectRatioChange?: (ratio: string) => void;
  imageCount?: number;
  onImageCountChange?: (count: number) => void;
}

const ASPECT_RATIOS = [
  { id: "9:16", label: "Vertical", icon: RectangleVertical },
  { id: "3:4", label: "Portrait", icon: RectangleVertical, recommended: true },
  { id: "1:1", label: "Square", icon: Square },
  { id: "4:3", label: "Landscape", icon: RectangleHorizontal },
  { id: "16:9", label: "Widescreen", icon: Monitor }, // Using Monitor as proxy for 16:9
];

const IMAGE_COUNTS = [1, 2, 3, 4];

function CustomSelect({ 
  value, 
  onChange, 
  options, 
  type = "text" 
}: { 
  value: string | number, 
  onChange: (val: any) => void, 
  options: any[], 
  type?: "text" | "aspect" 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => (type === 'aspect' ? opt.id : opt) === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#1a1c23] text-white rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
      >
        <div className="flex items-center gap-2">
           {type === 'aspect' && selectedOption?.icon && <selectedOption.icon className="w-4 h-4 text-gray-400" />}
           <span className="text-sm font-medium">
             {type === 'aspect' 
               ? `${selectedOption?.id} ${selectedOption?.label}` 
               : `${value} ${value === 1 ? 'image' : 'images'}`
             }
           </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#1a1c23] border border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {options.map((option) => {
             const isSelected = type === 'aspect' ? option.id === value : option === value;
             return (
              <div
                key={type === 'aspect' ? option.id : option}
                onClick={() => {
                  onChange(type === 'aspect' ? option.id : option);
                  setIsOpen(false);
                }}
                className={`
                  flex items-center justify-between px-4 py-3 cursor-pointer transition-colors
                  ${isSelected ? 'bg-[#702dff]/20 text-white' : 'text-gray-300 hover:bg-white/5'}
                `}
              >
                <div className="flex items-center gap-3">
                   {type === 'aspect' && (
                     <span className="font-bold text-sm w-8">{option.id}</span>
                   )}
                   <span className={type === 'aspect' ? "text-gray-400 text-sm" : "font-medium"}>
                     {type === 'aspect' ? option.label : `${option} ${option === 1 ? 'image' : 'images'}`}
                   </span>
                </div>
                
                {type === 'aspect' && option.recommended && (
                  <span className="text-[10px] text-[#4ade80] font-medium uppercase tracking-wider ml-auto mr-2">
                    Recommended
                  </span>
                )}
                
                {isSelected && <Check className="w-4 h-4 text-[#702dff]" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}

export function ConfirmStep({
  previewUrl,
  selectedModel,
  selectedPoses,
  selectedPoseObjects = [],
  onGenerate,
  isGenerating = false,
  aspectRatio,
  onAspectRatioChange,
  imageCount,
  onImageCountChange,
}: ConfirmStepProps) {
  // Get actual pose objects for the selected pose IDs
  const selectedPoseData = selectedPoseObjects.filter(pose => 
    selectedPoses.includes(pose.id)
  );

  return (
    <div className="w-full lg:max-w-7xl space-y-4 sm:space-y-6 lg:space-y-8 pb-8 sm:pb-12 lg:pb-0 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Left side - Uploaded clothing preview (2/3) */}
        <div className="lg:col-span-2 flex flex-col justify-center space-y-4 sm:space-y-6 lg:space-y-8 order-2 lg:order-1 pb-8 sm:pb-12 lg:pb-0">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-foreground">
              Your Clothing Preview
            </h2>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Ready to generate on your selected model
            </p>
          </div>

          <div className="flex justify-center items-center pb-6 sm:pb-8 lg:pb-0">
            {previewUrl ? (
              <div className="relative w-48 h-60 sm:w-56 sm:h-72 lg:w-64 lg:h-80 bg-white rounded-xl overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Uploaded clothing"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-48 h-60 sm:w-56 sm:h-72 lg:w-64 lg:h-80 bg-muted rounded-xl flex items-center justify-center border border-border">
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 mx-auto bg-card rounded-lg shadow-lg flex items-center justify-center border border-border">
                    <Camera className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      No Clothing
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Please upload clothing first
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Project summary card (1/3) */}
        <div className="lg:col-span-1 flex items-start justify-start order-1 lg:order-2">
          <div className="bg-card rounded-xl border border-border p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-4 lg:space-y-5 w-full">
            {/* Card Header */}
            <div className="text-center">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Project Summary
              </h3>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                Ready to generate
              </p>
            </div>

            {/* Selected Poses */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Poses ({selectedPoses.length})
              </h4>
              {selectedPoses.length > 0 ? (
                <div>
                  <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                    {selectedPoseData.slice(0, 2).map((pose, index) => (
                      <div key={pose.id} className="relative">
                        <div className="aspect-[3/5] rounded-md overflow-hidden bg-gray-50 border border-border">
                          <img
                            src={pose.image_url}
                            alt={pose.name || `Pose ${index + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 text-white rounded-full flex items-center justify-center text-xs font-medium border border-background" style={{ backgroundColor: "#702dff" }}>
                          {index + 1}
                        </div>
                      </div>
                    ))}
                    {selectedPoses.length > 2 && (
                      <div className="relative">
                        <div className="aspect-[3/5] rounded-md overflow-hidden bg-muted border border-border flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-lg sm:text-xl font-bold text-primary">
                              +{selectedPoses.length - 2}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              more
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-3 bg-muted rounded-lg border border-border text-center">
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    No poses selected
                  </p>
                </div>
              )}
            </div>

            {/* Configuration Selectors */}
            {(onAspectRatioChange || onImageCountChange) && (
              <div className="space-y-3 pt-2">
                 {onAspectRatioChange && aspectRatio && (
                   <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dimensions</label>
                      <CustomSelect 
                        value={aspectRatio} 
                        onChange={onAspectRatioChange} 
                        options={ASPECT_RATIOS} 
                        type="aspect"
                      />
                   </div>
                 )}
                 
                 {onImageCountChange && imageCount && (
                   <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Image Count</label>
                      <CustomSelect 
                        value={imageCount} 
                        onChange={onImageCountChange} 
                        options={IMAGE_COUNTS} 
                        type="text"
                      />
                   </div>
                 )}
              </div>
            )}

            {/* Generation Summary */}
            <div className="pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-border">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-muted-foreground">
                    Generation Count
                  </span>
                  <span className="text-foreground font-medium">
                    {selectedPoses.length}{" "}
                    {selectedPoses.length === 1 ? "image" : "images"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
                  <span className="text-foreground">Total Cost</span>
                  <span className="text-primary">
                    {selectedPoses.length * CREDITS_PER_GENERATION} credits
                  </span>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="pt-4 sm:pt-6 mt-2 sm:mt-4">
              <button
                onClick={onGenerate}
                disabled={
                  !previewUrl ||
                  !selectedModel ||
                  selectedPoses.length === 0 ||
                  isGenerating
                }
                className="w-full text-white py-2 sm:py-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                style={{ backgroundColor: isGenerating || !previewUrl || !selectedModel || selectedPoses.length === 0 ? "#e5e7eb" : "#702dff" }}
                onMouseOver={(e) => {
                  if (!isGenerating && previewUrl && selectedModel && selectedPoses.length > 0) {
                    e.currentTarget.style.backgroundColor = "#5c24cc";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isGenerating && previewUrl && selectedModel && selectedPoses.length > 0) {
                    e.currentTarget.style.backgroundColor = "#702dff";
                  }
                }}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  `Generate ${selectedPoses.length === 1 ? "Image" : "Images"}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
