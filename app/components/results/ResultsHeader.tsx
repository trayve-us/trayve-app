import React, { useState, useRef, useEffect } from 'react';
import { CreditsDisplay } from '../CreditsDisplay';
import { UserProfile } from '../UserProfile';

interface ResultsHeaderProps {
  projectName: string;
  onProjectNameChange: (newName: string) => void;
  createdAt: string;
  onGenerateMore: () => void;
  onDownloadAll: () => void;
  onSelectImages: () => void;
  selectionMode: boolean;
  selectedCount: number;
  user?: {
    email: string;
    shopName: string;
  } | null;
  className?: string;
}

/**
 * Results Header Component
 * Responsive header with:
 * - Project name editing (inline edit on click)
 * - Timestamp display
 * - Desktop action buttons (Generate More, Download All, Select Images)
 * - Mobile icon-only buttons
 * - Credits display and user profile
 */
export function ResultsHeader({
  projectName,
  onProjectNameChange,
  createdAt,
  onGenerateMore,
  onDownloadAll,
  onSelectImages,
  selectionMode,
  selectedCount,
  user,
  className = ''
}: ResultsHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format timestamp
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Created just now';
    if (diffHours < 24) return `Created ${diffHours}h ago`;
    if (diffDays === 1) return 'Created yesterday';
    return `Created ${diffDays}d ago`;
  };

  // Handle edit mode
  const startEditing = () => {
    setIsEditingName(true);
    setEditedName(projectName);
  };

  const saveEdit = () => {
    if (editedName.trim() && editedName !== projectName) {
      onProjectNameChange(editedName.trim());
    } else {
      setEditedName(projectName);
    }
    setIsEditingName(false);
  };

  const cancelEdit = () => {
    setEditedName(projectName);
    setIsEditingName(false);
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Keyboard handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <div className={`bg-background ${className}`}>
      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-8 pt-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Left: Project Name Section */}
          <div className="flex-1">
            <div className="lg:mt-0 -mt-2">
              <div className="flex items-center justify-between">
                {/* Project Title with Edit Button */}
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2 group">
                    {isEditingName ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleKeyDown}
                        className="text-xl sm:text-2xl font-bold text-foreground bg-transparent border-none outline-none focus:ring-2 focus:ring-primary rounded px-2 -ml-2"
                        maxLength={100}
                      />
                    ) : (
                      <>
                        <button 
                          onClick={startEditing}
                          className="text-xl sm:text-2xl font-bold text-foreground hover:text-primary transition-colors text-left bg-transparent border-none outline-none"
                        >
                          {projectName}
                        </button>
                        <button 
                          onClick={startEditing}
                          className="p-1 sm:p-2 hover:bg-muted rounded-md flex items-center justify-center ml-1 sm:ml-0"
                          aria-label="Edit project name"
                        >
                          <svg className="w-4 h-4 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>{formatTimestamp(createdAt)}</span>
                  </div>
                </div>

                {/* Mobile Action Icons (visible on mobile only) */}
                <div className="flex items-center gap-2 lg:hidden">
                  <button 
                    onClick={onGenerateMore}
                    className="p-2 hover:bg-muted rounded-md transition-colors"
                    aria-label="Generate more"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                  </button>
                  <button 
                    onClick={selectionMode && selectedCount > 0 ? onDownloadAll : onDownloadAll}
                    className="p-2 hover:bg-muted rounded-md transition-colors"
                    aria-label={selectionMode && selectedCount > 0 ? `Download ${selectedCount} selected` : "Download all"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                  </button>
                  <button 
                    onClick={onSelectImages}
                    className={`p-2 hover:bg-muted rounded-md transition-colors ${selectionMode ? 'bg-primary text-primary-foreground' : ''}`}
                    aria-label="Select images"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Desktop Action Buttons (hidden on mobile) */}
          <div className="hidden lg:flex flex-col sm:flex-row gap-3">
            <button 
              onClick={onGenerateMore}
              className="px-4 py-2.5 bg-background border border-border rounded-md font-medium text-sm hover:bg-muted transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Generate More
            </button>
            
            <button 
              onClick={onDownloadAll}
              className={`px-4 py-2.5 rounded-md font-medium text-sm whitespace-nowrap flex items-center justify-center gap-2 transition-colors ${
                selectionMode && selectedCount > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-background border border-border hover:bg-muted'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              {selectionMode && selectedCount > 0 ? `Download Selected (${selectedCount})` : 'Download All'}
            </button>
            
            <button 
              onClick={onSelectImages}
              className={`px-4 py-2.5 rounded-md font-medium text-sm whitespace-nowrap flex items-center justify-center gap-2 transition-colors ${
                selectionMode
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-background border border-border hover:bg-muted'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {selectionMode ? 'Cancel Selection' : 'Select Images'}
            </button>
          </div>
        </div>

        {/* Credits and User Profile (Desktop) */}
        {user && (
          <div className="hidden lg:flex items-center justify-end gap-4 mt-4">
            <CreditsDisplay />
            <UserProfile email={user.email} shopName={user.shopName} />
          </div>
        )}
      </div>
    </div>
  );
}
