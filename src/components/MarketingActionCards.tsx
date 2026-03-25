import React, { useRef, useState } from 'react';
import { PropertyWithImages } from '@/hooks/useProperties';
import { Button } from '@/components/ui/button';
import { Instagram, FileText, Bed, Bath, Square, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { convertGoogleDriveUrl } from '@/utils/imageUtils';

interface MarketingActionCardsProps {
  property: PropertyWithImages;
}

export function MarketingActionCards({ property }: MarketingActionCardsProps) {
  // Acessando propriedades que podem vir tanto da tabela properties quanto imoveisvivareal
  const p = property as any;
  const [generatingIG, setGeneratingIG] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const igRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Helper to load images robustly for canvas
  const prepareImage = (url: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      // Necessário para evitar CORS em html2canvas se as imagens não estiverem no mesmo domínio
      img.crossOrigin = 'anonymous'; 
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  };

  const handleGenerateInstagram = async () => {
    if (!igRef.current) return;
    try {
      setGeneratingIG(true);
      toast.info('Gerando arte para Instagram...');
      
      const canvas = await html2canvas(igRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // Melhor qualidade
        backgroundColor: '#111827' // bg-gray-900
      });
      
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `post-instagram-${p.listing_id || p.id}.png`;
      link.href = image;
      link.click();
      toast.success('Arte gerada e baixada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar a arte. Tente novamente.');
    } finally {
      setGeneratingIG(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!pdfRef.current) return;
    try {
      setGeneratingPDF(true);
      toast.info('Gerando Ficha Técnica (PDF)...');

      const canvas = await html2canvas(pdfRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: '#FFFFFF'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ficha-tecnica-${p.listing_id || p.id}.pdf`);
      
      toast.success('PDF gerado e baixado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const mainImage = property.property_images?.[0]?.image_url 
    ? convertGoogleDriveUrl(property.property_images[0].image_url) 
    : '/placeholder-property.jpg';

  return (
    <div className="flex gap-2">
      <Button 
        variant="outline"
        className="border-pink-600 text-pink-400 hover:bg-pink-900/30"
        onClick={handleGenerateInstagram}
        disabled={generatingIG}
      >
        <Instagram className="h-4 w-4 mr-2" />
        {generatingIG ? 'Gerando...' : 'Post IG'}
      </Button>
      
      <Button 
        variant="outline"
        className="border-red-600 text-red-400 hover:bg-red-900/30"
        onClick={handleGeneratePDF}
        disabled={generatingPDF}
      >
        <FileText className="h-4 w-4 mr-2" />
        {generatingPDF ? 'Gerando...' : 'Ficha PDF'}
      </Button>

      {/* HIDDEN TEMPLATES FOR RENDER */}
      <div className="fixed top-[-9999px] left-[-9999px] opacity-0 pointer-events-none z-[-1]">
        
        {/* INSTAGRAM TEMPLATE (1080x1080) */}
        <div 
          ref={igRef} 
          style={{ width: '1080px', height: '1080px' }} 
          className="bg-gray-900 relative flex flex-col justify-end p-12 overflow-hidden font-sans"
        >
          {/* Background Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center z-0"
            style={{ backgroundImage: `url(${mainImage})` }}
          />
          {/* Default Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent z-10" />
          
          {/* Content */}
          <div className="relative z-20 text-white">
            <div className="bg-blue-600 text-white px-6 py-2 uppercase tracking-widest font-bold text-xl rounded-md inline-block mb-6 shadow-lg">
              {p.disponibilidade === 'disponivel' ? 'Disponível' : 'Oportunidade'}
            </div>
            
            <h1 className="text-6xl font-extrabold mb-4 leading-tight drop-shadow-md">
              {property.title || 'Lindo Imóvel'}
            </h1>
            
            <p className="text-3xl text-gray-200 mb-8 font-light flex items-center gap-3 drop-shadow">
              📍 {property.city} - {p.bairro || property.address}
            </p>
            
            <div className="flex gap-8 mb-10">
              {property.area && (
                <div className="bg-gray-800/80 backdrop-blur-sm px-6 py-4 rounded-xl border border-gray-700 min-w-[140px]">
                  <p className="text-gray-400 text-base uppercase tracking-wider mb-1">Área</p>
                  <p className="text-4xl font-bold">{property.area} <span className="text-2xl text-gray-300">m²</span></p>
                </div>
              )}
              {property.bedrooms && (
                <div className="bg-gray-800/80 backdrop-blur-sm px-6 py-4 rounded-xl border border-gray-700 min-w-[140px]">
                  <p className="text-gray-400 text-base uppercase tracking-wider mb-1">Quartos</p>
                  <p className="text-4xl font-bold">{property.bedrooms}</p>
                </div>
              )}
              {property.bathrooms && (
                <div className="bg-gray-800/80 backdrop-blur-sm px-6 py-4 rounded-xl border border-gray-700 min-w-[140px]">
                  <p className="text-gray-400 text-base uppercase tracking-wider mb-1">Banheiros</p>
                  <p className="text-4xl font-bold">{property.bathrooms}</p>
                </div>
              )}
            </div>
            
            <div className="border-t border-gray-600/50 pt-8 flex justify-between items-end">
              <div>
                <p className="text-gray-400 text-2xl uppercase tracking-wider mb-2">Valor</p>
                <p className="text-7xl font-black text-emerald-400 drop-shadow-lg">
                  R$ {Number(property.price).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white mb-2">Ref: {p.listing_id || p.id}</p>
                <p className="text-xl text-gray-400 tracking-wide">Deslize para ver mais ➔</p>
              </div>
            </div>
          </div>
        </div>

        {/* PDF A4 TEMPLATE (approx 794x1123 px at 96 DPI, we'll use 800x1131 for good scale) */}
        <div 
          ref={pdfRef} 
          style={{ width: '800px', height: '1131px' }} 
          className="bg-white text-gray-900 relative font-sans flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-8 border-b border-gray-200 bg-gray-50">
            <div>
              <h2 className="text-3xl font-black text-blue-600">FICHA TÉCNICA</h2>
              <p className="text-gray-500 text-lg mt-1">Ref: {p.listing_id || p.id}</p>
            </div>
            <div className="text-right">
              <h3 className="text-xl font-bold text-gray-800">Sua Imobiliária</h3>
              <p className="text-gray-500 mt-1">Contato: Consulte o Corretor</p>
            </div>
          </div>

          {/* Banner Image */}
          <div className="w-full h-80 bg-gray-200 relative">
            <img src={mainImage} className="w-full h-full object-cover" alt="Principal" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
              <h1 className="text-4xl font-bold text-white mb-2 shadow-sm">{property.title}</h1>
              <p className="text-xl text-gray-200">📍 {property.city} - {property.address}</p>
            </div>
          </div>

          {/* Details Body */}
          <div className="p-8 flex-1">
            <div className="flex justify-between items-start mb-10">
              <div>
                <p className="text-gray-500 text-lg uppercase tracking-wide mb-1">Preço de Venda</p>
                <p className="text-5xl font-black text-emerald-600">R$ {Number(property.price).toLocaleString('pt-BR')}</p>
              </div>
              
              <div className="flex gap-4">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-center min-w-[100px] border border-blue-100">
                  <p className="text-sm uppercase font-bold text-blue-500 mb-1">Área</p>
                  <p className="text-2xl font-black">{property.area} m²</p>
                </div>
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-center min-w-[100px] border border-blue-100">
                  <p className="text-sm uppercase font-bold text-blue-500 mb-1">Quartos</p>
                  <p className="text-2xl font-black">{property.bedrooms || '-'}</p>
                </div>
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-center min-w-[100px] border border-blue-100">
                  <p className="text-sm uppercase font-bold text-blue-500 mb-1">Banheiros</p>
                  <p className="text-2xl font-black">{property.bathrooms || '-'}</p>
                </div>
              </div>
            </div>

            <div className="mb-10">
              <h3 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Descrição do Imóvel</h3>
              <p className="text-gray-600 leading-relaxed text-lg text-justify">
                {property.description || 'Descrição não informada para este imóvel. Para mais detalhes, entre em contato.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">Detalhes Extras</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex justify-between border-b border-gray-100 py-1">
                    <span className="font-medium">Tipo:</span> 
                    <span>{p.tipo_imovel || 'Imóvel'}</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-100 py-1">
                    <span className="font-medium">Categoria:</span> 
                    <span>{p.tipo_categoria === 'Residential' ? 'Residencial' : p.tipo_categoria === 'Commercial' ? 'Comercial' : 'Outro'}</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-100 py-1">
                    <span className="font-medium">Disponibilidade:</span> 
                    <span className="capitalize">{p.disponibilidade || 'Disponível'}</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">Galeria Menor</h3>
                <div className="grid grid-cols-2 gap-2">
                  {property.property_images?.slice(1, 5).map((img, i) => (
                    <div key={i} className="aspect-video bg-gray-200 rounded overflow-hidden">
                      <img src={convertGoogleDriveUrl(img.image_url)} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-blue-600 text-white p-6 text-center mt-auto">
            <p className="text-xl font-bold mb-2">Ficou interessado(a)? Entre em contato agora mesmo!</p>
            <p className="text-blue-200">Este documento foi gerado automaticamente pelo Sistema IAFÉ Imobi CRM.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
