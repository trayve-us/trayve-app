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
 * Updated for New Pipeline:
 * - Standard Tier: Stops at Base Image (Try-On) -> Shows "Ready"
 * - Pro Tier: Base Image -> 4K Upscale -> Shows "4K Ready"
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
    // DEBUG: Log status for troubleshooting
    // console.log(`Card Debug - Tier: ${userTier}, ImageURL: ${!!image.image_url}, Upscale: ${image.upscale_status}`);

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
      // Professional/Enterprise: Wait for 4K image if possible, but allow on base image
      const has4K = (image.upscale_status === 'completed' && image.upscaled_image_url);
      const hasBase = !!image.image_url;

      // Enable if we have 4K OR Base
      return !(has4K || hasBase);
    } else {
      // Creator: Enable when Base Image is ready
      return !image.image_url;
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
            disabled={badgeStatus === 'processing' || badgeStatus === '4k-processing'}
            className={`
              flex-1 px-3 py-2 border rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1
              ${(badgeStatus === 'processing' || badgeStatus === '4k-processing')
                ? 'bg-muted border-border text-muted-foreground opacity-50 cursor-not-allowed'
                : 'bg-background border-border hover:bg-muted'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
              disabled={(removeBgDisabled && !isFreeUser) || badgeStatus === 'processing' || badgeStatus === '4k-processing'}
              className={`
                flex-1 px-3 py-2 
                rounded-md 
                text-sm font-medium 
                transition-all duration-200
                flex items-center justify-center gap-1.5
                ${((removeBgDisabled && !isFreeUser) || badgeStatus === 'processing' || badgeStatus === '4k-processing')
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Processing...
                </>
              ) : hasBgRemoved ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  BG Removed
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
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
