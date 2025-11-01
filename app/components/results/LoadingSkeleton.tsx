import React from 'react';

interface LoadingSkeletonProps {
  progress?: number;
  className?: string;
}

/**
 * Loading Skeleton Component
 * Displays animated placeholder while images are processing
 * Shows shimmer effect, progress indicator, and processing badge
 */
export function LoadingSkeleton({ progress, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`group bg-background rounded-xl overflow-hidden shadow-sm ${className}`}>
      {/* Image Container with Shimmer */}
      <div className="relative aspect-[4/5] bg-muted overflow-hidden">
        {/* Animated shimmer background */}
        <div className="w-full h-full bg-muted animate-pulse"></div>
        
        {/* Processing Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center space-y-4">
            {/* Animated Spinner */}
            <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-muted animate-pulse rounded-full"></div>
            </div>
            
            {/* Loading Text */}
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded mx-auto"></div>
              <div className="h-3 w-20 bg-muted animate-pulse rounded mx-auto"></div>
            </div>
            
            {/* Progress Bar */}
            {progress !== undefined && progress > 0 && (
              <div className="w-48 mx-auto">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Processing Badge */}
        <div className="absolute top-3 left-3">
          <div className="bg-amber-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Processing</span>
          </div>
        </div>
      </div>
      
      {/* Placeholder Actions */}
      <div className="p-3">
        <div className="flex gap-2">
          <button 
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm font-medium opacity-50 cursor-not-allowed flex items-center justify-center gap-1" 
            disabled
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download
          </button>
          <button 
            className="flex-1 px-3 py-2 bg-muted/30 border border-dashed border-border rounded-md text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed" 
            disabled
          >
            Remove BG
          </button>
        </div>
      </div>
    </div>
  );
}

// Add shimmer animation to tailwind config if not already present
// Add to tailwind.config.js:
// theme: {
//   extend: {
//     animation: {
//       shimmer: 'shimmer 3s infinite',
//     },
//     keyframes: {
//       shimmer: {
//         '0%': { transform: 'translateX(-100%)' },
//         '100%': { transform: 'translateX(100%)' },
//       },
//     },
//   },
// }
