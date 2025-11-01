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
  const has4K = isProfessionalOrEnterprise && (image.face_swap_image_url || image.upscaled_image_url);
  const has2K = !!image.basic_upscale_url;

  // Determine how many columns to show
  const getColumnCount = () => {
    if (isProfessionalOrEnterprise) {
      // Show 2K and 4K side by side when 4K is available
      if (has2K && has4K && hasBgRemoved) return 3;
      if (has2K && has4K) return 2; // Show both 2K and 4K
      if (has2K && hasBgRemoved) return 2;
      return 1;
    } else {
      if (has2K && hasBgRemoved) return 2;
      return 1;
    }
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
      const response = await fetch(url);
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
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to opening in new tab if download fails
      window.open(url, '_blank');
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
              src={has4K ? (image.face_swap_image_url || image.upscaled_image_url!) : (has2K ? image.basic_upscale_url! : image.image_url)}
              alt="Full size preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <button 
                onClick={() => handleDownload(
                  has4K ? (image.face_swap_image_url || image.upscaled_image_url!) : (has2K ? image.basic_upscale_url! : image.image_url),
                  `${projectName}_${imageIndex + 1}_${has4K ? '4K' : '2K'}.png`
                )}
                className="px-4 py-2 bg-background border border-border rounded-md hover:bg-muted transition-colors"
              >
                Download {has4K ? '4K' : '2K'}
              </button>
            </div>
          </div>
        ) : (
          /* Multi-Column Layout */
          <div className={`flex gap-6 w-full h-full ${columnCount === 3 ? 'max-w-[90rem]' : columnCount === 2 ? 'max-w-[60rem]' : 'max-w-[30rem]'}`}>
            
            {/* Column 1: 2K Original */}
            {has2K && (
              <div className="flex-1 relative flex flex-col items-center justify-center min-w-0">
                <img 
                  src={image.basic_upscale_url!}
                  alt="2K Original"
                  className="max-w-full max-h-[calc(85vh-80px)] w-auto object-contain rounded-lg shadow-xl"
                />
                <div className="absolute top-4 left-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold shadow-lg flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  2K Ready
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                  <button 
                    onClick={() => handleDownload(image.basic_upscale_url!, `${projectName}_${imageIndex + 1}_2K.png`)}
                    className="px-4 py-2 bg-white/95 backdrop-blur-sm border border-border rounded-md hover:bg-white transition-colors shadow-lg font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download 2K
                  </button>
                </div>
              </div>
            )}
            
            {/* Column 2: 4K Enhanced (Professional/Enterprise only) */}
            {isProfessionalOrEnterprise && has4K && (
              <div className="flex-1 relative flex flex-col items-center justify-center min-w-0">
                <img 
                  src={image.face_swap_image_url || image.upscaled_image_url!}
                  alt="4K Enhanced"
                  className="max-w-full max-h-[calc(85vh-80px)] w-auto object-contain rounded-lg shadow-xl"
                />
                <div className="absolute top-4 left-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold shadow-lg flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  4K Ready
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                  <button 
                    onClick={() => handleDownload(image.face_swap_image_url || image.upscaled_image_url!, `${projectName}_${imageIndex + 1}_4K.png`)}
                    className="px-4 py-2 bg-white/95 backdrop-blur-sm border border-border rounded-md hover:bg-white transition-colors shadow-lg font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download 4K
                  </button>
                </div>
              </div>
            )}
            
            {/* Column 3: BG Removed (if available) */}
            {hasBgRemoved && (
              <div className="flex-1 relative flex flex-col items-center justify-center">
                <img 
                  src={image.generation_record!.removed_bg_url!}
                  alt="Background Removed"
                  className="max-w-full max-h-[calc(85vh-80px)] object-contain rounded-lg"
                  style={{ backgroundColor: 'transparent' }}
                />
                <div className="absolute top-4 left-4 bg-green-500 text-white px-2 py-1.5 rounded-md text-sm font-semibold shadow-lg flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  BG Removed
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                  <button 
                    onClick={() => handleDownload(image.generation_record!.removed_bg_url!, `${projectName}_${imageIndex + 1}_BG_Removed.png`)}
                    className="px-4 py-2 bg-background border border-border rounded-md hover:bg-muted transition-colors"
                  >
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
