import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from '@remix-run/react';
import { 
  BackButton,
  ResultCard,
  LoadingSkeleton,
  ImageModal,
  EditProjectNameModal
} from '~/components/results';
import JSZip from 'jszip';

// ================================================================================
// TYPE DEFINITIONS
// ================================================================================

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
  created_at: string;
}

interface GenerationResult {
  pose_id: string;
  pose_name: string;
  images: GenerationImage[];
}

interface ProjectData {
  id: string;
  name: string;
  created_at: string;
  clothing_image_url?: string;
}

interface UserSubscription {
  tier: 'free' | 'creator' | 'professional' | 'enterprise';
  email: string;
  shop_name: string;
}

// ================================================================================
// MAIN COMPONENT
// ================================================================================

export default function GenerationResultsRevamped() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [results, setResults] = useState<GenerationResult[]>([]);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [selectedImageModal, setSelectedImageModal] = useState<{ image: GenerationImage; index: number } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [removingBgForImage, setRemovingBgForImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const allImages = useMemo(() => {
    return results.flatMap(r => r.images);
  }, [results]);

  const selectedCount = selectedImages.size;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/results?_=${Date.now()}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    }
  }, [projectId]);

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();

      if (data.success) {
        setProject(data.project);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  }, [projectId]);

  const fetchUserSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/user/subscription-status');
      const data = await response.json();

      if (data) {
        setUserSubscription({
          tier: data.tier || 'free',
          email: data.email || '',
          shop_name: data.shop_name || ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  }, []);

  // ============================================================================
  // INITIALIZATION & POLLING
  // ============================================================================

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchResults(),
        fetchProject(),
        fetchUserSubscription()
      ]);
      setIsLoading(false);
    };

    init();
  }, [projectId]);

  // Polling for processing status
  useEffect(() => {
    const generating = searchParams.get('generating') === 'true';
    
    if (generating || isPolling) {
      const interval = setInterval(fetchResults, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [searchParams, isPolling, fetchResults]);

  // Auto-stop polling when all images are complete
  useEffect(() => {
    if (allImages.length > 0) {
      const allComplete = allImages.every(img => {
        const tier = userSubscription?.tier || 'free';
        const isProfessional = tier === 'professional' || tier === 'enterprise';

        if (isProfessional) {
          return img.face_swap_status === 'completed' || img.face_swap_status === 'not_available';
        } else {
          return img.basic_upscale_status === 'completed' || img.basic_upscale_status === 'not_available';
        }
      });

      if (allComplete && isPolling) {
        setIsPolling(false);
      } else if (!allComplete && !isPolling) {
        setIsPolling(true);
      }
    }
  }, [allImages, userSubscription, isPolling]);

  // ============================================================================
  // SELECTION MODE HANDLERS
  // ============================================================================

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => !prev);
    setSelectedImages(new Set());
  }, []);

  const toggleImageSelection = useCallback((imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  }, []);

  // ============================================================================
  // PROJECT NAME EDITING
  // ============================================================================

  const handleProjectNameChange = useCallback(async (newName: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/update-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });

      const data = await response.json();

      if (data.success) {
        setProject(prev => prev ? { ...prev, name: newName } : null);
      }
    } catch (error) {
      console.error('Failed to update project name:', error);
    }
  }, [projectId]);

  // ============================================================================
  // DOWNLOAD HANDLERS
  // ============================================================================

  const downloadAsZip = useCallback(async (
    images: { url: string; filename: string }[],
    zipName: string
  ) => {
    try {
      const zip = new JSZip();

      // Download all images and add to ZIP
      const downloadPromises = images.map(async ({ url, filename }) => {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          zip.file(filename, blob);
        } catch (error) {
          console.error(`Failed to download ${filename}:`, error);
        }
      });

      await Promise.all(downloadPromises);

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error creating ZIP:', error);
    }
  }, []);

  const handleDownloadImage = useCallback(async (image: GenerationImage, index: number) => {
    const isProfessional = userSubscription?.tier === 'professional' || userSubscription?.tier === 'enterprise';
    const hasBgRemoved = !!image.generation_record?.removed_bg_url;

    const imagesToDownload: { url: string; filename: string }[] = [];

    // Always include 2K
    if (image.basic_upscale_url) {
      imagesToDownload.push({
        url: image.basic_upscale_url,
        filename: `${project?.name || 'image'}_${index + 1}_2K.png`
      });
    }

    // Add 4K for Professional/Enterprise
    if (isProfessional) {
      const enhancedUrl = image.face_swap_image_url || image.upscaled_image_url;
      if (enhancedUrl) {
        imagesToDownload.push({
          url: enhancedUrl,
          filename: `${project?.name || 'image'}_${index + 1}_4K.png`
        });
      }
    }

    // Add BG removed if exists
    if (hasBgRemoved) {
      imagesToDownload.push({
        url: image.generation_record!.removed_bg_url!,
        filename: `${project?.name || 'image'}_${index + 1}_BG_Removed.png`
      });
    }

    // Download as ZIP if multiple files, otherwise direct download
    if (imagesToDownload.length > 1) {
      await downloadAsZip(imagesToDownload, `${project?.name || 'image'}_${index + 1}.zip`);
    } else if (imagesToDownload.length === 1) {
      // Direct download for single image
      try {
        const response = await fetch(imagesToDownload[0].url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = imagesToDownload[0].filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download failed:', error);
        // Fallback to opening in new tab if download fails
        window.open(imagesToDownload[0].url, '_blank');
      }
    }
  }, [userSubscription, project, downloadAsZip]);

  const handleDownloadAll = useCallback(async () => {
    const imagesToDownload = selectionMode && selectedCount > 0
      ? allImages.filter(img => selectedImages.has(img.id))
      : allImages;

    const isProfessional = userSubscription?.tier === 'professional' || userSubscription?.tier === 'enterprise';
    const files: { url: string; filename: string }[] = [];

    imagesToDownload.forEach((image, index) => {
      // 2K version
      if (image.basic_upscale_url) {
        files.push({
          url: image.basic_upscale_url,
          filename: `${index + 1}_2K.png`
        });
      }

      // 4K version (Professional/Enterprise)
      if (isProfessional) {
        const enhancedUrl = image.face_swap_image_url || image.upscaled_image_url;
        if (enhancedUrl) {
          files.push({
            url: enhancedUrl,
            filename: `${index + 1}_4K.png`
          });
        }
      }

      // BG removed version
      if (image.generation_record?.removed_bg_url) {
        files.push({
          url: image.generation_record.removed_bg_url,
          filename: `${index + 1}_BG_Removed.png`
        });
      }
    });

    const zipName = selectionMode && selectedCount > 0
      ? `${project?.name || 'images'}_Selected_${selectedCount}.zip`
      : `${project?.name || 'images'}_All.zip`;

    await downloadAsZip(files, zipName);

    // Exit selection mode after download
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedImages(new Set());
    }
  }, [allImages, selectedImages, selectedCount, selectionMode, userSubscription, project, downloadAsZip]);

  // ============================================================================
  // BACKGROUND REMOVAL HANDLER
  // ============================================================================

  const handleRemoveBackground = useCallback(async (image: GenerationImage) => {
    setRemovingBgForImage(image.id);

    try {
      const response = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: image.id })
      });

      const data = await response.json();

      if (data.success) {
        // Refresh results to show updated image
        await fetchResults();
      }
    } catch (error) {
      console.error('Background removal failed:', error);
    } finally {
      setRemovingBgForImage(null);
    }
  }, [fetchResults]);

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handleGenerateMore = useCallback(() => {
    navigate('/app/studio');
  }, [navigate]);

  const handleImageClick = useCallback((image: GenerationImage, index: number) => {
    if (!selectionMode) {
      // DEBUG: Log what we're passing to the modal
      console.log('🖼️ Opening modal with image:', {
        id: image.id,
        basic_upscale_url: image.basic_upscale_url ? 'EXISTS' : 'MISSING',
        basic_upscale_status: image.basic_upscale_status,
        upscaled_image_url: image.upscaled_image_url ? 'EXISTS' : 'MISSING',
        upscale_status: image.upscale_status,
        face_swap_image_url: image.face_swap_image_url ? 'EXISTS' : 'MISSING',
        face_swap_status: image.face_swap_status,
      });
      setSelectedImageModal({ image, index });
    } else {
      toggleImageSelection(image.id);
    }
  }, [selectionMode, toggleImageSelection]);

  const handleModalNavigation = useCallback((direction: 'prev' | 'next') => {
    if (!selectedImageModal) return;

    const newIndex = direction === 'prev' 
      ? selectedImageModal.index - 1 
      : selectedImageModal.index + 1;

    if (newIndex >= 0 && newIndex < allImages.length) {
      setSelectedImageModal({ image: allImages[newIndex], index: newIndex });
    }
  }, [selectedImageModal, allImages]);

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <BackButton />
        
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-8 w-64 bg-muted animate-pulse rounded"></div>
            <div className="h-4 w-32 bg-muted animate-pulse rounded mt-2"></div>
          </div>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-background font-['Inter']">
      {/* Mobile Back Button (visible on mobile only) */}
      <BackButton />

      {/* Header Section - Exact Design Match */}
      <div className="bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 lg:py-8 pt-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Left: Project Name Section with Back Button */}
            <div className="flex-1">
              <div className="lg:mt-0 -mt-2">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
                  {/* Desktop Back Button + Project Title with Edit Button + Timestamp */}
                  <div className="flex items-center gap-3">
                    {/* Back Button (visible on desktop only) */}
                    <button
                      onClick={() => navigate('/app/projects')}
                      className="hidden lg:flex items-center justify-center p-2 hover:bg-muted rounded-md transition-colors"
                      aria-label="Back to Projects"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                      </svg>
                    </button>

                    {/* Title and Timestamp stacked */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 group">
                        <button 
                          onClick={() => setIsEditModalOpen(true)}
                          className="text-xl sm:text-2xl font-bold text-foreground hover:text-primary transition-colors text-left bg-transparent border-none outline-none"
                        >
                          {project?.name || 'Untitled project'}
                        </button>
                        <button 
                          onClick={() => setIsEditModalOpen(true)}
                          className="p-1 sm:p-2 hover:bg-muted rounded-md flex items-center justify-center ml-1 sm:ml-0"
                        >
                          <svg className="w-4 h-4 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                      </div>
                      
                      {/* Timestamp */}
                      {project && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          <span>Created {new Date(project.created_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile Action Icons (visible on mobile only) */}
                  <div className="flex items-center gap-2 lg:hidden">
                    <button 
                      onClick={handleGenerateMore}
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                      </svg>
                    </button>
                    <button 
                      onClick={handleDownloadAll}
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                      </svg>
                    </button>
                    <button 
                      onClick={toggleSelectionMode}
                      className={`p-2 hover:bg-muted rounded-md transition-colors ${selectionMode ? 'bg-primary text-primary-foreground' : ''}`}
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
                onClick={handleGenerateMore}
                className="px-4 py-2.5 bg-background border border-border rounded-md font-medium text-sm hover:bg-muted transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Generate More
              </button>
              
              <button 
                onClick={handleDownloadAll}
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
                onClick={toggleSelectionMode}
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
        </div>
      </div>

      {/* Images Grid Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allImages.length > 0 ? (
            allImages.map((image, index) => (
              <ResultCard
                key={image.id}
                image={image}
                userTier={userSubscription?.tier || 'free'}
                onImageClick={() => handleImageClick(image, index)}
                onDownload={() => handleDownloadImage(image, index)}
                onRemoveBackground={() => handleRemoveBackground(image)}
                isRemovingBg={removingBgForImage === image.id}
                selectionMode={selectionMode}
                isSelected={selectedImages.has(image.id)}
                onSelectionChange={() => toggleImageSelection(image.id)}
                clothingImageUrl={project?.clothing_image_url}
              />
            ))
          ) : (
            // Show loading skeletons if no images yet
            Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} progress={isPolling ? 50 : undefined} />
            ))
          )}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImageModal && (
        <ImageModal
          image={selectedImageModal.image}
          userTier={userSubscription?.tier || 'free'}
          onClose={() => setSelectedImageModal(null)}
          onPrevious={() => handleModalNavigation('prev')}
          onNext={() => handleModalNavigation('next')}
          hasNext={selectedImageModal.index < allImages.length - 1}
          hasPrevious={selectedImageModal.index > 0}
          projectName={project?.name || 'image'}
          imageIndex={selectedImageModal.index}
        />
      )}

      {/* Edit Project Name Modal */}
      <EditProjectNameModal
        isOpen={isEditModalOpen}
        currentName={project?.name || 'Untitled project'}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleProjectNameChange}
      />
    </div>
  );
}
