import React, { useEffect } from 'react';
import { QualityBadge, type BadgeStatus } from './QualityBadge';

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

interface ImageModalProps {
  image: GenerationImage;
  userTier: 'free' | 'creator' | 'professional' | 'enterprise';
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  projectName?: string;
  imageIndex?: number;
}

/**
 * Image Modal Component
 * Full-screen image viewer with:
 * - Fixed overlay with backdrop blur
 * - Multi-column layout (1-3 columns based on tier and available versions)
 * - Individual download buttons for each version
 * - Keyboard navigation (Escape to close, Arrow keys for prev/next)
 * - Click outside to close
 */
export function ImageModal({
  image,
  userTier,
  onClose,
  onPrevious,
  onNext,
  hasNext = false,
  hasPrevious = false,
  projectName = 'image',
  imageIndex = 0
}: ImageModalProps) {
  const isProfessionalOrEnterprise = userTier === 'professional' || userTier === 'enterprise';
  const hasBgRemoved = !!image.generation_record?.removed_bg_url;
  
  // Update 4K Logic for new pipeline (Try-On -> 4K Upscale)
  const has4K = isProfessionalOrEnterprise && 
    !!image.upscaled_image_url && 
    image.upscaled_image_url.length > 0;
  
  // Get the actual 4K image URL
  const get4KImageUrl = (): string | null => {
    if (!has4K) return null;
    return image.upscaled_image_url || null;
  };
  
  const fourKImageUrl = get4KImageUrl();
  
  // Check if 4K is currently processing
  const is4KProcessing = isProfessionalOrEnterprise && (
    image.upscale_status === 'processing' || 
    image.upscale_status === 'pending'
  );
  
  // "Standard" quality is now the base image_url (Try-On)
  // Legacy support for basic_upscale_url if present
  const standardImageUrl = image.image_url || image.basic_upscale_url;
  const hasStandard = !!standardImageUrl && standardImageUrl.length > 0;
  
  // DEBUG: Add visual indicator to see what's happening
  const debugInfo = {
    tier: userTier,
    isPro: isProfessionalOrEnterprise,
    upscale_status: image.upscale_status,
    upscaled_url_value: image.upscaled_image_url,
    has4K,
    hasStandard,
    is4KProcessing,
  };
  
  // Log for debugging (console only, no fetch)
  console.log('ImageModal Debug:', debugInfo);

  // Determine how many columns to show
  const getColumnCount = () => {
    // 3 columns: Standard + 4K + BG Removed (or processing 4k)
    // 2 columns: Standard + 4K (or processing)
    // 2 columns: Standard + BG Removed
    // 1 column: Standard
    
    let cols = 0;
    if (hasStandard) cols++;
    
    if (isProfessionalOrEnterprise) {
        if (has4K || is4KProcessing) cols++;
    }
    
    if (hasBgRemoved) cols++;
    
    return Math.max(1, cols);
  };

  const columnCount = getColumnCount();

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) onPrevious();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevious, onNext, hasNext, hasPrevious]);

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Download handler - properly downloads the file instead of opening URL
  const handleDownload = async (url: string, filename: string) => {
    try {
      console.log('🔽 Attempting download:', { url, filename });
      
      // Validate URL
      if (!url || url.trim() === '') {
        console.error('❌ Invalid URL for download:', url);
        alert('Download failed: Invalid image URL');
        return;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      console.log('✅ Download successful:', filename);
    } catch (error) {
      console.error('❌ Download failed:', error);
      // Fallback to opening in new tab if download fails
      if (url && url.trim() !== '') {
        window.open(url, '_blank');
      } else {
        alert('Download failed: Image URL is not available');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full h-full flex items-center justify-center max-w-[90rem] max-h-[calc(100vh-2rem)]">
        
        {/* Modal Content */}
        {columnCount === 1 ? (
          /* Single Column Layout */
          <div className="relative">
            <img 
              src={has4K && fourKImageUrl ? fourKImageUrl : (standardImageUrl!)}
              alt="Full size preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <button 
                onClick={() => handleDownload(
                  (has4K && fourKImageUrl ? fourKImageUrl : standardImageUrl!)!,
                  `${projectName}_${imageIndex + 1}_${has4K ? '4K' : 'Standard'}.png`
                )}
                className="px-4 py-2 bg-background border border-border rounded-md hover:bg-muted transition-colors"
              >
                Download {has4K ? '4K' : 'Standard'}
              </button>
            </div>
          </div>
        ) : (
          /* Multi-Column Layout */
          <div className={`flex gap-6 w-full h-full ${columnCount === 3 ? 'max-w-[90rem]' : columnCount === 2 ? 'max-w-[60rem]' : 'max-w-[30rem]'}`}>
            
            {/* Column 1: Standard Quality (Base) */}
            {hasStandard && (
              <div className="flex-1 relative flex flex-col items-center justify-center min-w-0">
                <img 
                  src={standardImageUrl!}
                  alt="Standard Quality"
                  className="max-w-full max-h-[calc(85vh-80px)] w-auto object-contain rounded-lg shadow-xl"
                />
                <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                  Standard Quality
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                  <button 
                    onClick={() => handleDownload(standardImageUrl!, `${projectName}_${imageIndex + 1}_Standard.png`)}
                    className="px-6 py-2.5 bg-white/95 backdrop-blur-sm text-gray-900 rounded-lg hover:bg-white transition-colors shadow-lg font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download Standard
                  </button>
                </div>
              </div>
            )}
            
            {/* Column 2: 4K Enhanced (Professional/Enterprise only) */}
            {isProfessionalOrEnterprise && (has4K || is4KProcessing) && (
              <div className="flex-1 relative flex flex-col items-center justify-center min-w-0">
                {has4K && fourKImageUrl ? (
                  // 4K is ready - show the face swap result (final step complete)
                  <>
                    <img 
                      src={fourKImageUrl}
                      alt="4K Enhanced"
                      className="max-w-full max-h-[calc(85vh-80px)] w-auto object-contain rounded-lg shadow-xl"
                    />
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                      4K Enhanced
                    </div>
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                      <button 
                        onClick={() => handleDownload(fourKImageUrl, `${projectName}_${imageIndex + 1}_4K.png`)}
                        className="px-6 py-2.5 bg-white/95 backdrop-blur-sm text-gray-900 rounded-lg hover:bg-white transition-colors shadow-lg font-medium flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                        Download 4K
                      </button>
                    </div>
                  </>
                ) : (
                  // 4K is processing - show placeholder with status
                  <>
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-lg border-2 border-dashed border-purple-500/30">
                      <div className="text-center p-8">
                        <div className="mb-4">
                          <svg className="w-16 h-16 mx-auto text-purple-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                          </svg>
                        </div>
                        <div className="text-lg font-semibold text-purple-600 mb-2">4K Processing</div>
                        <div className="text-sm text-gray-600">Enhanced version coming soon...</div>
                      </div>
                    </div>
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg animate-pulse">
                      4K Processing...
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Column 3: BG Removed (if available) */}
            {hasBgRemoved && (
              <div className="flex-1 relative flex flex-col items-center justify-center min-w-0">
                <img 
                  src={image.generation_record!.removed_bg_url!}
                  alt="Background Removed"
                  className="max-w-full max-h-[calc(85vh-80px)] w-auto object-contain"
                />
                <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  BG Removed
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                  <button 
                    onClick={() => handleDownload(image.generation_record!.removed_bg_url!, `${projectName}_${imageIndex + 1}_BG_Removed.png`)}
                    className="px-6 py-2.5 bg-white/95 backdrop-blur-sm text-gray-900 rounded-lg hover:bg-white transition-colors shadow-lg font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download PNG
                  </button>
                </div>
              </div>
            )}
            
          </div>
        )}
        
        {/* Close Button (Top Right) */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white border border-border/20 rounded-md text-sm transition-colors"
        >
          ✕
        </button>
        
        {/* Navigation Buttons */}
        {hasPrevious && onPrevious && (
          <button
            onClick={onPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            aria-label="Previous image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
        )}
        
        {hasNext && onNext && (
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            aria-label="Next image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        )}
        
      </div>
    </div>
  );
}
