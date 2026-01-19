import React from 'react';

export type BadgeStatus = 
  | '4k-ready'
  | '4k-processing'
  | 'finalizing'
  | '2k-ready'
  | 'processing';

interface QualityBadgeProps {
  status: BadgeStatus;
  className?: string;
}

/**
 * Quality Badge Component
 * Displays processing status with 5 distinct visual states:
 * - 4K Ready: Purple gradient (all steps complete for Pro/Enterprise)
 * - 4K Processing: Blue with pulse animation
 * - Finalizing: Orange gradient (face swap processing)
 * - 2K Ready: Green gradient (basic upscale complete)
 * - Processing: Amber (initial generation)
 */
export function QualityBadge({ status, className = '' }: QualityBadgeProps) {
  const badgeConfigs = {
    '4k-ready': {
      className: 'bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-sm text-white shadow-lg',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ),
      text: '4K Ready',
      animated: false
    },
    '4k-processing': {
      className: 'bg-primary text-primary-foreground shadow-lg animate-pulse',
      icon: (
        <svg className="w-3.5 h-3.5 animate-spin" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ),
      text: '4K Processing',
      animated: true
    },
    'finalizing': {
      className: 'bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-sm text-white shadow-lg',
      icon: (
        <svg className="w-3.5 h-3.5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      ),
      text: 'Finalizing...',
      animated: true
    },
    '2k-ready': {
      className: 'bg-gradient-to-r from-emerald-500/90 to-green-500/90 backdrop-blur-sm text-white shadow-lg',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      ),
      text: 'Ready',
      animated: false
    },
    'processing': {
      className: 'bg-amber-500/90 backdrop-blur-sm text-white shadow-lg',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      ),
      text: 'Processing',
      animated: false
    }
  };

  const config = badgeConfigs[status];

  return (
    <div className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${config.className} ${className}`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
