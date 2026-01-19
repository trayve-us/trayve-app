import { Camera, ChevronDown, Check, RectangleVertical, RectangleHorizontal, Square, Monitor } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const CREDITS_PER_GENERATION = 1000;

const ASPECT_RATIOS = [
  { id: "9:16", label: "Vertical", icon: RectangleVertical },
  { id: "3:4", label: "Portrait", icon: RectangleVertical, recommended: true },
  { id: "1:1", label: "Square", icon: Square },
  { id: "4:3", label: "Landscape", icon: RectangleHorizontal },
  { id: "16:9", label: "Widescreen", icon: Monitor },
];



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
              : `${value}`
            }
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#1a1c23] border border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 top-full">
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
                    {type === 'aspect' ? option.label : `${option}`}
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

interface ShopReadyConfirmStepProps {
  previewUrl: string | null;
  selectedModelImage?: string;
  selectedBackgroundImage?: string;
  onGenerate: () => void;
  isGenerating?: boolean;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;

  generationCount: number; // Number of images to be generated (e.g. from angles or poses)
  selectedAnglesData?: { id: string; name: string; image_url: string }[];
}

export function ShopReadyConfirmStep({
  previewUrl,
  selectedModelImage,
  selectedBackgroundImage,
  onGenerate,
  isGenerating = false,
  aspectRatio,
  onAspectRatioChange,

  generationCount,
  selectedAnglesData
}: ShopReadyConfirmStepProps) {

  return (
    <div className="w-full lg:max-w-7xl space-y-4 sm:space-y-6 lg:space-y-8 pb-8 sm:pb-12 lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Left side - Uploaded clothing preview (2/3) */}
        <div className="lg:col-span-2 flex flex-col justify-center space-y-4 sm:space-y-6 lg:space-y-8 order-2 lg:order-1 pb-8 sm:pb-12 lg:pb-0">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Your Selection Preview
            </h2>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Ready to generate with your selected assets
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 pb-6 sm:pb-8 lg:pb-0">
            {/* Model (Virtual Try-On Result) */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-48 h-64 bg-muted rounded-xl overflow-hidden shadow-md border border-border transition-transform hover:scale-105 ring-offset-2 ring-primary/20 hover:ring-2">
                {selectedModelImage ? (
                  <img src={selectedModelImage} alt="Virtual Try-On Result" className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">None</div>
                )}
              </div>
              <span className="text-sm font-medium text-foreground/80">Virtual Try-On Result</span>
            </div>

            {/* Angles */}
            {selectedAnglesData && selectedAnglesData.length > 0 ? (
              selectedAnglesData.map((angle) => (
                <div key={angle.id} className="flex flex-col items-center gap-3">
                  <div className="relative w-48 h-64 bg-white rounded-xl overflow-hidden shadow-md border border-border transition-transform hover:scale-105 ring-offset-2 ring-primary/20 hover:ring-2">
                    <img
                      src={angle.image_url}
                      alt={angle.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground/80">{angle.name}</span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-48 h-64 bg-white rounded-xl overflow-hidden shadow-md border border-border flex items-center justify-center text-muted-foreground bg-muted">
                  <span className="text-xs">No Angles Selected</span>
                </div>
              </div>
            )}



            {/* Background */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-48 h-64 bg-muted rounded-xl overflow-hidden shadow-md border border-border transition-transform hover:scale-105 ring-offset-2 ring-primary/20 hover:ring-2">
                {selectedBackgroundImage ? (
                  <img src={selectedBackgroundImage} alt="Background" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">None</div>
                )}
              </div>
              <span className="text-sm font-medium text-foreground/80">Background</span>
            </div>
          </div>
        </div>

        {/* Right side - Project summary card (1/3) */}
        <div className="lg:col-span-1 flex items-start justify-start order-1 lg:order-2">
          <div className="bg-card rounded-xl border border-border p-5 space-y-5 w-full">
            {/* Card Header */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">
                Generation Settings
              </h3>
            </div>

            {/* Configuration Selectors */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dimensions</label>
                <CustomSelect
                  value={aspectRatio}
                  onChange={onAspectRatioChange}
                  options={ASPECT_RATIOS}
                  type="aspect"
                />
              </div>


            </div>

            {/* Generation Summary */}
            <div className="pt-6 mt-6 border-t border-border">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    Estimated Output
                  </span>
                  <span className="text-foreground font-medium">
                    {generationCount} images
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-foreground">Total Cost</span>
                  <span className="text-primary">
                    {(generationCount) * CREDITS_PER_GENERATION} credits
                  </span>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="pt-4 mt-2">
              <button
                onClick={onGenerate}
                disabled={isGenerating}
                className={`
                  w-full py-4 px-6 rounded-lg font-bold text-white text-lg
                  transform transition-all duration-200
                  ${isGenerating
                    ? 'bg-primary/50 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 hover:scale-[1.02] hover:shadow-lg shadow-md'
                  }
                `}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Generate Images</span>
                    <div className="bg-white/20 px-2 py-0.5 rounded text-sm">
                      {(generationCount) * CREDITS_PER_GENERATION} c
                    </div>
                  </div>
                )}
              </button>


            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
