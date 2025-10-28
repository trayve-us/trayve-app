interface ModelSelectStepProps {
  selectedModel: string | null;
  onModelSelect: (modelId: string) => void;
}

export function ModelSelectStep({
  selectedModel,
  onModelSelect,
}: ModelSelectStepProps) {
  // Mock model data
  const models = [
    { id: "model-1", name: "Model 1", image: "/studio/logo_anim.gif" },
    { id: "model-2", name: "Model 2", image: "/studio/logo_anim.gif" },
    { id: "model-3", name: "Model 3", image: "/studio/logo_anim.gif" },
    { id: "model-4", name: "Model 4", image: "/studio/logo_anim.gif" },
    { id: "model-5", name: "Model 5", image: "/studio/logo_anim.gif" },
    { id: "model-6", name: "Model 6", image: "/studio/logo_anim.gif" },
  ];

  return (
    <div className="space-y-6 pb-20 sm:pb-24 md:pb-28">
      <div className="w-full px-3 sm:px-4 md:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {models.map((model, index) => {
            const isSelected = selectedModel === model.id;

            return (
              <div
                key={model.id}
                onClick={() => onModelSelect(model.id)}
                className="group cursor-pointer"
              >
                <div
                  className={`relative overflow-hidden rounded-xl transition-all duration-200 ${
                    isSelected
                      ? "ring-2 ring-primary shadow-lg"
                      : "hover:shadow-md"
                  }`}
                >
                  {/* Model Image */}
                  <div className="relative aspect-[3/4.5] overflow-hidden">
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">
                        {model.name}
                      </span>
                    </div>

                    {/* Simple Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                    {/* Selection Indicator */}
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

                    {/* Bottom Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white/80 text-xs bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm truncate">
                          {model.name}
                        </span>
                      </div>

                      {/* Selected State */}
                      {isSelected && (
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
    </div>
  );
}
