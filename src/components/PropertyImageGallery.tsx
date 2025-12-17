import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PropertyWithImages } from "@/hooks/useProperties";

interface PropertyImageGalleryProps {
  property: PropertyWithImages | null;
  open: boolean;
  onClose: () => void;
  initialImageIndex?: number;
}

export function PropertyImageGallery({ 
  property, 
  open, 
  onClose, 
  initialImageIndex = 0 
}: PropertyImageGalleryProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(initialImageIndex);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [zoom, setZoom] = useState<number>(1);
  const increaseZoom = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const decreaseZoom = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const resetZoom = () => setZoom(1);

  console.log('🖼️ PropertyImageGallery - Props:', { 
    property: property?.title, 
    open, 
    initialImageIndex,
    imagesCount: property?.property_images?.length || 0
  });

  // Reset image index when property changes or dialog opens
  useEffect(() => {
    if (open && property) {
      setCurrentImageIndex(initialImageIndex);
      // Garantir estado visual consistente sempre que abrir
      setFitMode('cover');
      setZoom(1);
    }
  }, [property?.id, open, initialImageIndex]);

  // Early return if no property or images
  if (!property || !property.property_images || property.property_images.length === 0) {
    return null;
  }

  const images = property.property_images;
  const safeImageIndex = Math.min(Math.max(currentImageIndex, 0), images.length - 1);
  const currentImage = images[safeImageIndex];

  const handlePrevious = () => {
    setCurrentImageIndex(prev => {
      const newIndex = prev > 0 ? prev - 1 : images.length - 1;
      return Math.min(Math.max(newIndex, 0), images.length - 1);
    });
  };

  const handleNext = () => {
    setCurrentImageIndex(prev => {
      const newIndex = prev < images.length - 1 ? prev + 1 : 0;
      return Math.min(Math.max(newIndex, 0), images.length - 1);
    });
  };

  const handleThumbnailClick = (index: number) => {
    setCurrentImageIndex(index);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[min(92vw,64rem)] max-h-[90vh] bg-gray-900 border-gray-700 text-white overflow-hidden">
        <div className="mx-auto w-[96%] md:w-[94%]">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <DialogTitle className="text-white truncate max-w-[70vw]">{property.title}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFitMode(m => (m === 'cover' ? 'contain' : 'cover'))}
                className="border-gray-600 text-black hover:bg-gray-200"
                title={fitMode === 'cover' ? 'Ajustar: Contain' : 'Ajustar: Cover'}
              >
                {fitMode === 'cover' ? 'Preencher' : 'Conter'}
              </Button>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="border-gray-600 text-black hover:bg-gray-200" onClick={decreaseZoom} title="Diminuir zoom">-</Button>
                <span className="text-sm text-gray-300 w-14 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" className="border-gray-600 text-black hover:bg-gray-200" onClick={increaseZoom} title="Aumentar zoom">+</Button>
                <Button variant="ghost" size="sm" className="text-gray-300" onClick={resetZoom} title="Redefinir zoom">Reset</Button>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-300">
            Imagem {safeImageIndex + 1} de {images.length}
          </p>
        </DialogHeader>

        <div className="space-y-4 px-3 md:px-4 w-full max-w-full">
          {/* Imagem principal */}
          <div className="relative w-full max-w-full rounded-lg border border-gray-800 bg-gray-950/60 mx-auto" style={{ height: '60vh', overflow: 'hidden' }}>
            {currentImage && (
              <div className="w-full h-full flex items-center justify-center max-w-full"
                   style={{ overflow: zoom > 1 ? 'auto' as const : 'hidden' as const }}
                   onWheel={(e) => {
                     if (e.deltaY < 0) increaseZoom();
                     else decreaseZoom();
                   }}
                   onDoubleClick={() => setFitMode(m => (m === 'cover' ? 'contain' : 'cover'))}
              >
                <div
                  className="w-[94%] h-[94%] bg-black rounded-lg overflow-hidden mx-auto"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center'
                  }}
                >
                  <div
                    aria-label={`${property.title} - Imagem ${safeImageIndex + 1}`}
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${currentImage.image_url})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      backgroundSize: fitMode === 'cover' ? 'cover' : 'contain'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Botões de navegação */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm shadow-md z-10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm shadow-md z-10"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="w-full overflow-x-auto max-w-full">
              <div className="flex gap-2 w-max px-2 mx-auto max-w-[94%]">
                {images.map((image, index) => (
                  <button
                    key={`${image.id}-${index}`}
                    onClick={() => handleThumbnailClick(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${
                      index === safeImageIndex
                        ? 'border-blue-500'
                        : 'border-transparent hover:border-gray-400'
                    }`}
                  >
                    <img
                      src={image.image_url}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 