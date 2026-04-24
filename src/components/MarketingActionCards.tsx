import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PropertyWithImages } from '@/hooks/useProperties';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Instagram, FileText, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { convertGoogleDriveUrl } from '@/utils/imageUtils';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useOwnCompany } from '@/hooks/useOwnCompany';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface MarketingActionCardsProps {
  property: PropertyWithImages;
}

/* -------------------------------------------------------------------------- */
/* Shared tiny helpers                                                        */
/* -------------------------------------------------------------------------- */

const waitImageReady = (url: string) =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve();
    img.onerror = () => resolve(); // sem bloquear a geração
    img.src = url;
  });

// ColorField: label + native color input + hex readout
const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <Label className="text-sm text-gray-300">{label}</Label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded border border-gray-700 bg-gray-800 p-0"
      />
      <span className="min-w-[72px] rounded bg-gray-800 px-2 py-1 text-center text-xs font-mono text-gray-300">
        {value.toUpperCase()}
      </span>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Instagram slide templates (1080x1080).                                     */
/* Exportadas como componentes para serem compartilhadas entre o preview      */
/* visível e os templates escondidos usados no html2canvas.                   */
/* -------------------------------------------------------------------------- */

type IgTemplateCommonProps = {
  bgUrl: string;
  bgRef?: React.Ref<HTMLDivElement>;
  titleColor: string;
  textColor: string;
  accentColor: string;
};

// SLIDE 1 (primeiro): info completa
const IgSlideFirst = React.forwardRef<
  HTMLDivElement,
  IgTemplateCommonProps & {
    title: string;
    address: string;
    city: string;
    bairro?: string | null;
    area?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    price: number | null | undefined;
    listingId: string | number | undefined;
    available: boolean;
  }
