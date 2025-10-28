import { Camera } from "lucide-react";

const CREDITS_PER_GENERATION = 1000;

interface ConfirmStepProps {
  previewUrl: string | null;
  selectedModel: string | null;
  selectedPoses: string[];
  onGenerate: () => void;
}

export function ConfirmStep({
  previewUrl,
  selectedModel,
  selectedPoses,
  onGenerate,
}: ConfirmStepProps) {
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
                    {selectedPoses.slice(0, 2).map((pose, index) => (
                      <div key={pose} className="relative">
                        <div className="aspect-[3/5] rounded-md overflow-hidden bg-muted border border-border flex items-center justify-center">
                          <span className="text-muted-foreground text-xs">
                            Pose {index + 1}
                          </span>
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium border border-background">
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
                  selectedPoses.length === 0
                }
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 sm:py-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                Generate {selectedPoses.length === 1 ? "Image" : "Images"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
