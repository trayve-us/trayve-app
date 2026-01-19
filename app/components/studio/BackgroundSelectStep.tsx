import { CheckCircle, Search } from "lucide-react";
import type { BackgroundResource } from "../../lib/services/resources.service";
import { useState } from "react";

interface BackgroundSelectStepProps {
  backgrounds: BackgroundResource[] | undefined;
  selectedBackgroundId: string | null;
  onBackgroundSelect: (backgroundId: string) => void;
}

export function BackgroundSelectStep({
  backgrounds = [],
  selectedBackgroundId,
  onBackgroundSelect,
}: BackgroundSelectStepProps) {
  
  // Directly use backgrounds since search is removed
  const filteredBackgrounds = backgrounds;

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Select Background</h2>
        <p className="text-gray-500 mt-1">Choose a background for your image.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredBackgrounds.map((bg) => {
          const isSelected = selectedBackgroundId === bg.id;
          return (
            <div
              key={bg.id}
              onClick={() => onBackgroundSelect(bg.id)}
              className={`
                relative aspect-[4/5] rounded-xl cursor-pointer transition-all duration-200 group
                ${isSelected ? 'ring-2 ring-[#702dff] ring-offset-2' : 'hover:ring-2 hover:ring-gray-200 hover:ring-offset-1'}
              `}
            >
              <div className="absolute inset-0 bg-gray-100 rounded-xl overflow-hidden">
                {bg.thumbnail_url ? (
                  <img 
                    src={bg.thumbnail_url} 
                    alt={bg.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-200">
                    No Preview
                  </div>
                )}
                
                {/* Selection Overlay */}
                <div className={`absolute inset-0 transition-opacity duration-200 ${isSelected ? 'bg-[#702dff]/10' : 'opacity-0 group-hover:opacity-100 bg-black/5'}`} />
                
                {/* Name Badge */}
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium text-gray-700 text-center truncate shadow-sm">
                    {bg.name}
                  </div>
                </div>

                {/* Checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-white rounded-full p-0.5 text-[#702dff] shadow-sm">
                    <CheckCircle className="w-5 h-5 fill-[#702dff] text-white" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredBackgrounds.length === 0 && (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-500">No backgrounds found matching your search.</p>
          </div>
      )}
    </div>
  );
}
