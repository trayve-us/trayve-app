interface PoseSelectStepProps {
  selectedPoses: string[];
  onPoseSelect: (poseId: string) => void;
}

export function PoseSelectStep({
  selectedPoses,
  onPoseSelect,
}: PoseSelectStepProps) {
  // Mock pose data
  const poses = [
    { id: "pose-1", name: "Pose 1", image: "/studio/logo_anim.gif" },
    { id: "pose-2", name: "Pose 2", image: "/studio/logo_anim.gif" },
    { id: "pose-3", name: "Pose 3", image: "/studio/logo_anim.gif" },
    { id: "pose-4", name: "Pose 4", image: "/studio/logo_anim.gif" },
    { id: "pose-5", name: "Pose 5", image: "/studio/logo_anim.gif" },
    { id: "pose-6", name: "Pose 6", image: "/studio/logo_anim.gif" },
    { id: "pose-7", name: "Pose 7", image: "/studio/logo_anim.gif" },
    { id: "pose-8", name: "Pose 8", image: "/studio/logo_anim.gif" },
  ];

  return (
    <div className="max-w-7xl space-y-6 pb-20 sm:pb-24 md:pb-28">
      <div className="w-full px-3 sm:px-4 md:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 w-full">
          {poses.map((pose, index) => {
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
                  <div className="relative overflow-hidden">
                    <div className="w-full aspect-[3/4] bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">
                        {pose.name}
                      </span>
                    </div>

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

                    {/* Selected State */}
                    {isSelected && (
                      <div className="absolute bottom-3 left-3 right-3 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary rounded-md">
                          <span className="text-white text-xs font-medium">
                            Selected #{selectedIndex + 1}
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
    </div>
  );
}
