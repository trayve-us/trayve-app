import React from 'react';
import { QualityBadge, type BadgeStatus } from './QualityBadge';
import { SelectionCheckbox } from './SelectionCheckbox';

interface GenerationImage {
  id: string;
  image_url: string; // This is the Standard Result (Try-On)
  // Legacy fields removed - we rely on image_url and upscaled_image_url only
  upscaled_image_url?: string;
  upscale_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'not_available';
  generation_record?: {
    removed_bg_url?: string;
  };
}

interface GalleryResultCardProps {
  image: GenerationImage;
  userTier: 'free' | 'creator' | 'professional' | 'enterprise';
  onImageClick?: () => void;
  onSelect?: () => void; // New prop for selecting the image
  // Removed actions
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  selectionMode?: boolean;
  className?: string;
  clothingImageUrl?: string;
}

/**
 * Gallery Result Card Component
 * Simplified version for Shop/Post Ready pages
 * - No Action Buttons (Download / Remove BG)
 * - Purely for display / selection
 */
export function GalleryResultCard({
  image,
  userTier,
  onImageClick,
  onSelect,
  isSelected = false,
  onSelectionChange,
  selectionMode = false,
  className = '',
  clothingImageUrl
}: GalleryResultCardProps) {
  // Determine tier capabilities
  const isProfessionalOrEnterprise = userTier === 'professional' || userTier === 'enterprise';
  
  // Determine badge status based on processing state
  const getBadgeStatus = (): BadgeStatus => {
    // PROFESSIONAL/ENTERPRISE TIER LOGIC
    if (isProfessionalOrEnterprise) {
      // Priority 1: Check if 4K upscale is complete (Final State - 4K Ready!)
      if (image.upscale_status === 'completed' && image.upscaled_image_url) {
        return '4k-ready';
      }
      
      // Priority 2: Check if enhanced upscale is processing (4K Processing)
      if (image.upscale_status === 'processing' || image.upscale_status === 'pending') {
         // Check if base image is ready while waiting
         if (image.image_url) {
             return '4k-processing'; // Valid base + waiting for 4K
         }
      }

      // Priority 3: Fallback - if Upscale Failed or Not Available, but we have Base Image
      // Show "Ready" (Standard Quality) instead of sticking on "Processing"
      if (image.image_url) {
          return '2k-ready';
      }
      
      return 'processing';
    }
    
    // FREE/CREATOR TIER LOGIC
    // Check if Try-On is complete (Base Ready - Final State)
    if (image.image_url) {
      // Use '2k-ready' badge type which is mapped to "Ready" text
      return '2k-ready';
    }
    
    // Default to processing
    return 'processing';
  };

  // Determine display URL based on what's available
  const getDisplayUrl = (): string => {
    // Determine display URL (Simplified for new pipeline)
    
    if (isProfessionalOrEnterprise) {
      // 1. Final 4K Result
      if (image.upscaled_image_url) {
        return image.upscaled_image_url;
      }
      
      // 2. Base Try-On Result (shown while processing 4K)
      if (image.image_url) {
        return image.image_url;
      }
      
      return clothingImageUrl || '';
    } else {
      // Free/Creator: Show Try-On result
      if (image.image_url) {
        return image.image_url;
      }

      return clothingImageUrl || '';
    }
  };

  const badgeStatus = getBadgeStatus();
  const displayUrl = getDisplayUrl();

  return (
    <div className={`group bg-background rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${isSelected ? 'ring-2 ring-primary scale-[1.02]' : ''} ${className}`}>
      {/* Image Container */}
      <div 
        className="relative aspect-[4/5] bg-muted overflow-hidden cursor-pointer"
        onClick={onImageClick}
      >
        <img 
          src={displayUrl}
          alt="Generated fashion model"
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Quality Badge (Top Left) - REMOVED per request */}
        {/* <div className="absolute top-3 left-3 z-10">
          <QualityBadge status={badgeStatus} />
        </div> */}
        
        {/* Selection Checkbox (only in selection mode) */}
        {selectionMode && onSelectionChange && (
          <SelectionCheckbox 
            isSelected={isSelected}
            onChange={onSelectionChange}
          />
        )}
        
        {/* Hover Overlay - Click to Select */}
        {onSelect && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
             <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
                className="px-4 py-2 bg-[#702dff] text-white backdrop-blur-sm shadow-lg rounded-full text-sm font-medium hover:bg-[#5c24cc] transition-colors flex items-center gap-2"
              >
                Select Image
              </button>
          </div>
        )}
      </div>
    </div>
  );
}