>(function IgSlideFirst(props, ref) {
  const {
    bgUrl, bgRef, titleColor, textColor, accentColor,
    title, address, city, bairro, area, bedrooms, bathrooms, price, listingId, available,
  } = props;
  return (
    <div
      ref={ref}
      style={{ width: '1080px', height: '1080px' }}
      className="bg-gray-900 relative flex flex-col justify-end p-12 overflow-hidden font-sans"
    >
      <div
        ref={bgRef}
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: `url("${bgUrl}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent z-10" />

      <div className="relative z-20" style={{ color: textColor }}>
        {/* Badge DISPONÍVEL — agora centralizado via inline-flex + letter-spacing simétrico */}
        <div
          className="inline-flex items-center justify-center bg-blue-600 text-white font-bold uppercase text-xl rounded-md mb-6 shadow-lg"
          style={{ padding: '10px 28px', letterSpacing: '0.15em', lineHeight: 1 }}
        >
          <span className="inline-block" style={{ transform: 'translateX(2px)' }}>
            {available ? 'Disponível' : 'Oportunidade'}
          </span>
        </div>

        <h1
          className="font-extrabold mb-4 leading-tight drop-shadow-md"
          style={{ color: titleColor, fontSize: 72 }}
        >
          {title || 'Lindo Imóvel'}
        </h1>

        <p className="text-3xl mb-8 font-light flex items-center gap-3 drop-shadow" style={{ color: textColor }}>
          📍 {city} - {bairro || address}
        </p>

        <div className="flex gap-8 mb-10">
          {area && (
            <div className="bg-gray-800/80 backdrop-blur-sm px-6 py-4 rounded-xl border border-gray-700 min-w-[140px]">
              <p className="text-gray-400 text-base uppercase tracking-wider mb-1">Área</p>
              <p className="text-4xl font-bold" style={{ color: textColor }}>{area} <span className="text-2xl text-gray-300">m²</span></p>
            </div>
          )}
          {bedrooms != null && (
            <div className="bg-gray-800/80 backdrop-blur-sm px-6 py-4 rounded-xl border border-gray-700 min-w-[140px]">
              <p className="text-gray-400 text-base uppercase tracking-wider mb-1">Quartos</p>
              <p className="text-4xl font-bold" style={{ color: textColor }}>{bedrooms}</p>
            </div>
          )}
          {bathrooms != null && (
            <div className="bg-gray-800/80 backdrop-blur-sm px-6 py-4 rounded-xl border border-gray-700 min-w-[140px]">
              <p className="text-gray-400 text-base uppercase tracking-wider mb-1">Banheiros</p>
              <p className="text-4xl font-bold" style={{ color: textColor }}>{bathrooms}</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-600/50 pt-8 flex justify-between items-end">
          <div>
            <p className="text-2xl uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>Valor</p>
            <p className="text-7xl font-black drop-shadow-lg" style={{ color: accentColor }}>
              R$ {Number(price || 0).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold mb-2" style={{ color: titleColor }}>Ref: {listingId}</p>
            <p className="text-xl tracking-wide" style={{ color: '#9ca3af' }}>Deslize para ver mais ➔</p>
          </div>
        </div>
      </div>
    </div>
  );
});

// SLIDE do meio: foto + "Deslize para ver mais"
const IgSlideMiddle = React.forwardRef<
  HTMLDivElement,
  IgTemplateCommonProps
>(function IgSlideMiddle(props, ref) {
  const { bgUrl, bgRef, titleColor, textColor, accentColor } = props;
  return (
    <div
      ref={ref}
      style={{ width: '1080px', height: '1080px' }}
      className="bg-gray-900 relative flex flex-col justify-end items-end p-12 overflow-hidden font-sans"
    >
      <div
        ref={bgRef}
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: `url("${bgUrl}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 via-transparent to-transparent z-10" />

      <div
        className="relative z-20 inline-flex items-center gap-4 rounded-full px-8 py-5 backdrop-blur-md shadow-2xl"
        style={{ background: 'rgba(17,24,39,0.6)', border: `1px solid ${accentColor}55` }}
      >
        <span className="text-2xl font-semibold uppercase tracking-[0.2em]" style={{ color: titleColor }}>
          Deslize para ver mais
        </span>
        <span className="text-3xl" style={{ color: accentColor }}>➔</span>
      </div>
      {/* sutil marca d'água na base */}
      <p className="relative z-20 mt-6 text-sm uppercase tracking-[0.3em] self-end" style={{ color: textColor, opacity: 0.7 }}>
        Role as fotos
      </p>
    </div>
  );
});

// ÚLTIMO SLIDE: CTA para agendar visita
const IgSlideLast = React.forwardRef<
  HTMLDivElement,
  IgTemplateCommonProps & {
    ctaTitle: string;
    ctaSubtitle: string;
    companyName: string;
  }
>(function IgSlideLast(props, ref) {
  const { bgUrl, bgRef, titleColor, textColor, accentColor, ctaTitle, ctaSubtitle, companyName } = props;
  return (
    <div
      ref={ref}
      style={{ width: '1080px', height: '1080px' }}
      className="bg-gray-900 relative flex flex-col justify-center items-center p-16 overflow-hidden font-sans text-center"
    >
      <div
        ref={bgRef}
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: `url("${bgUrl}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/70 to-gray-900/90 z-10" />

      <div className="relative z-20 max-w-[900px]">
        <p className="text-2xl uppercase tracking-[0.35em] mb-6" style={{ color: accentColor }}>
          ✨ Gostou?
        </p>
        <h1 className="font-black leading-tight drop-shadow-2xl" style={{ color: titleColor, fontSize: 90 }}>
          {ctaTitle || 'Agende sua visita'}
        </h1>
        <p className="mt-8 text-3xl font-light" style={{ color: textColor }}>
          {ctaSubtitle || 'Chame no WhatsApp e marque seu horário para conhecer pessoalmente.'}
        </p>

        <div
          className="mt-12 inline-flex items-center justify-center rounded-full px-14 py-6 text-3xl font-black uppercase tracking-widest shadow-2xl"
          style={{ background: accentColor, color: '#0b1220' }}
        >
          💬 Chame no WhatsApp
        </div>

        <p className="mt-10 text-xl tracking-widest uppercase" style={{ color: textColor, opacity: 0.8 }}>
          {companyName}
        </p>
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* PDF Template (A4 800x1131+)                                                */
/* -------------------------------------------------------------------------- */

type PdfTemplateProps = {
  property: PropertyWithImages;
  raw: any; // campos extras (bairro, disponibilidade etc.)
  mainImage: string;
  gallery: string[];
  title: string;
  titleColor: string;
  descColor: string;
  footerColor: string;
  companyName: string;
  companyLogo: string;
  contactLine: string;
  accent: string;
};

const PdfTemplate = React.forwardRef<HTMLDivElement, PdfTemplateProps>(function PdfTemplate(props, ref) {
  const { property, raw: p, mainImage, gallery, title, titleColor, descColor, footerColor, companyName, companyLogo, contactLine, accent } = props;
  return (
    <div
      ref={ref}
      style={{ width: '800px', minHeight: '1131px' }}
      className="bg-white text-gray-900 relative font-sans flex flex-col"
    >
      {/* Header premium com logo + nome da imobiliária */}
      <div className="p-10 border-b border-gray-200 bg-gray-50">
        <div className="flex items-start justify-between gap-8">
          <div className="flex items-center gap-5">
            {companyLogo ? (
              <img src={companyLogo} className="h-16 w-auto max-w-[220px] object-contain" alt="" crossOrigin="anonymous" />
            ) : (
              <div
                className="h-16 w-16 rounded-2xl text-white flex items-center justify-center font-black text-2xl shadow-md"
                style={{ background: accent }}
              >
                {companyName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500 font-semibold">Ficha técnica</p>
              <h2 className="text-3xl font-black leading-tight" style={{ color: titleColor }}>{companyName}</h2>
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

      {/* Banner Image com título customizável */}
      <div className="w-full h-80 bg-gray-200 relative">
        <img src={mainImage} className="w-full h-full object-cover" alt="Principal" crossOrigin="anonymous" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-7">
          <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            {p.disponibilidade === 'disponivel' ? 'Disponível' : 'Sob consulta'}
          </div>
          <h1 className="text-4xl font-black mt-3 leading-tight drop-shadow" style={{ color: '#ffffff' }}>{title}</h1>
          <p className="text-lg mt-2" style={{ color: 'rgba(255,255,255,0.9)' }}>📍 {property.city} - {property.address}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-10">
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
          <h3 className="text-2xl font-black mb-4" style={{ color: titleColor }}>Descrição</h3>
          <p className="leading-relaxed text-lg whitespace-pre-line" style={{ color: descColor }}>
            {property.description || 'Descrição não informada para este imóvel. Para mais detalhes, entre em contato.'}
          </p>
        </div>

        <div className="grid grid-cols-5 gap-6 mb-10">
          <div className="col-span-2">
            <h3 className="text-xl font-black mb-3" style={{ color: titleColor }}>Detalhes</h3>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <ul className="space-y-3" style={{ color: descColor }}>
                <li className="flex justify-between">
                  <span className="font-semibold" style={{ color: '#6b7280' }}>Tipo</span>
                  <span className="font-bold text-gray-900">{p.tipo_imovel || 'Imóvel'}</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-semibold" style={{ color: '#6b7280' }}>Categoria</span>
                  <span className="font-bold text-gray-900">
                    {p.tipo_categoria === 'Residential' ? 'Residencial' : p.tipo_categoria === 'Commercial' ? 'Comercial' : 'Outro'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="font-semibold" style={{ color: '#6b7280' }}>Status</span>
                  <span className="font-bold text-gray-900">{p.disponibilidade || 'Disponível'}</span>
                </li>
                {p.garagem != null && (
                  <li className="flex justify-between">
                    <span className="font-semibold" style={{ color: '#6b7280' }}>Garagem</span>
                    <span className="font-bold text-gray-900">{p.garagem} vaga(s)</span>
                  </li>
                )}
                {p.bairro && (
                  <li className="flex justify-between">
                    <span className="font-semibold" style={{ color: '#6b7280' }}>Bairro</span>
                    <span className="font-bold text-gray-900">{p.bairro}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="col-span-3">
            <h3 className="text-xl font-black mb-3" style={{ color: titleColor }}>Galeria</h3>
            {/* Galeria com mosaico e mais respiro entre as fotos */}
            <div className="grid grid-cols-3 gap-4">
              {gallery.slice(0, 6).map((url, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] bg-gray-100 rounded-2xl overflow-hidden shadow-sm ring-1 ring-gray-200"
                >
                  <img src={url} className="w-full h-full object-cover" alt="" crossOrigin="anonymous" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer "Gostou do imóvel?" com cor customizável */}
      <div className="p-8 text-white" style={{ background: footerColor }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-black">Gostou do imóvel?</p>
            <p className="text-white/90 mt-1">Chame no WhatsApp para agendar visita e receber mais fotos.</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-white/80 font-bold">Gerado por</p>
            <p className="text-base font-black">{companyName}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export function MarketingActionCards({ property }: MarketingActionCardsProps) {
  const p = property as any;
  const { settings } = useCompanySettings();
  const { company: loggedCompany } = useOwnCompany();

  /* ---------------- Company/branding defaults ---------------- */
  const companyName = (
    loggedCompany?.name ||
    settings?.display_name ||
    'Sua Imobiliária'
  ).toString().trim();
  const companyLogo = (
    loggedCompany?.logo_url ||
    settings?.logo_url ||
    ''
  ).toString().trim();
  const brandAccent = (settings?.primary_color || '#0ea5e9').toString();
  const contactLine = settings?.display_subtitle ? settings.display_subtitle : 'Contato: WhatsApp';

  /* ---------------- Images ---------------- */
  const allImages = useMemo(() => {
    const list: string[] = [];
    const imgs = property.property_images || [];
    for (const it of imgs) if (it?.image_url) list.push(convertGoogleDriveUrl(it.image_url));
    if (Array.isArray((p as any)?.imagens)) for (const u of (p as any).imagens as string[]) if (u) list.push(u);
    return Array.from(new Set(list.filter(Boolean)));
  }, [property.property_images, p]);
  const mainImage = allImages[0] || '/placeholder-property.jpg';

  /* ---------------- IG state ---------------- */
  const [igOpen, setIgOpen] = useState(false);
  const [igTab, setIgTab] = useState<'fotos' | 'textos' | 'cores' | 'previa'>('fotos');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [igTitle, setIgTitle] = useState<string>(property.title || 'Lindo Imóvel');
  const [igCtaTitle, setIgCtaTitle] = useState<string>('Agende sua visita');
  const [igCtaSubtitle, setIgCtaSubtitle] = useState<string>('Chame no WhatsApp e marque seu horário para conhecer pessoalmente.');
  const [igTitleColor, setIgTitleColor] = useState<string>('#ffffff');
  const [igTextColor, setIgTextColor] = useState<string>('#e5e7eb');
  const [igAccentColor, setIgAccentColor] = useState<string>('#34d399');
  const [generatingIG, setGeneratingIG] = useState(false);
  const [igProgress, setIgProgress] = useState<{ current: number; total: number } | null>(null);
  const [previewSlide, setPreviewSlide] = useState<'first' | 'middle' | 'last'>('first');

  // Reset/refresh valores quando o imóvel muda
  useEffect(() => {
    setIgTitle(property.title || 'Lindo Imóvel');
    setSelectedImages([]);
  }, [property.id]);

  /* ---------------- PDF state ---------------- */
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTab, setPdfTab] = useState<'textos' | 'cores' | 'previa'>('textos');
  const [pdfTitle, setPdfTitle] = useState<string>(property.title || '');
  const [pdfTitleColor, setPdfTitleColor] = useState<string>('#111827');
  const [pdfDescColor, setPdfDescColor] = useState<string>('#374151');
  const [pdfFooterColor, setPdfFooterColor] = useState<string>(brandAccent);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    setPdfTitle(property.title || '');
  }, [property.id]);
  useEffect(() => {
    // Atualiza cor do footer quando a marca da empresa for carregada
    setPdfFooterColor((prev) => (prev ? prev : brandAccent));
  }, [brandAccent]);

  /* ---------------- Capture refs (hidden) ---------------- */
  const igFirstRef = useRef<HTMLDivElement>(null);
  const igFirstBgRef = useRef<HTMLDivElement>(null);
  const igMiddleRef = useRef<HTMLDivElement>(null);
  const igMiddleBgRef = useRef<HTMLDivElement>(null);
  const igLastRef = useRef<HTMLDivElement>(null);
  const igLastBgRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  /* ---------------- IG selection handlers ---------------- */
  const toggleImageSelection = (url: string) => {
    setSelectedImages((prev) => {
      const idx = prev.indexOf(url);
      if (idx >= 0) return prev.filter((u) => u !== url);
      if (prev.length >= 10) {
        toast.warning('Máximo de 10 slides por carrossel (limite do Instagram).');
        return prev;
      }
      return [...prev, url];
    });
  };

  const handleOpenIg = () => {
    if (selectedImages.length === 0 && allImages.length > 0) setSelectedImages([allImages[0]]);
    setIgTab('fotos');
    setIgOpen(true);
  };

  /* ---------------- IG capture ---------------- */
  const captureSlide = async (
    containerRef: React.RefObject<HTMLDivElement>,
    bgRef: React.RefObject<HTMLDivElement>,
    bgUrl: string,
    backgroundColor: string,
  ): Promise<Blob> => {
    if (!containerRef.current) throw new Error('Template IG não montado');
    if (bgRef.current) bgRef.current.style.backgroundImage = `url("${bgUrl}")`;
    await waitImageReady(bgUrl);
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const canvas = await html2canvas(containerRef.current, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
      backgroundColor,
    });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar blob'))), 'image/png', 1.0);
    });
  };

  const handleGenerateInstagram = async () => {
    const images = selectedImages.length > 0 ? selectedImages : allImages.slice(0, 1);
    if (images.length === 0) {
      toast.error('Selecione pelo menos uma foto.');
      return;
    }
    try {
      setGeneratingIG(true);
      setIgProgress({ current: 0, total: images.length });

      if (images.length === 1) {
        toast.info('Gerando arte para Instagram...');
        const blob = await captureSlide(igFirstRef, igFirstBgRef, images[0], '#111827');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `post-instagram-${p.listing_id || p.id}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        toast.success('Arte gerada e baixada com sucesso!');
        setIgOpen(false);
        return;
      }

      toast.info(`Gerando ${images.length} slides do carrossel...`);
      const zip = new JSZip();
      for (let i = 0; i < images.length; i++) {
        setIgProgress({ current: i + 1, total: images.length });
        let blob: Blob;
        if (i === 0) {
          blob = await captureSlide(igFirstRef, igFirstBgRef, images[i], '#111827');
        } else if (i === images.length - 1) {
          blob = await captureSlide(igLastRef, igLastBgRef, images[i], '#111827');
        } else {
          blob = await captureSlide(igMiddleRef, igMiddleBgRef, images[i], '#111827');
        }
        zip.file(`post-${String(i + 1).padStart(2, '0')}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `carrossel-instagram-${p.listing_id || p.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`Carrossel com ${images.length} slides gerado!`);
      setIgOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar a arte. Tente novamente.');
    } finally {
      setGeneratingIG(false);
      setIgProgress(null);
    }
  };

  /* ---------------- PDF capture ---------------- */
  const handleGeneratePDF = async () => {
    if (!pdfRef.current) return;
    try {
      setGeneratingPDF(true);
      toast.info('Gerando Ficha Técnica (PDF)...');

      const canvas = await html2canvas(pdfRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: '#FFFFFF',
        windowHeight: pdfRef.current.scrollHeight,
        height: pdfRef.current.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const pageCanvas = document.createElement('canvas');
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Falha ao criar canvas do PDF');
      const sliceHpx = Math.floor(canvas.width * (pageH / pageW));
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHpx;

      let y = 0;
      let pageIndex = 0;
      while (y < canvas.height) {
        const h = Math.min(sliceHpx, canvas.height - y);
        if (pageIndex > 0) pdf.addPage();
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
      setPdfOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  /* ---------------- Preview helpers ---------------- */
  // Quando há 1 só imagem, só existe o 'first'. Ajusta previewSlide se inválido.
  useEffect(() => {
    if (selectedImages.length <= 1 && previewSlide !== 'first') setPreviewSlide('first');
    else if (selectedImages.length === 2 && previewSlide === 'middle') setPreviewSlide('last');
  }, [selectedImages.length, previewSlide]);

  const previewBg = useMemo(() => {
    if (selectedImages.length === 0) return mainImage;
    if (previewSlide === 'first') return selectedImages[0];
    if (previewSlide === 'last') return selectedImages[selectedImages.length - 1];
    // middle
    const middleIdx = Math.floor(selectedImages.length / 2);
    return selectedImages[middleIdx] || selectedImages[0];
  }, [previewSlide, selectedImages, mainImage]);

  const igCommonProps = {
    titleColor: igTitleColor,
    textColor: igTextColor,
    accentColor: igAccentColor,
  };
  const igFirstData = {
    title: igTitle,
    address: property.address || '',
    city: property.city || '',
    bairro: p.bairro,
    area: property.area ?? null,
    bedrooms: property.bedrooms ?? null,
    bathrooms: property.bathrooms ?? null,
    price: property.price,
    listingId: p.listing_id || p.id,
    available: p.disponibilidade === 'disponivel' || !p.disponibilidade,
  };

  /* -------------------------------------------------------------------------- */
  /* Render                                                                     */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="border-pink-600 text-pink-400 hover:bg-pink-900/30"
        onClick={handleOpenIg}
        disabled={generatingIG}
      >
        <Instagram className="h-4 w-4 mr-2" />
        {generatingIG
          ? igProgress
            ? `Gerando ${igProgress.current}/${igProgress.total}...`
            : 'Gerando...'
          : 'Post IG'}
      </Button>

      <Button
        variant="outline"
        className="border-red-600 text-red-400 hover:bg-red-900/30"
        onClick={() => { setPdfTab('textos'); setPdfOpen(true); }}
        disabled={generatingPDF}
      >
        <FileText className="h-4 w-4 mr-2" />
        {generatingPDF ? 'Gerando...' : 'Ficha PDF'}
      </Button>

      {/* ======================= IG CONFIG DIALOG ======================= */}
      <Dialog open={igOpen} onOpenChange={setIgOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-6xl w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post IG — Configurar carrossel</DialogTitle>
            <DialogDescription className="text-gray-400">
              Selecione as fotos, ajuste título e cores, veja a prévia e gere o carrossel.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-6 items-start">
            <Tabs value={igTab} onValueChange={(v) => setIgTab(v as any)}>
              <TabsList className="bg-gray-800">
                <TabsTrigger value="fotos">Fotos ({selectedImages.length})</TabsTrigger>
                <TabsTrigger value="textos">Textos</TabsTrigger>
                <TabsTrigger value="cores">Cores</TabsTrigger>
              </TabsList>

              {/* ---------- Fotos ---------- */}
              <TabsContent value="fotos" className="mt-4">
                {allImages.length === 0 ? (
                  <div className="text-gray-400">Este imóvel não possui imagens cadastradas.</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-gray-400">
                        {selectedImages.length} / {Math.min(10, allImages.length)} selecionadas — primeira foto = slide com infos; última = CTA.
                      </span>
                      {selectedImages.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-gray-400 hover:text-white underline"
                          onClick={() => setSelectedImages([])}
                        >
                          Limpar seleção
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[52vh] overflow-y-auto pr-1">
                      {allImages.map((url) => {
                        const orderIdx = selectedImages.indexOf(url);
                        const isSelected = orderIdx >= 0;
                        return (
                          <button
                            key={url}
                            type="button"
                            onClick={() => toggleImageSelection(url)}
                            className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                              isSelected ? 'border-pink-500 ring-2 ring-pink-500/40' : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <img src={url} alt="" className="h-full w-full object-cover" />
                            {isSelected && (
                              <>
                                <div className="absolute inset-0 bg-pink-500/15 pointer-events-none" />
                                <div className="absolute top-2 left-2 h-7 w-7 rounded-full bg-pink-500 text-white text-sm font-bold flex items-center justify-center shadow">
                                  {orderIdx + 1}
                                </div>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ---------- Textos ---------- */}
              <TabsContent value="textos" className="mt-4 space-y-4">
                <div>
                  <Label className="text-sm text-gray-300">Título do post (1º slide)</Label>
                  <Input
                    value={igTitle}
                    onChange={(e) => setIgTitle(e.target.value)}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="Ex: Casa dos sonhos em São José de Ribamar"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-300">Título do CTA (último slide)</Label>
                  <Input
                    value={igCtaTitle}
                    onChange={(e) => setIgCtaTitle(e.target.value)}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="Agende sua visita"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-300">Subtítulo do CTA</Label>
                  <Input
                    value={igCtaSubtitle}
                    onChange={(e) => setIgCtaSubtitle(e.target.value)}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="Chame no WhatsApp e marque seu horário..."
                  />
                </div>
              </TabsContent>

              {/* ---------- Cores ---------- */}
              <TabsContent value="cores" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1">
                  <ColorField label="Cor do título" value={igTitleColor} onChange={setIgTitleColor} />
                  <ColorField label="Cor dos textos" value={igTextColor} onChange={setIgTextColor} />
                  <ColorField label="Cor de destaque (preço / CTA)" value={igAccentColor} onChange={setIgAccentColor} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="text-gray-500">Presets:</span>
                  <button
                    type="button"
                    className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-gray-200 hover:bg-gray-700"
                    onClick={() => { setIgTitleColor('#ffffff'); setIgTextColor('#e5e7eb'); setIgAccentColor('#34d399'); }}
                  >
                    Clássico (branco + verde)
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-gray-200 hover:bg-gray-700"
                    onClick={() => { setIgTitleColor('#ffffff'); setIgTextColor('#f3f4f6'); setIgAccentColor('#f59e0b'); }}
                  >
                    Dourado
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-gray-200 hover:bg-gray-700"
                    onClick={() => { setIgTitleColor('#ffffff'); setIgTextColor('#f3f4f6'); setIgAccentColor(brandAccent); }}
                  >
                    Cor da marca
                  </button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="lg:sticky lg:top-2">
              <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-4">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 bg-gray-800 text-gray-200"
                    disabled={selectedImages.length < 1}
                    onClick={() => {
                      const order: Array<'first' | 'middle' | 'last'> = ['first'];
                      if (selectedImages.length >= 3) order.push('middle');
                      if (selectedImages.length >= 2) order.push('last');
                      const idx = order.indexOf(previewSlide);
                      setPreviewSlide(order[(idx - 1 + order.length) % order.length]);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm text-gray-300 min-w-[180px] text-center">
                    {previewSlide === 'first' && 'Slide 1 — Info completa'}
                    {previewSlide === 'middle' && 'Slides do meio — Deslize'}
                    {previewSlide === 'last' && 'Último slide — CTA'}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-700 bg-gray-800 text-gray-200"
                    disabled={selectedImages.length < 2}
                    onClick={() => {
                      const order: Array<'first' | 'middle' | 'last'> = ['first'];
                      if (selectedImages.length >= 3) order.push('middle');
                      if (selectedImages.length >= 2) order.push('last');
                      const idx = order.indexOf(previewSlide);
                      setPreviewSlide(order[(idx + 1) % order.length]);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Preview box: 420x420, template 1080x1080 escalado 0.389 */}
                <div className="mx-auto w-[420px] h-[420px] overflow-hidden rounded-xl border border-gray-700 bg-black">
                  <div style={{ width: 1080, height: 1080, transform: 'scale(0.389)', transformOrigin: 'top left' }}>
                    {previewSlide === 'first' && (
                      <IgSlideFirst bgUrl={previewBg} {...igCommonProps} {...igFirstData} />
                    )}
                    {previewSlide === 'middle' && (
                      <IgSlideMiddle bgUrl={previewBg} {...igCommonProps} />
                    )}
                    {previewSlide === 'last' && (
                      <IgSlideLast
                        bgUrl={previewBg}
                        {...igCommonProps}
                        ctaTitle={igCtaTitle}
                        ctaSubtitle={igCtaSubtitle}
                        companyName={companyName}
                      />
                    )}
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-gray-500">
                  Formato 1080×1080 (prévia em 38.9% do tamanho real)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-800 mt-2">
            <div className="text-xs text-gray-500">
              {selectedImages.length === 0 && 'Selecione ao menos 1 foto na aba "Fotos"'}
              {selectedImages.length === 1 && '1 slide: info completa.'}
              {selectedImages.length === 2 && '2 slides: info + CTA.'}
              {selectedImages.length >= 3 && `${selectedImages.length} slides: info + ${selectedImages.length - 2} foto(s) + CTA.`}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-gray-700 text-gray-200 hover:bg-gray-800" onClick={() => setIgOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-pink-600 hover:bg-pink-700 text-white"
                onClick={handleGenerateInstagram}
                disabled={selectedImages.length === 0 || generatingIG}
              >
                <Check className="h-4 w-4 mr-2" />
                {selectedImages.length > 1 ? `Gerar carrossel (${selectedImages.length})` : 'Gerar post'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================= PDF CONFIG DIALOG ======================= */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-6xl w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ficha PDF — Configurar</DialogTitle>
            <DialogDescription className="text-gray-400">
              Ajuste título e cores e veja a prévia antes de gerar o PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-6 items-start">
            <Tabs value={pdfTab} onValueChange={(v) => setPdfTab(v as any)}>
              <TabsList className="bg-gray-800">
                <TabsTrigger value="textos">Textos</TabsTrigger>
                <TabsTrigger value="cores">Cores</TabsTrigger>
              </TabsList>

              <TabsContent value="textos" className="mt-4 space-y-4">
                <div>
                  <Label className="text-sm text-gray-300">Título do imóvel (cabeçalho da banner)</Label>
                  <Input
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    placeholder="Ex: Casa dos sonhos no Altos do Turú"
                  />
                </div>
                <div className="rounded-md bg-gray-800/60 border border-gray-700 p-4 text-sm text-gray-400">
                  <p><strong className="text-gray-200">Logo e nome da imobiliária</strong> são puxados automaticamente das configurações da sua empresa.</p>
                  <p className="mt-1">Logo: <span className="text-gray-300">{companyLogo ? '✓ configurada' : '— não configurada'}</span></p>
                  <p>Nome: <span className="text-gray-300">{companyName}</span></p>
                </div>
              </TabsContent>

              <TabsContent value="cores" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1">
                  <ColorField label="Cor do título" value={pdfTitleColor} onChange={setPdfTitleColor} />
                  <ColorField label="Cor da descrição / textos" value={pdfDescColor} onChange={setPdfDescColor} />
                  <ColorField label='Cor do footer "Gostou do imóvel?"' value={pdfFooterColor} onChange={setPdfFooterColor} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="text-gray-500">Presets:</span>
                  <button
                    type="button"
                    className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-gray-200 hover:bg-gray-700"
                    onClick={() => { setPdfTitleColor('#111827'); setPdfDescColor('#374151'); setPdfFooterColor(brandAccent); }}
                  >
                    Clássico (cor da marca)
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-gray-200 hover:bg-gray-700"
                    onClick={() => { setPdfTitleColor('#0f172a'); setPdfDescColor('#334155'); setPdfFooterColor('#0f172a'); }}
                  >
                    Sóbrio
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-gray-200 hover:bg-gray-700"
                    onClick={() => { setPdfTitleColor('#1e40af'); setPdfDescColor('#1f2937'); setPdfFooterColor('#1e40af'); }}
                  >
                    Azul corporativo
                  </button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="lg:sticky lg:top-2">
              <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-4">
                <div className="mx-auto w-[420px] overflow-hidden rounded-xl border border-gray-700 bg-white">
                  <div style={{ width: 800, transform: 'scale(0.525)', transformOrigin: 'top left' }}>
                    <PdfTemplate
                      property={property}
                      raw={p}
                      mainImage={mainImage}
                      gallery={allImages.slice(1)}
                      title={pdfTitle || property.title || ''}
                      titleColor={pdfTitleColor}
                      descColor={pdfDescColor}
                      footerColor={pdfFooterColor}
                      companyName={companyName}
                      companyLogo={companyLogo}
                      contactLine={contactLine}
                      accent={brandAccent}
                    />
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-gray-500">Formato A4 (prévia fixa lateral)</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-800 mt-2">
            <Button variant="outline" className="border-gray-700 text-gray-200 hover:bg-gray-800" onClick={() => setPdfOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleGeneratePDF}
              disabled={generatingPDF}
            >
              <FileText className="h-4 w-4 mr-2" />
              {generatingPDF ? 'Gerando...' : 'Gerar PDF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== HIDDEN CAPTURE TEMPLATES (IG + PDF) ========== */}
      <div className="fixed top-[-99999px] left-[-99999px] opacity-0 pointer-events-none z-[-1]">
        <IgSlideFirst
          ref={igFirstRef}
          bgRef={igFirstBgRef}
          bgUrl={selectedImages[0] || mainImage}
          {...igCommonProps}
          {...igFirstData}
        />
        <IgSlideMiddle
          ref={igMiddleRef}
          bgRef={igMiddleBgRef}
          bgUrl={mainImage}
          {...igCommonProps}
        />
        <IgSlideLast
          ref={igLastRef}
          bgRef={igLastBgRef}
          bgUrl={selectedImages[selectedImages.length - 1] || mainImage}
          {...igCommonProps}
          ctaTitle={igCtaTitle}
          ctaSubtitle={igCtaSubtitle}
          companyName={companyName}
        />
        <PdfTemplate
          ref={pdfRef}
          property={property}
          raw={p}
          mainImage={mainImage}
          gallery={allImages.slice(1)}
          title={pdfTitle || property.title || ''}
          titleColor={pdfTitleColor}
          descColor={pdfDescColor}
          footerColor={pdfFooterColor}
          companyName={companyName}
          companyLogo={companyLogo}
          contactLine={contactLine}
          accent={brandAccent}
        />
      </div>
    </div>
  );
}
