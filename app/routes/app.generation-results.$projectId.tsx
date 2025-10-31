import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from '@remix-run/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { Skeleton } from '~/components/ui/skeleton';
import { 
  Loader2, 
  Download, 
  AlertCircle, 
  Info, 
  Sparkles, 
  ArrowLeft,
  Scissors,
  Image as ImageIcon,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { useToast } from '~/hooks/use-toast';
import { CreditsDisplay } from '~/components/CreditsDisplay';
import { UserProfile } from '~/components/UserProfile';

// ================================================================================
// TYPE DEFINITIONS
// ================================================================================

interface GenerationImage {
  id: string;
  image_url: string;
  basic_upscale_url?: string;
  basic_upscale_status?: 'pending' | 'processing' | 'completed' | 'failed';
  upscaled_image_url?: string;
  upscale_status?: 'pending' | 'processing' | 'completed' | 'failed';
  face_swap_image_url?: string;
  face_swap_status?: 'pending' | 'processing' | 'completed' | 'failed';
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

interface PipelineExecution {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error_message?: string;
}

interface UserSubscription {
  tier: 'free' | 'creator' | 'professional' | 'enterprise';
  credits_balance: number;
}

// ================================================================================
// CUSTOM HOOK: Multi-Execution Status Polling
// ================================================================================

function useMultiExecutionStatus(
  executionIds: string[],
  enabled: boolean,
  onStatusChange: (data: { executions: PipelineExecution[], allCompleted: boolean, hasFailures: boolean }) => void
) {
  const [isPolling, setIsPolling] = useState(false);
  const pollCountRef = useRef(0);
  const maxPolls = 300; // 15 minutes at 5 second intervals

  useEffect(() => {
    if (!enabled || executionIds.length === 0) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    pollCountRef.current = 0;

    const pollInterval = setInterval(async () => {
      pollCountRef.current++;

      if (pollCountRef.current >= maxPolls) {
        console.warn('⏱️ Maximum polling duration reached (15 minutes)');
        clearInterval(pollInterval);
        setIsPolling(false);
        return;
      }

      try {
        const responses = await Promise.all(
          executionIds.map(id =>
            fetch(`/api/pipeline/status?executionId=${id}`).then(res => res.json())
          )
        );

        const executions: PipelineExecution[] = responses.map(r => r.execution);
        const allCompleted = executions.every(e => e.status === 'completed');
        const hasFailures = executions.some(e => e.status === 'failed');

        onStatusChange({ executions, allCompleted, hasFailures });

        if (allCompleted || hasFailures) {
          clearInterval(pollInterval);
          setIsPolling(false);
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [executionIds, enabled]);

  return { isPolling };
}

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

function hasEnhancedFeatures(tier: string): boolean {
  return tier === 'professional' || tier === 'enterprise';
}

function getFinalResultUrl(image: GenerationImage, hasEnhanced: boolean): string {
  if (hasEnhanced) {
    // Professional/Enterprise: Priority to face-swapped 4K
    return image.face_swap_image_url || 
           image.upscaled_image_url || 
           image.basic_upscale_url || 
           image.image_url;
  } else {
    // Free/Creator: Use basic upscale or original
    return image.basic_upscale_url || image.image_url;
  }
}

function ensureWatermarkedUrl(url: string, imageId: string): string {
  if (!url) return url;
  
  // If already watermarked, return as is
  if (url.includes('/watermarked/')) {
    return url;
  }
  
  // Convert to watermarked path
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1];
  urlParts[urlParts.length - 1] = 'watermarked';
  urlParts.push(filename);
  
  return urlParts.join('/');
}

function determineProcessingStage(image: GenerationImage): string {
  if (image.face_swap_status === 'processing') {
    return 'Face enhancement...';
  }
  if (image.upscale_status === 'processing') {
    return 'Enhancing to 4K...';
  }
  if (image.basic_upscale_status === 'processing') {
    return 'Upscaling image...';
  }
  return 'Processing...';
}

function getTimeBasedMessage(elapsedSeconds: number): string {
  if (elapsedSeconds < 30) {
    return 'Generating images... This typically takes 30-60 seconds';
  } else if (elapsedSeconds < 60) {
    return 'Almost done... Processing final touches';
  } else {
    return 'Taking longer than expected... Still processing';
  }
}

// ================================================================================
// PROCESSING OVERLAY COMPONENT
// ================================================================================

function ProcessingOverlay({ 
  stage, 
  progress 
}: { 
  stage: string; 
  progress?: number;
}) {
  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10">
      <div className="flex flex-col items-center justify-center h-full">
        {/* Animated Spinner */}
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white" />
        
        {/* Stage Text */}
        <p className="text-white font-medium mt-4">
          {stage}
        </p>
        
        {/* Progress Bar */}
        {progress !== undefined && progress > 0 && (
          <div className="w-48 h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        
        {/* Quality Badge */}
        <div className="mt-4 px-3 py-1 bg-violet-500/90 rounded-full">
          <span className="text-xs text-white font-medium">
            Processing 4K
          </span>
        </div>
      </div>
    </div>
  );
}

// ================================================================================
// PLACEHOLDER CARD COMPONENT
// ================================================================================

function PlaceholderCard({ progress }: { progress?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-pink-500/20 to-orange-500/20 animate-pulse">
          {/* Shimmer Effect */}
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" 
               style={{ animation: 'shimmer 3s infinite' }} />
        </div>
        
        {/* Processing Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Sparkles className="w-12 h-12 text-violet-400 animate-pulse mx-auto" />
            <p className="text-sm text-muted-foreground">
              Generating image...
            </p>
            {progress !== undefined && progress > 0 && (
              <div className="w-32 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
                <div 
                  className="h-full bg-violet-400 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}

// ================================================================================
// IMAGE CARD COMPONENT
// ================================================================================

function ImageCard({
  image,
  sampleIndex,
  userTier,
  onImageClick,
  onDownload,
  onRemoveBackground,
  isRemovingBg
}: {
  image: GenerationImage;
  sampleIndex: number;
  userTier: string;
  onImageClick: () => void;
  onDownload: () => void;
  onRemoveBackground: () => void;
  isRemovingBg: boolean;
}) {
  const isProfessional = hasEnhancedFeatures(userTier);
  const isFreeTier = userTier === 'free';
  const hasBgRemoved = !!image.generation_record?.removed_bg_url;

  // Determine display URL and processing state
  const showProcessingOverlay = useMemo(() => {
    return isProfessional &&
           image.basic_upscale_status === 'completed' &&
           image.basic_upscale_url &&
           (image.face_swap_status !== 'completed' || image.upscale_status !== 'completed');
  }, [isProfessional, image]);

  const displayUrl = useMemo(() => {
    let url: string;
    
    if (showProcessingOverlay) {
      // Show 2K while processing 4K
      url = image.basic_upscale_url!;
    } else {
      url = getFinalResultUrl(image, isProfessional);
    }

    // Ensure watermarked for free tier
    if (isFreeTier) {
      url = ensureWatermarkedUrl(url, image.id);
      if (!url.includes('/watermarked/')) {
        return ''; // Security block
      }
    }

    return url;
  }, [image, isProfessional, isFreeTier, showProcessingOverlay]);

  const processingStage = useMemo(() => {
    return determineProcessingStage(image);
  }, [image]);

  if (!displayUrl) {
    return <PlaceholderCard />;
  }

  return (
    <Card className="overflow-hidden group">
      <div className="relative aspect-square bg-muted cursor-pointer" onClick={onImageClick}>
        <img 
          src={displayUrl}
          alt={`Generated sample ${sampleIndex + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Processing Overlay */}
        {showProcessingOverlay && (
          <ProcessingOverlay stage={processingStage} />
        )}

        {/* Quality Badge */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {showProcessingOverlay ? (
            <Badge variant="secondary" className="bg-violet-500/10 text-violet-700 border-violet-500/20">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Processing 4K
            </Badge>
          ) : isProfessional && image.face_swap_image_url ? (
            <Badge variant="default" className="bg-gradient-to-r from-violet-500 to-pink-500">
              4K Enhanced
            </Badge>
          ) : !isFreeTier && image.basic_upscale_url ? (
            <Badge variant="default" className="bg-blue-500">
              2K Quality
            </Badge>
          ) : isFreeTier ? (
            <Badge variant="outline" className="border-orange-500 text-orange-700 bg-white/90">
              Watermarked
            </Badge>
          ) : null}
          
          {hasBgRemoved && (
            <Badge variant="default" className="bg-green-500">
              <Scissors className="w-3 h-3 mr-1" />
              BG Removed
            </Badge>
          )}
        </div>

        {/* Zoom Indicator */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <ZoomIn className="w-8 h-8 text-white" />
        </div>
      </div>

      <CardFooter className="flex flex-col gap-2 p-4">
        <Button 
          onClick={onDownload}
          className="w-full"
          variant="default"
        >
          <Download className="w-4 h-4 mr-2" />
          {isProfessional && image.face_swap_image_url ? 'Download Both (2K + 4K)' : 
           showProcessingOverlay ? 'Download 2K (4K processing...)' :
           'Download'}
        </Button>

        {!isFreeTier && !hasBgRemoved && (
          <Button
            onClick={onRemoveBackground}
            variant="outline"
            className="w-full"
            disabled={isRemovingBg || showProcessingOverlay}
          >
            {isRemovingBg ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4 mr-2" />
                Remove Background (500 credits)
              </>
            )}
          </Button>
        )}

        {hasBgRemoved && (
          <Button
            onClick={onDownload}
            variant="outline"
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download with BG Removed
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// ================================================================================
// IMAGE MODAL COMPONENT
// ================================================================================

function ImageModal({
  image,
  sampleIndex,
  userTier,
  onClose,
  onPrevious,
  onNext,
  hasNext,
  hasPrevious
}: {
  image: GenerationImage;
  sampleIndex: number;
  userTier: string;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}) {
  const isProfessional = hasEnhancedFeatures(userTier);
  const showDualView = isProfessional && 
                       image.basic_upscale_status === 'completed' &&
                       image.face_swap_status !== 'completed';

  const processingStage = determineProcessingStage(image);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrevious) onPrevious();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevious, onNext, hasNext, hasPrevious]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/10"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Navigation Buttons */}
      {hasPrevious && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 text-white hover:bg-white/10"
          onClick={onPrevious}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}

      {hasNext && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 text-white hover:bg-white/10"
          onClick={onNext}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}

      {/* Modal Content */}
      <div className="max-w-7xl w-full mx-4">
        {showDualView ? (
          // Dual View: 2K + 4K Processing
          <div className="grid grid-cols-2 gap-4">
            {/* Left: 2K Available */}
            <div>
              <div className="relative">
                <img 
                  src={image.basic_upscale_url!}
                  alt="2K Preview"
                  className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                />
                <Badge className="absolute top-4 left-4 bg-blue-500">2K Quality</Badge>
              </div>
              <p className="text-sm text-white/70 mt-2 text-center">
                Available now
              </p>
            </div>

            {/* Right: 4K Processing */}
            <div>
              <div className="relative aspect-square bg-muted/20 rounded-lg flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Sparkles className="w-16 h-16 text-violet-400 animate-pulse mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-white">4K Processing</p>
                    <p className="text-sm text-white/70 mt-1">
                      {processingStage}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-white/70 mt-2 text-center">
                Will be ready shortly
              </p>
            </div>
          </div>
        ) : (
          // Single View: Final Image
          <div className="text-center">
            <img 
              src={getFinalResultUrl(image, isProfessional)}
              alt={`Sample ${sampleIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================================
// MAIN COMPONENT
// ================================================================================

export default function GenerationResults() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [showBasicImages, setShowBasicImages] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [selectedImageData, setSelectedImageData] = useState<{ image: GenerationImage; index: number } | null>(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [failureDetails, setFailureDetails] = useState<any>(null);
  const [executionIds, setExecutionIds] = useState<string[]>([]);
  const [pipelineProgress, setPipelineProgress] = useState('Initializing...');
  const [progressValue, setProgressValue] = useState(0);
  const [removingBgForImage, setRemovingBgForImage] = useState<string | null>(null);
  const [pipelineStartTime] = useState(Date.now());
  const [user, setUser] = useState<{ email: string; shopName: string } | null>(null);

  // ============================================================================
  // REFS FOR OPTIMIZATION
  // ============================================================================

  const lastFetchTimeRef = useRef(0);
  const lastProgressRef = useRef(0);
  const fetchResultsRef = useRef<() => Promise<void>>();

  // ============================================================================
  // FETCH RESULTS FUNCTION
  // ============================================================================

  const fetchResults = useCallback(async (isPolling = false) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;

    // Debounce: Minimum 4 seconds between fetches
    if (isPolling && timeSinceLastFetch < 4000) {
      console.log('⏭️ Skipping fetch - debounce active');
      return;
    }

    lastFetchTimeRef.current = now;

    try {
      console.log('📥 Fetching results...');
      const response = await fetch(`/api/projects/${projectId}/results?_=${now}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
        
        // Check if we should show basic images for Professional/Enterprise
        if (userSubscription && hasEnhancedFeatures(userSubscription.tier)) {
          const hasBasicReady = data.results?.some((result: GenerationResult) =>
            result.images.some(img => 
              img.basic_upscale_status === 'completed' && 
              (img.face_swap_status !== 'completed' || img.upscale_status !== 'completed')
            )
          );
          
          if (hasBasicReady && !showBasicImages) {
            setShowBasicImages(true);
            toast({
              title: "2K Images Ready",
              description: "Viewing now while 4K processing continues in background",
              duration: 3000
            });
          }

          // Check if 4K is complete
          const has4KComplete = data.results?.some((result: GenerationResult) =>
            result.images.some(img => img.face_swap_status === 'completed')
          );

          if (has4KComplete && showBasicImages) {
            setShowBasicImages(false);
            toast({
              title: "4K Processing Complete",
              description: "Your high-resolution images are ready for download",
              duration: 5000
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching results:', error);
    }
  }, [projectId, userSubscription, showBasicImages, toast]);

  // Update ref
  useEffect(() => {
    fetchResultsRef.current = fetchResults;
  }, [fetchResults]);

  // ============================================================================
  // STATUS POLLING CALLBACK
  // ============================================================================

  const handleStatusChange = useCallback((data: { 
    executions: PipelineExecution[]; 
    allCompleted: boolean; 
    hasFailures: boolean;
  }) => {
    console.log('📊 Status update:', data);

    // Check for failures FIRST
    if (data.hasFailures) {
      setGenerationFailed(true);
      setIsPipelineRunning(false);
      const failedExecution = data.executions.find(e => e.status === 'failed');
      setFailureDetails({
        supportMessage: failedExecution?.error_message || 'An error occurred during processing'
      });
      
      toast({
        variant: "destructive",
        title: "Processing Unsuccessful",
        description: "No credits were charged for this session"
      });
      return;
    }

    // Calculate progress
    const avgProgress = data.executions.reduce((sum, e) => sum + e.progress, 0) / data.executions.length;
    setProgressValue(Math.round(avgProgress));

    // Update time-based message
    const elapsedSeconds = Math.floor((Date.now() - pipelineStartTime) / 1000);
    setPipelineProgress(getTimeBasedMessage(elapsedSeconds));

    // Check if we should fetch results
    const progressDelta = Math.abs(avgProgress - lastProgressRef.current);
    const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;

    if (progressDelta >= 10) {
      // Significant progress change - fetch immediately
      console.log('📈 Significant progress change detected');
      fetchResultsRef.current?.();
      lastProgressRef.current = avgProgress;
    } else if (timeSinceLastFetch >= 4000) {
      // Debounce timer elapsed - fetch update
      console.log('⏱️ Debounce timer elapsed');
      fetchResultsRef.current?.();
    }

    // All complete
    if (data.allCompleted) {
      console.log('✅ All executions complete');
      setIsPipelineRunning(false);
      fetchResultsRef.current?.();
    }
  }, [pipelineStartTime, toast]);

  // ============================================================================
  // POLLING HOOK
  // ============================================================================

  const { isPolling } = useMultiExecutionStatus(
    executionIds,
    isPipelineRunning && executionIds.length > 0,
    handleStatusChange
  );

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    const init = async () => {
      // Fetch user subscription
      const subResponse = await fetch('/api/user/subscription-status');
      const subData = await subResponse.json();
      setUserSubscription(subData);
      
      // Set user info for navbar
      if (subData) {
        setUser({
          email: subData.email || '',
          shopName: subData.shop_name || ''
        });
      }

      // Check if pipeline is running
      const generating = searchParams.get('generating') === 'true';
      const executionIdParam = searchParams.get('executionId');
      
      if (generating || executionIdParam) {
        setIsPipelineRunning(true);
        
        if (executionIdParam) {
          setExecutionIds(executionIdParam.split(','));
        }
      }

      // Initial fetch
      await fetchResults();
    };

    init();
  }, [projectId]);

  // ============================================================================
  // DOWNLOAD HANDLERS
  // ============================================================================

  const downloadAsZip = useCallback(async (
    images: { url: string; filename: string }[],
    zipName: string
  ) => {
    try {
      console.log('📦 Downloading ZIP:', zipName, images);
      toast({
        title: "Download Started",
        description: `Preparing ${images.length} image(s)...`
      });

      // Dynamically import JSZip
      const JSZip = (await import('jszip')).default;
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

      // Generate ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download ZIP
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({
        title: "Download Complete",
        description: `${images.length} image(s) downloaded successfully`,
        duration: 3000
      });
    } catch (error) {
      console.error('Error creating ZIP:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to create download package"
      });
    }
  }, [toast]);

  const handleDownloadImage = useCallback(async (image: GenerationImage, sampleIndex: number) => {
    const isProfessional = userSubscription && hasEnhancedFeatures(userSubscription.tier);
    const hasBgRemoved = !!image.generation_record?.removed_bg_url;

    const images: { url: string; filename: string }[] = [];

    // Always include 2K
    images.push({
      url: image.basic_upscale_url || image.image_url,
      filename: `${sampleIndex + 1}_2K_Original.jpg`
    });

    // Add BG removed if exists
    if (hasBgRemoved) {
      images.push({
        url: image.generation_record!.removed_bg_url!,
        filename: `${sampleIndex + 1}_BG_Removed.png`
      });
    }

    // Add 4K for Professional/Enterprise
    if (isProfessional) {
      const enhancedUrl = image.face_swap_image_url || image.upscaled_image_url;
      if (enhancedUrl) {
        images.push({
          url: enhancedUrl,
          filename: `${sampleIndex + 1}_4K_Enhanced.jpg`
        });
      }
    }

    if (images.length > 1) {
      await downloadAsZip(images, `image-${sampleIndex + 1}-bundle.zip`);
    } else {
      // Single file download
      window.open(images[0].url, '_blank');
    }
  }, [userSubscription, downloadAsZip]);

  const handleRemoveBackground = useCallback(async (image: GenerationImage) => {
    if (!userSubscription || userSubscription.credits_balance < 500) {
      toast({
        variant: "destructive",
        title: "Insufficient Credits",
        description: "You need 500 credits to remove background"
      });
      return;
    }

    setRemovingBgForImage(image.id);

    try {
      const response = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: image.id })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Background Removed!",
          description: `500 credits deducted. ${data.remaining_credits} credits remaining`,
          duration: 5000
        });
        
        // Refresh results
        await fetchResults();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Background Removal Failed",
        description: error.message
      });
    } finally {
      setRemovingBgForImage(null);
    }
  }, [userSubscription, toast, fetchResults]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const expectedImageCount = parseInt(searchParams.get('imageCount') || '1');
  
  const shouldShowPlaceholders = useMemo(() => {
    if (!isPipelineRunning) return false;
    if (!results || results.length === 0) return true;

    const allImages = results.flatMap(r => r.images);
    if (allImages.length < expectedImageCount) return true;

    // Check if images are ready based on tier
    const isProfessional = userSubscription && hasEnhancedFeatures(userSubscription.tier);
    
    return !allImages.every(img => {
      if (isProfessional) {
        return img.basic_upscale_url && img.basic_upscale_status === 'completed';
      } else {
        return img.image_url;
      }
    });
  }, [isPipelineRunning, results, expectedImageCount, userSubscription]);

  const allImages = useMemo(() => {
    return results.flatMap(r => r.images);
  }, [results]);

  // ============================================================================
  // RENDER: FAILURE STATE
  // ============================================================================

  if (generationFailed) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <div>
                <CardTitle>Processing Unsuccessful</CardTitle>
                <CardDescription>
                  {failureDetails?.supportMessage || 'An error occurred during processing'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <Alert variant="default" className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                No credits were charged for this session
              </AlertDescription>
            </Alert>
          </CardContent>
          
          <CardFooter className="flex gap-2">
            <Button onClick={() => navigate('/app/studio')}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => navigate('/app/projects')}>
              Back to Projects
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // RENDER: MAIN PAGE
  // ============================================================================

  return (
    <div className="container max-w-7xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app/projects')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Generation Results</h1>
            {isPipelineRunning && (
              <p className="text-sm text-muted-foreground mt-1">
                {pipelineProgress}
              </p>
            )}
          </div>
        </div>

        {userSubscription && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Credits</p>
            <p className="text-2xl font-bold">{userSubscription.credits_balance?.toLocaleString() || '0'}</p>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {isPipelineRunning && (
        <div className="mb-6">
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground text-center mt-2">
            {progressValue}% Complete
          </p>
        </div>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shouldShowPlaceholders ? (
          // Show placeholders
          Array.from({ length: expectedImageCount }).map((_, i) => (
            <PlaceholderCard key={`placeholder-${i}`} progress={progressValue} />
          ))
        ) : (
          // Show actual images
          allImages.map((image, index) => (
            <ImageCard
              key={image.id}
              image={image}
              sampleIndex={index}
              userTier={userSubscription?.tier || 'free'}
              onImageClick={() => setSelectedImageData({ image, index })}
              onDownload={() => handleDownloadImage(image, index)}
              onRemoveBackground={() => handleRemoveBackground(image)}
              isRemovingBg={removingBgForImage === image.id}
            />
          ))
        )}
      </div>

      {/* Image Modal */}
      {selectedImageData && (
        <ImageModal
          image={selectedImageData.image}
          sampleIndex={selectedImageData.index}
          userTier={userSubscription?.tier || 'free'}
          onClose={() => setSelectedImageData(null)}
          onPrevious={() => {
            const newIndex = selectedImageData.index - 1;
            if (newIndex >= 0) {
              setSelectedImageData({ image: allImages[newIndex], index: newIndex });
            }
          }}
          onNext={() => {
            const newIndex = selectedImageData.index + 1;
            if (newIndex < allImages.length) {
              setSelectedImageData({ image: allImages[newIndex], index: newIndex });
            }
          }}
          hasNext={selectedImageData.index < allImages.length - 1}
          hasPrevious={selectedImageData.index > 0}
        />
      )}
    </div>
  );
}
