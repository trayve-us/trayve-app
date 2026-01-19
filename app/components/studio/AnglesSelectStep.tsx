import { ActionList, Icon, Tooltip } from "@shopify/polaris";
import { CheckCircle } from "lucide-react";
import type { AngleResource } from "../../lib/services/resources.service";

interface AnglesSelectStepProps {
  angles: AngleResource[] | undefined;
  selectedAngles: string[];
  onAngleToggle: (angleId: string) => void;
}

export function AnglesSelectStep({
  angles = [],
  selectedAngles,
  onAngleToggle,
}: AnglesSelectStepProps) {

  // Group angles by type
  const groupedAngles = angles.reduce((acc, angle) => {
    const type = angle.angle_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(angle);
    return acc;
  }, {} as Record<string, AngleResource[]>);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Select Angles</h2>
        <p className="text-gray-500 mt-1">Choose the camera angles for your generation.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
        {Object.entries(groupedAngles).map(([type, groupAngles]) => (
          <div key={type} className="bg-white/50 rounded-xl p-4 border border-gray-100/50">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-[#702dff] rounded-full"></span>
              {type}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {groupAngles.map((angle) => {
                const isSelected = selectedAngles.includes(angle.id);
                
                // Determine image display style based on angle type
                let imageStyleClass = "object-cover object-center";
                if (angle.angle_type === 'top') {
                  imageStyleClass = "object-cover object-top";
                } else if (angle.angle_type === 'bottom') {
                  imageStyleClass = "object-cover object-bottom";
                } else if (angle.angle_type === 'full') {
                  imageStyleClass = "object-contain object-center bg-gray-50";
                }

                return (
                  <div
                    key={angle.id}
                    onClick={() => onAngleToggle(angle.id)}
                    className={`
                      relative aspect-square rounded-xl cursor-pointer transition-all duration-200 group
                      ${isSelected ? 'ring-2 ring-[#702dff] ring-offset-2' : 'hover:ring-2 hover:ring-gray-200 hover:ring-offset-1'}
                    `}
                  >
                    <div className="absolute inset-0 bg-gray-100 rounded-xl overflow-hidden">
                      {angle.image_url ? (
                        <img 
                          src={angle.image_url} 
                          alt={angle.name}
                          className={`w-full h-full transition-transform duration-300 group-hover:scale-110 ${imageStyleClass}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                      
                      {/* Selection Overlay */}
                      <div className={`absolute inset-0 transition-opacity duration-200 ${isSelected ? 'bg-[#702dff]/10' : 'opacity-0 group-hover:opacity-100 bg-black/5'}`} />
                      
                      {/* Checkmark */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-white rounded-full p-0.5 text-[#702dff] shadow-sm">
                          <CheckCircle className="w-4 h-4 fill-[#702dff] text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {angles.length === 0 && (
           <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
             <p className="text-gray-500">No angles available.</p>
           </div>
        )}
      </div>
    </div>
  );
}
