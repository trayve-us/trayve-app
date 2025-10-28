import { useState, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { GuidelinesSection } from "./GuidelinesSection";

interface UploadStepProps {
  uploadedFile: File | null;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onRemoveFile: () => void;
}

export function UploadStep({
  uploadedFile,
  previewUrl,
  onFileSelect,
  onRemoveFile,
}: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="h-full flex items-center justify-center pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
        {/* Main Upload Section - Left Side (2/3 width on desktop) */}
        <div className="lg:col-span-2 flex flex-col justify-center space-y-8">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              On-Model Photos
            </h2>
          </div>

          {/* Image Showcase Cards */}
          <div className="flex justify-center items-center space-x-4 flex-wrap gap-4">
            {!uploadedFile ? (
              <>
                {/* Left placeholder card - Hidden on mobile */}
                <div className="hidden sm:block w-28 h-36 bg-muted/50 rounded-xl border border-border transform -rotate-12 opacity-70">
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-muted to-muted/70"></div>
                </div>

                {/* Center main image card */}
                <div
                  className="relative w-40 h-52 bg-card rounded-xl border border-border shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow"
                  onClick={() => {
                    const fileInput = document.getElementById("center-card-file-input") as HTMLInputElement;
                    fileInput?.click();
                  }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-muted/30 to-muted/60 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-background/80 flex items-center justify-center">
                      <Upload className="w-7 h-7 text-muted-foreground" />
                    </div>
                  </div>
                  <input
                    id="center-card-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {/* Right placeholder card - Hidden on mobile */}
                <div className="hidden sm:block w-28 h-36 bg-muted/50 rounded-xl border border-border transform rotate-12 opacity-70">
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-muted to-muted/70"></div>
                </div>
              </>
            ) : (
              <div className="relative w-72 h-96">
                <img
                  src={previewUrl!}
                  alt="Uploaded clothing"
                  className="w-full h-full object-contain rounded-xl"
                />
                <button
                  onClick={onRemoveFile}
                  className="absolute top-2 right-2 w-8 h-8 bg-background/90 hover:bg-destructive text-muted-foreground hover:text-destructive-foreground rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm border border-border hover:border-destructive shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Upload Section */}
          {!uploadedFile && (
            <div className="text-center space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Upload On-Model Photos to Begin
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop images here - PNG, JPG, WebP or HEIC
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <div
                  className={`relative rounded-2xl p-8 border-2 border-dashed transition-all duration-300 cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[1.02]"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-4 px-8 rounded-xl transition-colors flex items-center justify-center space-x-2 shadow-lg">
                    <span>Upload all your images</span>
                    <span className="text-xl">+</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Guidelines */}
          <div className="lg:hidden mt-8 pb-8">
            <GuidelinesSection />
          </div>
        </div>

        {/* Guidelines Section - Right Side (1/3 width on desktop, hidden on mobile) */}
        <div className="hidden lg:block lg:col-span-1">
          <GuidelinesSection />
        </div>
      </div>
    </div>
  );
}
