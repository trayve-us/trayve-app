import React from 'react';
import { useNavigate } from '@remix-run/react';

interface BackButtonProps {
  to?: string;
  className?: string;
}

/**
 * Mobile Back Button
 * Visible only on mobile devices (< 1024px)
 * Navigates back to studio page by default
 */
export function BackButton({ to = '/app/studio', className = '' }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <div className={`lg:hidden px-4 pt-6 pb-6 ${className}`}>
      <button 
        onClick={() => navigate(to)}
        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors p-2 -ml-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        <span className="text-sm font-medium">Back to Studio</span>
      </button>
    </div>
  );
}
