import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2 } from "lucide-react";
import { PropertyWithImages } from "@/hooks/useProperties";
import { PropertyFormFields } from "./PropertyFormFields";
import { PropertyImageManager } from "./PropertyImageManager";
import { usePropertyEdit } from "@/hooks/usePropertyEdit";
import { useEffect } from "react";

interface PropertyEditFormProps {
  property: PropertyWithImages;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PropertyEditForm({ property, onSubmit, onCancel }: PropertyEditFormProps) {
  const {
    formData,
    loading,
    imageFiles,
    imagePreviewUrls,
    existingImages,
    imagesToDelete,
    handleFormChange,
    handleSubmit,
    setImageFiles,
    setImagePreviewUrls,
    setExistingImages,
    setImagesToDelete,
  } = usePropertyEdit(property);

  useEffect(() => {
    setExistingImages(property.property_images || []);
  }, [property.id, setExistingImages]);

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🚀 Enviando formData para update:", formData);
    await handleSubmit(() => {
      if (typeof onSubmit === "function") {
        onSubmit();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onCancel}
          className="text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Editar Propriedade</h1>
          <p className="text-gray-400">Atualize os dados do imóvel</p>
        </div>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações da Propriedade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onFormSubmit} className="space-y-6">
            <PropertyFormFields 
              formData={formData} 
              onChange={handleFormChange}
              readOnlyCode={true}
            />

            <PropertyImageManager
              existingImages={existingImages}
              onImagesChange={setExistingImages}
              onNewImagesChange={(files, previews) => {
                setImageFiles(files);
                setImagePreviewUrls(previews);
              }}
              onImagesToDeleteChange={setImagesToDelete}
              newImageFiles={imageFiles}
              newImagePreviews={imagePreviewUrls}
              imagesToDelete={imagesToDelete}
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1 border-gray-600 text-red-400 hover:bg-gray-700 hover:text-red-300"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
