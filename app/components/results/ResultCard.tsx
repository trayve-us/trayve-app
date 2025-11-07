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
  onUpgradeClick?: () => void;
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
  onUpgradeClick,
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
    // PROFESSIONAL/ENTERPRISE TIER LOGIC
    if (isProfessionalOrEnterprise) {
      // Priority 1: Check if face swap is complete (Final State - 4K Ready!)
      if (image.face_swap_status === 'completed' && image.face_swap_image_url) {
        return '4k-ready';
      }
      
      // Priority 2: Check if face swap is processing (Finalizing)
      if (image.face_swap_status === 'processing') {
        return 'finalizing';
      }
      
      // Priority 3: If 4K upscale is complete but face swap hasn't completed yet
      // Show "4K Processing" because we're still waiting for face swap (final step)
      if (image.upscale_status === 'completed' && image.upscaled_image_url) {
        // Face swap hasn't completed yet, keep showing "4K Processing"
        return '4k-processing';
      }
      
      // Priority 4: Check if enhanced upscale is processing (4K Processing)
      if (image.upscale_status === 'processing') {
        return '4k-processing';
      }
      
      // ✨ CRITICAL: If 2K is complete but 4K hasn't started/completed yet, show "4K Processing"
      // This allows users to see the 2K image while 4K is being generated
      // Badge shows "4K Processing" to indicate enhancement is in progress
      if (image.basic_upscale_status === 'completed' && image.basic_upscale_url) {
        // 2K is ready and displayed, but we're waiting for 4K
        // Show "4K Processing" badge to indicate Pro/Enterprise enhancement is in progress
        return '4k-processing';
      }
      
      // Default: Still processing (try-on or initial 2K)
      return 'processing';
    }
    
    // FREE/CREATOR TIER LOGIC
    // Check if basic upscale is complete (2K Ready - Final State)
    if (image.basic_upscale_status === 'completed' && image.basic_upscale_url) {
      return '2k-ready';
    }
    
    // Default to processing (try-on or 2K in progress)
    return 'processing';
  };

  // Determine display URL based on what's available
  const getDisplayUrl = (): string => {
    // Display logic based on tier:
    // 
    // FREE/CREATOR (Pipeline: Try-On → 2K):
    // - Show clothing image until 2K upscale completes
    // - Then show 2K upscale result
    // 
    // PROFESSIONAL/ENTERPRISE (Pipeline: Try-On → 2K → 4K → Face Swap):
    // - Show clothing image until try-on completes
    // - Show try-on while 2K is processing
    // - ✨ Show 2K IMMEDIATELY when ready (even if 4K is still processing) ✨
    // - ⚠️ KEEP SHOWING 2K until face swap completes (don't show 4K until final step done)
    // - Show face swap when complete (final result)
    
    if (isProfessionalOrEnterprise) {
      // ✨ PRIORITY ORDER: Face Swap (final) → 2K (while processing) → Try-On → Clothing
      // NOTE: 4K image is skipped in display - we show 2K until face swap completes
      
      // Final step: Show face swap result (this includes the 4K quality)
      if (image.face_swap_status === 'completed' && image.face_swap_image_url) {
        return image.face_swap_image_url;
      }
      
      // ✨ CRITICAL: Show 2K while 4K/Face Swap is processing
      // Don't show 4K upscale image even if available - wait for face swap to complete
      // This keeps the preview consistent and shows "4K Processing" badge
      if (image.basic_upscale_url) {
        return image.basic_upscale_url;
      }
      
      if (image.image_url) {
        return image.image_url;
      }
      
      return clothingImageUrl || '';
    } else {
      // Free/Creator: Show clothing until 2K upscale completes
      if (!image.basic_upscale_url && clothingImageUrl) {
        return clothingImageUrl;
      }
      
      // Then show: 2K Upscale → Try-On → Clothing
      return image.basic_upscale_url || 
             image.image_url || 
             clothingImageUrl || 
             '';
    }
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

  // Remove BG button state - now shown for all users including free
  const showRemoveBgButton = true; // Always show for all tiers
  const isFreeUser = userTier === 'free';
  
  // Determine if Remove BG button should be disabled
  const getRemoveBgDisabled = (): boolean => {
    // Disable if already processed
    if (hasBgRemoved) return true;
    
    // Disable while processing
    if (isRemovingBg) return true;
    
    // Free users: never disable (they'll be prompted to upgrade)
    if (isFreeUser) return false;
    
    if (isProfessionalOrEnterprise) {
      // Professional/Enterprise: Wait for 4K image (face_swap or upscaled_image)
      // Enable if any 4K image is available OR at least 2K is ready
      const has4K = (image.face_swap_status === 'completed' && image.face_swap_image_url) ||
                    (image.upscale_status === 'completed' && image.upscaled_image_url);
      const has2K = image.basic_upscale_status === 'completed' && image.basic_upscale_url;
      
      // Enable if we have 4K OR at least 2K (fallback)
      return !(has4K || has2K);
    } else {
      // Creator: Enable when 2K is ready
      return !(image.basic_upscale_status === 'completed' && image.basic_upscale_url);
    }
  };

  const removeBgDisabled = getRemoveBgDisabled();

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
                // Free users: redirect to pricing page
                if (isFreeUser && !hasBgRemoved) {
                  onUpgradeClick?.();
                  return;
                }
                // Paid users: process background removal
                if (!removeBgDisabled && !hasBgRemoved) {
                  onRemoveBackground();
                }
              }}
              disabled={removeBgDisabled && !isFreeUser}
              className={`
                flex-1 px-3 py-2 
                rounded-md 
                text-sm font-medium 
                transition-all duration-200
                flex items-center justify-center gap-1.5
                ${removeBgDisabled && !isFreeUser
                  ? hasBgRemoved
                    ? 'bg-green-500/10 border border-green-500 text-green-600 cursor-default'
                    : 'bg-muted/50 border border-border text-muted-foreground opacity-50 cursor-not-allowed'
                  : isFreeUser && !hasBgRemoved
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 border-0 text-white hover:from-purple-600 hover:to-indigo-600 cursor-pointer'
                    : hasBgRemoved
                      ? 'bg-green-500/10 border border-green-500 text-green-600 cursor-default'
                      : 'bg-white border border-border text-foreground hover:bg-muted hover:border-muted-foreground'
                }
              `}
            >
              {isRemovingBg ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  Processing...
                </>
              ) : hasBgRemoved ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  BG Removed
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
                  </svg>
                  Remove BG
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
