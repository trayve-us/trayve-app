import React from 'react';
import { QualityBadge, type BadgeStatus } from './QualityBadge';
import { SelectionCheckbox } from './SelectionCheckbox';

interface GenerationImage {
  id: string;
  image_url: string;
  basic_upscale_url?: string;
  basic_upscale_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'not_available';
  upscaled_image_url?: string;
  upscale_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'not_available';
  face_swap_image_url?: string;
  face_swap_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'not_available';
  generation_record?: {
    removed_bg_url?: string;
  };
}

interface ResultCardProps {
  image: GenerationImage;
  userTier: 'free' | 'creator' | 'professional' | 'enterprise';
  onImageClick: () => void;
  onDownload: () => void;
  onRemoveBackground: () => void;
  isRemovingBg?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  selectionMode?: boolean;
  className?: string;
  clothingImageUrl?: string;
}

/**
 * Result Card Component
 * Main image card supporting 6 distinct states:
 * 1. 4K Ready (Professional/Enterprise - all steps complete)
 * 2. 4K Processing (enhanced upscale in progress)
 * 3. Finalizing (face swap processing)
 * 4. 2K Ready (basic upscale complete for Free/Creator)
 * 5. BG Removed (background removal complete)
 * 6. Processing (initial generation)
 */
export function ResultCard({
  image,
  userTier,
  onImageClick,
  onDownload,
  onRemoveBackground,
  isRemovingBg = false,
  isSelected = false,
  onSelectionChange,
  selectionMode = false,
  className = '',
  clothingImageUrl
}: ResultCardProps) {
  // Determine tier capabilities
  const isProfessionalOrEnterprise = userTier === 'professional' || userTier === 'enterprise';
  const hasBgRemoved = !!image.generation_record?.removed_bg_url;
  
  // Determine badge status based on processing state
  const getBadgeStatus = (): BadgeStatus => {
    // Check if face swap is complete (4K Ready)
    if (isProfessionalOrEnterprise && image.face_swap_status === 'completed' && image.face_swap_image_url) {
      return '4k-ready';
    }
    
    // Check if enhanced upscale (4K) is complete without face swap (4K Ready)
    if (isProfessionalOrEnterprise && image.upscale_status === 'completed' && image.upscaled_image_url) {
      return '4k-ready';
    }
    
    // Check if face swap is processing (Finalizing)
    if (isProfessionalOrEnterprise && image.face_swap_status === 'processing') {
      return 'finalizing';
    }
    
    // Check if enhanced upscale is processing (4K Processing)
    if (isProfessionalOrEnterprise && image.upscale_status === 'processing') {
      return '4k-processing';
    }
    
    // Check if basic upscale is complete (2K Ready)
    if (image.basic_upscale_status === 'completed' && image.basic_upscale_url) {
      return '2k-ready';
    }
    
    // Default to processing
    return 'processing';
  };

  // Determine display URL based on what's available
  const getDisplayUrl = (): string => {
    // Priority order for display:
    // 1. Face swap (if available)
    // 2. Enhanced upscale 4K (if available)
    // 3. Basic upscale 2K (if available and NOT Pro/Enterprise)
    // 4. Original try-on result
    // 5. Clothing image (ONLY if no results at all yet)
    
    // Show clothing image ONLY during initial processing when we have NO results yet
    const hasAnyResult = image.basic_upscale_url || image.upscaled_image_url || image.face_swap_image_url || image.image_url;
    if (!hasAnyResult && clothingImageUrl) {
      return clothingImageUrl;
    }
    
    // For professional/enterprise, show best available (fallback chain)
    // SKIP basic_upscale_url (2K) for Pro/Enterprise - they go Try-On → 4K → Face Swap
    if (isProfessionalOrEnterprise) {
      return image.face_swap_image_url || 
             image.upscaled_image_url || 
             image.image_url ||  // Use try-on image, NOT 2K
             clothingImageUrl || 
             '';
    }
    
    // For free/creator, show basic upscale or original
    return image.basic_upscale_url || 
           image.image_url || 
           clothingImageUrl || 
           '';
  };

  const badgeStatus = getBadgeStatus();
  const displayUrl = getDisplayUrl();

  // Download button text
  const getDownloadText = () => {
    if (hasBgRemoved) {
      return 'Download ZIP';
    }
    if (badgeStatus === '4k-ready') {
      return 'Download';
    }
    if (badgeStatus === '4k-processing' || badgeStatus === 'finalizing') {
      return 'Download';
    }
    return 'Download';
  };

  // Remove BG button state
  const showRemoveBgButton = !hasBgRemoved && userTier !== 'free';
  const removeBgDisabled = isRemovingBg || badgeStatus === 'processing';

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
        
        {/* Quality Badge (Top Left) */}
        <div className="absolute top-3 left-3 z-10">
          <QualityBadge status={badgeStatus} />
        </div>
        
        {/* Selection Checkbox (only in selection mode) */}
        {selectionMode && onSelectionChange && (
          <SelectionCheckbox 
            isSelected={isSelected}
            onChange={onSelectionChange}
          />
        )}
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button className="px-4 py-2 bg-white/95 text-foreground backdrop-blur-sm border border-border shadow-lg rounded-md text-sm font-medium hover:bg-white transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            View Full Size
          </button>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="p-3">
        <div className="flex gap-2">
          {/* Download Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            {getDownloadText()}
          </button>
          
          {/* Remove BG Button */}
          {showRemoveBgButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveBackground();
              }}
              disabled={removeBgDisabled}
              className={`
                flex-1 px-3 py-2 
                bg-muted/30 
                border border-dashed border-border 
                rounded-md 
                text-sm font-medium 
                text-muted-foreground 
                transition-colors 
                flex items-center justify-center
                ${removeBgDisabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:border-amber-500 hover:text-amber-600'
                }
              `}
            >
              {isRemovingBg ? (
                <>
                  <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  Processing...
                </>
              ) : (
                'Remove BG'
              )}
            </button>
          )}
          
          {/* BG Removed Button (shows after BG removal complete) */}
          {hasBgRemoved && (
            <button
              className="flex-1 px-3 py-2 bg-green-50 border border-green-500 text-green-600 rounded-md text-sm font-medium flex items-center justify-center gap-1"
              disabled
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
              </svg>
              BG Removed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
