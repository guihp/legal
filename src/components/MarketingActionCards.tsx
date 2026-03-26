import React, { useMemo, useRef, useState } from 'react';
import { PropertyWithImages } from '@/hooks/useProperties';
import { Button } from '@/components/ui/button';
import { Instagram, FileText } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { convertGoogleDriveUrl } from '@/utils/imageUtils';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { normalizeBrandDisplayName } from '@/lib/brandingDisplay';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
  const { settings } = useCompanySettings();
  const [igPickerOpen, setIgPickerOpen] = useState(false);
  const [selectedIgBg, setSelectedIgBg] = useState<string | null>(null);

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

  const handleOpenIgPicker = () => {
    setIgPickerOpen(true);
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

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Render multi-página (evita PDF "cortado" quando o canvas é mais alto que A4)
      const pageCanvas = document.createElement('canvas');
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Falha ao criar canvas do PDF');

      // altura em px que cabe numa página A4 mantendo a largura
      const sliceHpx = Math.floor(canvas.width * (pageH / pageW));
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHpx;

      let y = 0;
      let pageIndex = 0;
      while (y < canvas.height) {
        const h = Math.min(sliceHpx, canvas.height - y);
        if (pageIndex > 0) pdf.addPage();

        // limpar + desenhar slice
        ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const imgHmm = (h * pageW) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pageW, imgHmm);

        y += h;
        pageIndex++;
      }
      pdf.save(`ficha-tecnica-${p.listing_id || p.id}.pdf`);
      
      toast.success('PDF gerado e baixado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const allImages = useMemo(() => {
    const list: string[] = [];
    // DB property_images (legacy)
    const imgs = property.property_images || [];
    for (const it of imgs) {
      if (it?.image_url) list.push(convertGoogleDriveUrl(it.image_url));
    }
    // VivaReal style: p.imagens array
    if (Array.isArray((p as any)?.imagens)) {
      for (const u of (p as any).imagens as string[]) {
        if (u) list.push(u);
      }
    }
    return Array.from(new Set(list.filter(Boolean)));
  }, [property.property_images, p]);

  const mainImage = allImages[0] || '/placeholder-property.jpg';
  const igBackground = selectedIgBg || mainImage;

  const companyNameRaw = (settings?.display_name || 'Sua Imobiliária').toString();
  const companyName = normalizeBrandDisplayName(companyNameRaw) || companyNameRaw;
  const companyLogo = (settings?.logo_url || '').toString().trim();
  const accent = (settings?.primary_color || '#0ea5e9').toString();
  const contactLine = settings?.display_subtitle ? settings.display_subtitle : 'Contato: WhatsApp';

  return (
    <div className="flex gap-2">
      <Button 
        variant="outline"
        className="border-pink-600 text-pink-400 hover:bg-pink-900/30"
        onClick={handleOpenIgPicker}
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

      <Dialog open={igPickerOpen} onOpenChange={setIgPickerOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Escolha a foto de fundo</DialogTitle>
            <DialogDescription className="text-gray-400">
              Selecione qual imagem do imóvel vai aparecer como fundo do Post IG.
            </DialogDescription>
          </DialogHeader>

          {allImages.length === 0 ? (
            <div className="text-gray-400">Este imóvel não possui imagens cadastradas.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {allImages.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSelectedIgBg(url)}
                  className={`relative aspect-square overflow-hidden rounded-lg border ${
                    (selectedIgBg || mainImage) === url ? 'border-pink-500' : 'border-gray-700'
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="border-gray-700 text-gray-200 hover:bg-gray-800" onClick={() => setIgPickerOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-pink-600 hover:bg-pink-700 text-white"
              onClick={async () => {
                setIgPickerOpen(false);
                await handleGenerateInstagram();
              }}
              disabled={allImages.length === 0}
            >
              Gerar Post IG
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            style={{ backgroundImage: `url(${igBackground})` }}
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

        {/* PDF A4 TEMPLATE (renderizado via html2canvas) */}
        <div 
          ref={pdfRef} 
          style={{ width: '800px', height: '1131px' }} 
          className="bg-white text-gray-900 relative font-sans flex flex-col"
        >
          {/* Header premium */}
          <div className="p-10 border-b border-gray-200 bg-gray-50">
            <div className="flex items-start justify-between gap-8">
              <div className="flex items-start gap-4">
                {companyLogo ? (
                  <img src={companyLogo} className="h-12 w-auto max-w-[200px] object-contain" alt="" />
                ) : (
                  <div
                    className="h-12 w-12 rounded-xl text-white flex items-center justify-center font-black text-lg"
                    style={{ background: accent }}
                  >
                    {companyName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-gray-500 font-semibold">Ficha técnica</p>
                  <h2 className="text-3xl font-black text-gray-900 leading-tight">{companyName}</h2>
                  <p className="text-sm text-gray-600 mt-1">{contactLine}</p>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Ref</span>
                  <span className="text-sm font-black text-gray-900">{p.listing_id || p.id}</span>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Preço</p>
                  <p className="text-4xl font-black" style={{ color: accent }}>
                    R$ {Number(property.price).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Banner Image */}
          <div className="w-full h-80 bg-gray-200 relative">
            <img src={mainImage} className="w-full h-full object-cover" alt="Principal" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-7">
              <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                {p.disponibilidade === 'disponivel' ? 'Disponível' : 'Sob consulta'}
              </div>
              <h1 className="text-4xl font-black text-white mt-3 leading-tight drop-shadow">{property.title}</h1>
              <p className="text-lg text-white/85 mt-2">📍 {property.city} - {property.address}</p>
            </div>
          </div>

          {/* Details Body */}
          <div className="p-10 flex-1">
            <div className="grid grid-cols-4 gap-4 mb-10">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Área</p>
                <p className="mt-2 text-3xl font-black text-gray-900">{property.area ? `${property.area} m²` : '—'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Quartos</p>
                <p className="mt-2 text-3xl font-black text-gray-900">{property.bedrooms || '—'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Banheiros</p>
                <p className="mt-2 text-3xl font-black text-gray-900">{property.bathrooms || '—'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Código</p>
                <p className="mt-2 text-xl font-black text-gray-900">{p.listing_id || p.id}</p>
              </div>
            </div>

            <div className="mb-10">
              <h3 className="text-2xl font-black text-gray-900 mb-4">Descrição</h3>
              <p className="text-gray-700 leading-relaxed text-lg">
                {property.description || 'Descrição não informada para este imóvel. Para mais detalhes, entre em contato.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-3">Detalhes</h3>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex justify-between">
                      <span className="font-semibold text-gray-600">Tipo</span>
                      <span className="font-bold text-gray-900">{p.tipo_imovel || 'Imóvel'}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="font-semibold text-gray-600">Categoria</span>
                      <span className="font-bold text-gray-900">
                        {p.tipo_categoria === 'Residential' ? 'Residencial' : p.tipo_categoria === 'Commercial' ? 'Comercial' : 'Outro'}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="font-semibold text-gray-600">Status</span>
                      <span className="font-bold text-gray-900">{p.disponibilidade || 'Disponível'}</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-3">Galeria</h3>
                <div className="grid grid-cols-2 gap-3">
                  {property.property_images?.slice(1, 5).map((img, i) => (
                    <div key={i} className="aspect-video bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
                      <img src={convertGoogleDriveUrl(img.image_url)} className="w-full h-full object-cover" alt="" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto p-8 text-white" style={{ background: accent }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-black">Gostou do imóvel?</p>
                <p className="text-white/90 mt-1">Chame no WhatsApp para agendar visita e receber mais fotos.</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-white/80 font-bold">Gerado por</p>
                <p className="text-base font-black">IAFÉ IMOBI CRM</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
