import React from 'react';

interface SelectionCheckboxProps {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  className?: string;
}

/**
 * Selection Checkbox Component
 * Displays in top-left of image cards during selection mode
 * Unselected: Hollow circle with border
 * Selected: Filled circle with checkmark
 */
export function SelectionCheckbox({ isSelected, onChange, className = '' }: SelectionCheckboxProps) {
  return (
    <div className={`absolute top-2 left-2 sm:top-3 sm:left-3 z-10 ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange(!isSelected);
        }}
        className={`
          w-6 h-6 sm:w-7 sm:h-7 
          rounded-full 
          border-2 
          backdrop-blur-sm 
          transition-all 
          duration-200 
          flex items-center justify-center
          ${isSelected 
            ? 'bg-primary border-primary text-primary-foreground scale-110 shadow-md shadow-primary/30' 
            : 'bg-background/90 border-muted-foreground/30 hover:border-primary/50 hover:scale-105'
          }
        `}
        aria-label={isSelected ? 'Deselect image' : 'Select image'}
      >
        {isSelected && (
          <svg className="w-4 h-4 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        )}
      </button>
    </div>
  );
}
