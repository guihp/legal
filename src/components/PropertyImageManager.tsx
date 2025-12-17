import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DatabasePropertyImage } from "@/hooks/useProperties";
import { convertMultipleToWebP } from "@/utils/imageUtils";
import { useToast } from "@/hooks/use-toast";

interface PropertyImageManagerProps {
  existingImages: DatabasePropertyImage[];
  onImagesChange: (images: DatabasePropertyImage[]) => void;
  onNewImagesChange: (files: File[], previews: string[]) => void;
  onImagesToDeleteChange: (imageIds: string[]) => void;
  newImageFiles: File[];
  newImagePreviews: string[];
  imagesToDelete: string[];
}

export function PropertyImageManager({
  existingImages,
  onImagesChange,
  onNewImagesChange,
  onImagesToDeleteChange,
  newImageFiles,
  newImagePreviews,
  imagesToDelete
}: PropertyImageManagerProps) {
  const { toast } = useToast();
  const [converting, setConverting] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    
    // Verificar tamanho dos arquivos (max 5MB cada)
    const oversizedFiles = newFiles.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "Arquivos muito grandes",
        description: `${oversizedFiles.length} arquivo(s) excedem o limite de 5MB e foram ignorados.`,
        variant: "destructive",
      });
      return;
    }

    setConverting(true);
    
    try {
      console.log('🔄 Convertendo imagens para WebP...', newFiles.length, 'arquivos');
      
      // Converter todas as imagens para WebP
      const convertedFiles = await convertMultipleToWebP(newFiles, 0.85, 1200, 800);
      
      console.log('✅ Conversão concluída!', convertedFiles.length, 'arquivos convertidos');
      
      const updatedFiles = [...newImageFiles, ...convertedFiles];
      
      // Gerar previews das imagens convertidas
      const newPreviews: string[] = [];
      let processedCount = 0;
      
      convertedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            newPreviews.push(event.target.result as string);
            processedCount += 1;
            
            if (processedCount === convertedFiles.length) {
              onNewImagesChange(updatedFiles, [...newImagePreviews, ...newPreviews]);
              
              toast({
                title: "Imagens processadas",
                description: `${convertedFiles.length} imagem(ns) convertida(s) para WebP com sucesso!`,
              });
            }
          }
        };
        reader.readAsDataURL(file);
      });
      
    } catch (error) {
      console.error('❌ Erro na conversão:', error);
      toast({
        title: "Erro na conversão",
        description: "Falha ao converter imagens. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const removeNewImage = (index: number) => {
    const updatedFiles = newImageFiles.filter((_, i) => i !== index);
    const updatedPreviews = newImagePreviews.filter((_, i) => i !== index);
    onNewImagesChange(updatedFiles, updatedPreviews);
  };

  const removeExistingImage = (imageId: string) => {
    const updatedImages = existingImages.filter(img => img.id !== imageId);
    const updatedImagesToDelete = [...imagesToDelete, imageId];
    
    onImagesChange(updatedImages);
    onImagesToDeleteChange(updatedImagesToDelete);
    
    console.log('🗑️ Imagem marcada para remoção:', imageId);
  };

  return (
    <div className="space-y-4">
      <Label className="text-gray-300">Imagens</Label>
      
      {/* Existing Images */}
      {existingImages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm text-gray-400">Imagens atuais</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {existingImages.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.image_url}
                  alt="Imagem da propriedade"
                  className="w-full h-24 object-cover rounded-lg bg-gray-800"
                />
                <button
                  type="button"
                  onClick={() => removeExistingImage(image.id)}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Images Upload */}
      <div className="space-y-4">
        <div className="flex items-center justify-center w-full">
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg transition-colors ${converting ? 'cursor-not-allowed bg-gray-800 opacity-50' : 'cursor-pointer bg-gray-900 hover:bg-gray-800'}`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className={`w-8 h-8 mb-2 text-gray-400 ${converting ? 'animate-spin' : ''}`} />
              <p className="mb-2 text-sm text-gray-400">
                <span className="font-semibold">
                  {converting ? 'Convertendo para WebP...' : 'Clique para adicionar imagens'}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {converting ? 'Aguarde o processamento...' : 'PNG, JPG, JPEG (MAX. 5MB cada) - Convertido automaticamente para WebP'}
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              disabled={converting}
            />
          </label>
        </div>

        {newImagePreviews.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm text-gray-400">Novas imagens</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {newImagePreviews.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Nova imagem ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg bg-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
