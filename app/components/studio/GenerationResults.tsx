import { useState } from "react";
import { ArrowLeft, Download, X } from "lucide-react";

interface GenerationImage {
  id: string;
  url: string;
  pose_name: string;
}

interface Props {
  projectName: string;
  images: GenerationImage[];
  onBack: () => void;
}

export function GenerationResults({ projectName, images, onBack }: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Back Button */}
      <div className="lg:hidden px-4 pt-6 pb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
      </div>

      {/* Header Section */}
      <div className="bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-8 lg:py-8 pt-4">
          {/* Desktop Back Button */}
          <div className="hidden lg:block mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Studio
            </button>
          </div>

          {/* Title and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                {projectName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {images.length} {images.length === 1 ? "image" : "images"} generated
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Download all images logic
                  images.forEach((img, idx) => {
                    downloadImage(img.url, `generated-image-${idx + 1}.png`);
                  });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download All</span>
                <span className="sm:hidden">All</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Images Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="group relative bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200"
            >
              {/* Image */}
              <div
                className="aspect-[3/4] cursor-pointer overflow-hidden"
                onClick={() => setSelectedImage(image.url)}
              >
                <img
                  src={image.url}
                  alt={`Generated ${image.pose_name}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>

              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage(image.url, `${projectName}-${index + 1}.png`);
                  }}
                  className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>

              {/* Image Info */}
              <div className="p-4 bg-card border-t border-border">
                <p className="text-sm font-medium text-foreground">
                  {image.pose_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  2K Resolution
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Screen Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]">
            {/* Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Image */}
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Download Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(selectedImage, `${projectName}-fullsize.png`);
              }}
              className="absolute bottom-4 right-4 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
