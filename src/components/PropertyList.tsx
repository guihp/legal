import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Plus, 
  Filter, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  Eye,
  Edit,
  Home,
  Star,
  Sparkles,
  Zap,
  Shield,
  Key,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  ImagePlus,
  X
} from "lucide-react";
import { PropertyWithImages } from "@/hooks/useProperties";
import { formatBRLInput, numberToBRLInput, parseBRLInput } from "@/lib/brlInput";
import { useImoveisVivaReal, suggestCities, suggestNeighborhoods, suggestAddresses, suggestSearch } from "@/hooks/useImoveisVivaReal";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTheme } from "@/contexts/ThemeContext";
import { PropertyImageGallery } from "@/components/PropertyImageGallery";
import { PipelineKpis } from "@/components/pipeline/PipelineKpis";
import { PropertiesTopBar } from "@/components/properties/PropertiesTopBar";
import { PropertiesToolbar } from "@/components/properties/PropertiesToolbar";
import { PropertiesFilters } from "@/components/properties/PropertiesFilters";
import { PropertiesAdvancedFilters } from "@/components/properties/PropertiesAdvancedFilters";
import { PropertiesPropertyCard } from "@/components/properties/PropertiesPropertyCard";
import { PropertiesPagination } from "@/components/properties/PropertiesPagination";
import {
  EMPTY_PROPERTIES_STATS,
  buildPropertiesKpis,
  buildPropertiesSubtitle,
  type PropertiesFilterTab,
  type PropertiesSortKey,
  type PropertiesStats,
} from "@/components/properties/helpers";

// Lazy loaded components
const PropertyDetailsPopup = lazy(() => import("@/components/PropertyDetailsPopup").then(m => ({ default: m.PropertyDetailsPopup })));
const PropertyEditForm = lazy(() => import("@/components/PropertyEditForm").then(m => ({ default: m.PropertyEditForm })));
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { convertMultipleToJPEG, convertGoogleDriveUrl, handleImageErrorWithFallback, captionFromFilename } from "@/utils/imageUtils";
import { subscribeImoveisChanges } from "@/lib/realtime/imoveisRealtimeBus";
import { FEATURE_OPTIONS } from "@/constants/imovelFeatures";
import { toast as sonnerToast } from "sonner";
import { Progress } from "@/components/ui/progress";

// Kill-switch para os efeitos decorativos do header (partículas, luzes, vidros,
// ícones, grid arquitetônico). Componentes movidos para arquivo separado
// (PropertyListDecorations.tsx) carregado via React.lazy — quando false, esse
// chunk nem entra no bundle inicial.
// MUDE PARA `true` SE QUISER REATIVAR O VISUAL ORIGINAL.
const ENABLE_DECORATIVE_FX = false;

const MODALIDADE_OPTIONS = [
  { value: 'For Sale', label: 'Venda' },
  { value: 'Rent', label: 'Aluguel' },
  { value: 'Sale/Rent', label: 'Venda/Aluguel' },
] as const;

// Lazy chunk dos efeitos decorativos. Só baixa se ENABLE_DECORATIVE_FX=true.
const PropertyListDecorations = lazy(() => import('./PropertyListDecorations'));

// Componente para as partículas flutuantes
const FloatingParticle = ({ delay = 0, duration = 20, type = 'default' }) => {
  const particleVariants = {
    default: "w-2 h-2 bg-blue-400/20 rounded-full",
    star: "w-1 h-1 bg-yellow-400/30 rounded-full",
    spark: "w-0.5 h-4 bg-purple-400/40 rounded-full",
    glow: "w-3 h-3 bg-emerald-400/25 rounded-full blur-sm"
  };

  return (
    <motion.div
      className={`absolute ${particleVariants[type]}`}
      initial={{ 
        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
        y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 20,
        opacity: 0,
        scale: 0
      }}
      animate={{
        y: -50,
        opacity: [0, 1, 0.8, 0],
        scale: [0, 1, 1.2, 0],
        rotate: 360
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

// Componente para luzes pulsantes
const PulsingLights = () => (
  <div className="absolute inset-0 overflow-hidden">
    {Array.from({ length: 8 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${20 + Math.random() * 40}px`,
          height: `${20 + Math.random() * 40}px`,
        }}
        animate={{
          opacity: [0, 0.3, 0],
          scale: [0.5, 1.5, 0.5],
          background: [
            "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)"
          ]
        }}
        transition={{
          duration: 4 + Math.random() * 4,
          delay: i * 0.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

// Componente para efeito de vidro quebrado
const GlassShards = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array.from({ length: 12 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute bg-gradient-to-br from-white/5 to-transparent backdrop-blur-sm"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${30 + Math.random() * 60}px`,
          height: `${30 + Math.random() * 60}px`,
          clipPath: "polygon(30% 0%, 0% 50%, 30% 100%, 100% 70%, 70% 30%)",
          transform: `rotate(${Math.random() * 360}deg)`
        }}
        animate={{
          opacity: [0, 0.4, 0],
          rotate: [0, 180, 360],
          scale: [0.8, 1.2, 0.8]
        }}
        transition={{
          duration: 8 + Math.random() * 6,
          delay: i * 0.7,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

// Componente para os ícones flutuantes
const FloatingIcon = ({ Icon, delay = 0, x = 0, y = 0, color = "blue" }) => {
  const colorVariants = {
    blue: "text-blue-300/10",
    purple: "text-purple-300/10",
    emerald: "text-emerald-300/10",
    yellow: "text-yellow-300/10",
    pink: "text-pink-300/10"
  };

  return (
    <motion.div
      className={`absolute ${colorVariants[color]}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0, rotate: -180 }}
      animate={{ 
        opacity: [0, 0.4, 0],
        scale: [0, 1.2, 0],
        rotate: [0, 360, 720],
        y: [-30, 30, -30],
        x: [-10, 10, -10]
      }}
      transition={{
        duration: 10 + Math.random() * 5,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <Icon size={35 + Math.random() * 20} />
    </motion.div>
  );
};

// Componente para o grid arquitetônico
const ArchitecturalGrid = () => (
  <div className="absolute inset-0 overflow-hidden">
    <svg className="absolute inset-0 w-full h-full">
      <defs>
        <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <motion.path
            d="M 80 0 L 0 0 0 80"
            fill="none"
            stroke="rgba(59, 130, 246, 0.08)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 0],
              opacity: [0, 0.3, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, repeatType: "loop" }}
          />
          <motion.circle
            cx="40"
            cy="40"
            r="2"
            fill="rgba(147, 51, 234, 0.1)"
            animate={{
              r: [1, 4, 1],
              opacity: [0.1, 0.4, 0.1]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </pattern>
        
        <pattern id="hexGrid" width="100" height="87" patternUnits="userSpaceOnUse">
          <motion.polygon
            points="50,0 93.3,25 93.3,62 50,87 6.7,62 6.7,25"
            fill="none"
            stroke="rgba(16, 185, 129, 0.06)"
            strokeWidth="1"
            animate={{
              opacity: [0, 0.2, 0],
              strokeWidth: [0.5, 2, 0.5]
            }}
            transition={{ duration: 6, repeat: Infinity }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#hexGrid)" opacity="0.5" />
    </svg>

    {/* Formas geométricas arquitetônicas */}
    <motion.div
      className="absolute top-20 left-10 border border-blue-400/20"
      style={{ width: "120px", height: "120px" }}
      initial={{ opacity: 0, scale: 0, rotate: 0 }}
      animate={{ 
        opacity: [0, 0.4, 0],
        scale: [0, 1.1, 0],
        rotate: [0, 180, 360],
        borderRadius: ["0%", "50%", "0%"]
      }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    />
    
    <motion.div
      className="absolute bottom-20 right-10 border-2 border-emerald-400/20"
      style={{ width: "80px", height: "140px" }}
      initial={{ opacity: 0, y: 50, skewY: 0 }}
      animate={{ 
        opacity: [0, 0.5, 0],
        y: [50, -20, 50],
        skewY: [-5, 5, -5],
        borderColor: [
          "rgba(16, 185, 129, 0.2)",
          "rgba(59, 130, 246, 0.2)",
          "rgba(147, 51, 234, 0.2)",
          "rgba(16, 185, 129, 0.2)"
        ]
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

interface PropertyListProps {
  properties: PropertyWithImages[];
  loading: boolean;
  onAddNew: () => void;
  refetch?: () => void;
}

export function PropertyList({ properties, loading, onAddNew, refetch }: PropertyListProps) {
  const { profile } = useUserProfile();
  const { theme } = useTheme();
  const isDarkGallery = theme === 'dark';
  const isCorretor = profile?.role === 'corretor';
  const {
    imoveis,
    loading: loadingImoveis,
    page,
    setPage,
    pageSize,
    setPageSize,
    orderBy,
    setOrderBy,
    filters,
    setFilters,
    total,
    refetch: refetchImoveisList,
    createImovel,
    updateImovel,
    deleteImovel,
  } = useImoveisVivaReal();
  const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [neighborhoodSuggestions, setNeighborhoodSuggestions] = useState<string[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [availabilityNote, setAvailabilityNote] = useState<string>("");
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState<boolean>(false);
  const [availabilityTarget, setAvailabilityTarget] = useState<PropertyWithImages | null>(null);
  const [availabilityValue, setAvailabilityValue] = useState<'disponivel'|'indisponivel'|'reforma'>('disponivel');
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithImages | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyWithImages | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState<PropertyWithImages | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<{[key: string]: number}>({});
  const [imageGalleryProperty, setImageGalleryProperty] = useState<PropertyWithImages | null>(null);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [particles, setParticles] = useState<number[]>([]);
  const { toast } = useToast();
  
  // Estatísticas do cabeçalho (baseadas em public.imoveisvivareal)
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<PropertiesStats>(EMPTY_PROPERTIES_STATS);
  const [statusTab, setStatusTab] = useState<PropertiesFilterTab>('todos');
  const [sortKey, setSortKey] = useState<PropertiesSortKey>('recentes');
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchImoveisStats = async () => {
    try {
      setStatsLoading(true);
      const companyId = profile?.company_id;

      const countQuery = (apply?: (q: any) => any) => {
        let q = (supabase as any).from('imoveisvivareal').select('id', { count: 'exact', head: true });
        if (companyId) q = q.eq('company_id', companyId);
        if (apply) q = apply(q);
        return q as Promise<any>;
      };

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      let ticketQuery = (supabase as any).from('imoveisvivareal').select('preco').gt('preco', 0);
      if (companyId) ticketQuery = ticketQuery.eq('company_id', companyId);

      const [
        totalRes,
        dispRes,
        indisRes,
        reformaRes,
        aluguelRes,
        vendaRes,
        mesRes,
        ticketRes,
      ] = await Promise.all([
        countQuery(),
        countQuery((q) => q.eq('disponibilidade', 'disponivel')),
        countQuery((q) => q.eq('disponibilidade', 'indisponivel')),
        countQuery((q) => q.eq('disponibilidade', 'reforma')),
        countQuery((q) => q.in('modalidade', ['Rent', 'Sale/Rent'])),
        countQuery((q) => q.in('modalidade', ['For Sale', 'Sale/Rent'])),
        countQuery((q) => q.gte('created_at', monthStart.toISOString())),
        ticketQuery as Promise<any>,
      ]);

      const prices: number[] = Array.isArray(ticketRes?.data)
        ? ticketRes.data
            .map((r: { preco?: number | null }) => Number(r.preco) || 0)
            .filter((n: number) => n > 0)
        : [];
      const ticketMedio =
        prices.length > 0
          ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length)
          : 0;

      setStats({
        total: totalRes?.count ?? 0,
        disponiveis: dispRes?.count ?? 0,
        indisponiveis: indisRes?.count ?? 0,
        reforma: reformaRes?.count ?? 0,
        aluguel: aluguelRes?.count ?? 0,
        venda: vendaRes?.count ?? 0,
        ticketMedio,
        cadastradosMes: mesRes?.count ?? 0,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchImoveisStats();
  }, [profile?.company_id]);

  // Real-time via bus compartilhado (1 channel pra toda a app — antes eram 3).
  useEffect(() => {
    return subscribeImoveisChanges(() => fetchImoveisStats());
  }, []);

  // Edição VivaReal
  const [isVivaRealEditOpen, setIsVivaRealEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPreco, setEditPreco] = useState<string>("");
  const [editArea, setEditArea] = useState<string>("");
  const [editQuartos, setEditQuartos] = useState<string>("");
  const [editBanheiros, setEditBanheiros] = useState<string>("");
  const [editModalidade, setEditModalidade] = useState<string>("");
  const [editDescricao, setEditDescricao] = useState<string>("");
  const [editImages, setEditImages] = useState<File[]>([]);
  const [editPreviews, setEditPreviews] = useState<string[]>([]);
  // CLAUDE AQUI ESTÁ A PARTE DE ADICIONAR A DESCRIÇÃO DA IMAGEM (legendas por foto + lightbox)
  const [editNewCaptions, setEditNewCaptions] = useState<string[]>([]);
  const [editExistingImages, setEditExistingImages] = useState<string[]>([]);
  const [editExistingCaptions, setEditExistingCaptions] = useState<string[]>([]);
  const [editImageLightboxIndex, setEditImageLightboxIndex] = useState<number | null>(null);
  const lightboxTouchStartX = useRef<number | null>(null);
  // Features (amenidades) selecionadas no modal de edição.
  // Gravadas em INGLÊS para casar com a tool `buscar_por_features` do agente n8n.
  const [editFeatures, setEditFeatures] = useState<string[]>([]);
  const toggleEditFeature = (value: string) => {
    setEditFeatures((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };
  const MAX_IMAGES = 50; // Limite máximo de imagens por imóvel
  const IMAGE_CAPTION_MAX = 50;
  const clampCaption = useCallback((s: string) => s.slice(0, IMAGE_CAPTION_MAX), [IMAGE_CAPTION_MAX]);
  const totalEditImageCount = editExistingImages.length + editImages.length;

  // Gerar partículas
  useEffect(() => {
    const particleArray = Array.from({ length: 20 }, (_, i) => i);
    setParticles(particleArray);
  }, []);

  // Debounce da busca principal para filtros server-side + sugestões
  useEffect(() => {
    const id = setTimeout(async () => {
      const term = searchTerm.trim();
      setPage(1);
      setFilters(prev => ({ ...prev, search: term || undefined }));
      if (term.length >= 2) {
        const s = await suggestSearch(term);
        setSearchSuggestions(s);
      } else {
        setSearchSuggestions([]);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [searchTerm, setFilters, setPage]);

  // Adaptador: converte imoveisvivareal -> shape esperado pela UI de propriedades
  const propertiesFromImoveis: PropertyWithImages[] = (imoveis || []).map((i: any) => {
    const tipoInferido = (() => {
      const t = (i.tipo_imovel || '').toLowerCase();
      if (t.includes('apart')) return 'apartment';
      if (t.includes('casa')) return 'house';
      if (t.includes('comerc')) return 'commercial';
      if (t.includes('terreno') || t.includes('lote')) return 'land';
      return 'apartment';
    })();
    return {
      id: String(i.id),
      title: i.tipo_imovel || 'Imóvel',
      type: tipoInferido as any,
      price: Number(i.preco) || 0,
      area: Number(i.tamanho_m2) || 0,
      bedrooms: i.quartos || 0,
      bathrooms: i.banheiros || 0,
      address: [i.endereco, i.numero, i.bairro, i.cidade].filter(Boolean).join(', '),
      city: i.cidade || '',
      state: '',
      status: 'available' as any,
      description: i.descricao || '',
      property_purpose: 'Venda' as any,
      created_at: i.created_at || null,
      updated_at: i.updated_at || null,
      // Manter URLs originais - conversão acontece na renderização para otimizar tamanho
      property_images: (i.imagens || []).map((url: string, idx: number) => ({
        image_url: url,
        legenda: Array.isArray(i.imagens_legendas) ? (i.imagens_legendas[idx] ?? '') : '',
      })) as any,
      // Campos extras (fora do tipo PropertyWithImages) para ficha / disponibilidade
      ...(i.disponibilidade ? { disponibilidade: i.disponibilidade } : {}),
      ...(i.disponibilidade_observacao ? { disponibilidade_observacao: i.disponibilidade_observacao } : {}),
      ...(i.listing_id ? { listing_id: String(i.listing_id) } : {}),
      ...(i.modalidade ? { modalidade: i.modalidade } : {}),
      ...(i.tipo_imovel ? { tipo_imovel: i.tipo_imovel } : {}),
      ...(i.tipo_categoria ? { tipo_categoria: i.tipo_categoria } : {}),
      ...(typeof i.suite === 'number' ? { suite: i.suite } : {}),
      ...(typeof i.garagem === 'number' ? { garagem: i.garagem } : {}),
      ...(typeof i.andar === 'number' ? { andar: i.andar } : {}),
      ...(typeof i.ano_construcao === 'number' ? { ano_construcao: i.ano_construcao } : {}),
      ...(i.bairro ? { bairro: i.bairro } : {}),
      ...(i.endereco ? { endereco: i.endereco } : {}),
      ...(i.numero ? { numero: i.numero } : {}),
      ...(i.complemento ? { complemento: i.complemento } : {}),
      ...(i.cep ? { cep: i.cep } : {}),
      ...(i.company_id ? { company_id: i.company_id } : {}),
      ...(i.accepts_partnership ? { accepts_partnership: i.accepts_partnership } : {}),
      ...(i.partnership_notes ? { partnership_notes: i.partnership_notes } : {}),
      // Propaga features do banco para o modal de edição (text[] → string[]).
      ...(Array.isArray(i.features) ? { features: i.features } : {}),
      ...(Array.isArray(i.imagens_legendas) ? { imagens_legendas: i.imagens_legendas } : {}),
    } as unknown as PropertyWithImages;
  });

  const isVivaRealMode = true; // dados vêm de imoveisvivareal (tabela properties legado não é usada)
  const effectiveProperties: PropertyWithImages[] =
    propertiesFromImoveis.length > 0 ? propertiesFromImoveis : properties;

  const loadingCombined = loading || loadingImoveis;

  const tabCounts: Record<PropertiesFilterTab, number> = {
    todos: stats.total,
    disponiveis: stats.disponiveis,
    venda: stats.venda,
    aluguel: stats.aluguel,
  };

  const kpis = buildPropertiesKpis(stats);
  const subtitle = buildPropertiesSubtitle(stats.total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleStatusTabChange = useCallback(
    (tab: PropertiesFilterTab) => {
      setStatusTab(tab);
      setPage(1);
      setFilters((prev) => {
        const next = { ...prev };
        delete next.disponibilidade;
        delete next.modalidade;
        if (tab === 'disponiveis') next.disponibilidade = 'disponivel';
        if (tab === 'venda') next.modalidade = ['For Sale', 'Sale/Rent'];
        if (tab === 'aluguel') next.modalidade = ['Rent', 'Sale/Rent'];
        return next;
      });
    },
    [setFilters, setPage],
  );

  const handleSortChange = useCallback(
    (key: PropertiesSortKey) => {
      setSortKey(key);
      setPage(1);
      if (key === 'recentes') setOrderBy({ column: 'created_at', ascending: false });
      else if (key === 'valor') setOrderBy({ column: 'preco', ascending: false });
      else setOrderBy({ column: 'tamanho_m2', ascending: false });
    },
    [setOrderBy, setPage],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchImoveisList(), fetchImoveisStats()]);
    } finally {
      setRefreshing(false);
    }
    // fetchImoveisStats depende de profile.company_id e é recriada a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchImoveisList, profile?.company_id]);

  // Debug log apenas quando há mudanças significativas (evita loop)
  const prevPropertiesCount = useRef(effectiveProperties.length);
  const prevLoading = useRef(loadingCombined);
  
  if (prevPropertiesCount.current !== effectiveProperties.length || prevLoading.current !== loadingCombined) {
    console.log('🏠 PropertyList - Estado atual:', { 
      propertiesCount: effectiveProperties.length, 
      loading: loadingCombined,
      sample: effectiveProperties.slice(0, 2),
    });
    prevPropertiesCount.current = effectiveProperties.length;
    prevLoading.current = loadingCombined;
  }

  const filteredProperties = effectiveProperties; // server-side filters

  // Janela visível incremental (infinite scroll) para reduzir nós no DOM
  const [visibleCount, setVisibleCount] = useState<number>(30);
  useEffect(() => {
    setVisibleCount(30);
  }, [filteredProperties]);
  useEffect(() => {
    const onScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollPosition < 800) {
        setVisibleCount((prev) => Math.min(prev + 24, filteredProperties.length));
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true } as any);
    return () => window.removeEventListener('scroll', onScroll);
  }, [filteredProperties.length]);

  const startVivaRealEdit = (property: PropertyWithImages) => {
    setEditId(property.id);
    setEditPreco(numberToBRLInput(property.price || 0));
    setEditArea(String(property.area || 0));
    setEditQuartos(String(property.bedrooms || 0));
    setEditBanheiros(String(property.bathrooms || 0));
    setEditDescricao(property.description || "");
    const vivaRealProperty = property as any;
    setEditModalidade(String(vivaRealProperty.modalidade || ''));
    
    // Carregar imagens existentes do imóvel
    let existingUrls: string[] = [];
    
    if (property.property_images && Array.isArray(property.property_images) && property.property_images.length > 0) {
      // Formato property_images: [{image_url: "..."}, ...]
      existingUrls = property.property_images
        .map((img: any) => img.image_url || img)
        .filter((url: any) => typeof url === 'string' && url.length > 0);
    } else if (vivaRealProperty.imagens && Array.isArray(vivaRealProperty.imagens)) {
      // Formato original do VivaReal: ["url1", "url2", ...]
      existingUrls = vivaRealProperty.imagens.filter((url: any) => typeof url === 'string' && url.length > 0);
    }
    
    console.log(`📸 Carregando ${existingUrls.length} imagem(ns) existente(s) para edição`);
    setEditExistingImages(existingUrls);
    const rowLegends = Array.isArray(vivaRealProperty.imagens_legendas)
      ? (vivaRealProperty.imagens_legendas as string[])
      : null;
    setEditExistingCaptions(
      existingUrls.map((_, idx) => {
        if (rowLegends != null && idx < rowLegends.length) {
          return String(rowLegends[idx] ?? '').slice(0, IMAGE_CAPTION_MAX);
        }
        const fromImg = (property.property_images as any)?.[idx]?.legenda;
        return String(fromImg ?? '').slice(0, IMAGE_CAPTION_MAX);
      })
    );

    // Limpar novas imagens e campos auxiliares
    setEditImages([]);
    setEditPreviews([]);
    setEditNewCaptions([]);
    setEditImageLightboxIndex(null);

    // Features atuais do imóvel (vêm propagadas pelo adapter `propertiesFromImoveis`).
    const currentFeatures = (property as any).features;
    setEditFeatures(Array.isArray(currentFeatures) ? currentFeatures : []);

    setIsVivaRealEditOpen(true);
  };

  const onSelectEditImages = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const currentCount = editImages.length + editExistingImages.length;
    const remainingSlots = MAX_IMAGES - currentCount;
    
    if (remainingSlots <= 0) {
      sonnerToast.warning(`Você já atingiu o limite de ${MAX_IMAGES} imagens.`);
      return;
    }
    
    const chosen = list.slice(0, remainingSlots);
    
    if (chosen.length < list.length) {
      sonnerToast.warning(`Apenas ${chosen.length} imagem(ns) foram selecionadas. Limite máximo: ${MAX_IMAGES} imagens.`);
    }
    
    try {
      console.log(`📸 Processando ${chosen.length} imagem(ns) de ${list.length} selecionadas...`);
      sonnerToast.info('Processando imagens para qualidade ideal (1-5MB)...');
      // Converter para JPEG com tamanho entre 1MB e 5MB (ideal para WhatsApp)
      const converted = await convertMultipleToJPEG(chosen, 1024 * 1024, 5 * 1024 * 1024, 1920, 1440);
      setEditImages(prev => [...prev, ...converted]);
      const newPreviews = converted.map(f => URL.createObjectURL(f));
      setEditPreviews(prev => [...prev, ...newPreviews]);
      // Pré-preenche legenda a partir do nome do arquivo (heurística limpa nomes
      // como "piscina.jpg" → "piscina"; ignora padrões câmera tipo IMG_xxx).
      // Usuário pode editar/limpar antes de salvar.
      setEditNewCaptions((prev) => [
        ...prev,
        ...converted.map((f) => captionFromFilename(f.name, IMAGE_CAPTION_MAX)),
      ]);
      console.log(`✅ ${converted.length} imagem(ns) processadas com sucesso.`);
      sonnerToast.success(`${converted.length} imagem(ns) processadas com sucesso!`);
    } catch (e) {
      console.error('Erro ao processar imagens:', e);
      sonnerToast.error('Falha ao processar imagens. Verifique se os arquivos são imagens válidas.');
    }
  };

  const removeEditImage = (index: number) => {
    setEditImages(prev => prev.filter((_, i) => i !== index));
    setEditNewCaptions((prev) => prev.filter((_, i) => i !== index));
    setEditPreviews(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index]);
      return newPreviews.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = (index: number) => {
    setEditExistingImages(prev => prev.filter((_, i) => i !== index));
    setEditExistingCaptions((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadEditImagesAndLegendas = async (
    imovelId: number
  ): Promise<{ urls: string[]; captions: string[] }> => {
    const BUCKET = 'property-images';
    const capExisting = editExistingCaptions.map((c) => clampCaption(c ?? ''));

    if (editImages.length === 0) {
      console.log(`📸 Sem novas imagens. Mantendo ${editExistingImages.length} imagens existentes.`);
      return { urls: [...editExistingImages], captions: capExisting };
    }

    const baseTimestamp = Date.now();
    const uploadPromises = editImages.map(async (file, i) => {
      const timestamp = baseTimestamp + i;
      const path = `imoveisvivareal/${imovelId}/${timestamp}_${i}.jpg`;

      try {
        console.log(`📤 Fazendo upload da imagem ${i + 1}/${editImages.length}: ${path} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: 'image/jpeg',
          upsert: false,
        });

        if (error) {
          console.error(`❌ Erro ao fazer upload da imagem ${i + 1}:`, error);
          return { success: false as const, index: i, error };
        }

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        console.log(`✅ Imagem ${i + 1} enviada com sucesso:`, pub.publicUrl);
        return { success: true as const, index: i, url: pub.publicUrl };
      } catch (err: any) {
        console.error(`❌ Falha no upload da imagem ${i + 1}:`, err);
        return { success: false as const, index: i, error: err };
      }
    });

    const results = await Promise.allSettled(uploadPromises);
    const newPairs: { url: string; caption: string }[] = [];
    results.forEach((result, i) => {
      if (result.status !== 'fulfilled') return;
      const data = result.value;
      if (data.success && 'url' in data && data.url) {
        newPairs.push({
          url: data.url,
          caption: clampCaption(editNewCaptions[i] ?? ''),
        });
      }
    });

    const finalUrls = [...editExistingImages, ...newPairs.map((p) => p.url)];
    const finalCaptions = [...capExisting, ...newPairs.map((p) => p.caption)];
    console.log(
      `📸 Total de imagens: ${finalUrls.length} (${editExistingImages.length} existentes + ${newPairs.length} novas)`
    );
    return { urls: finalUrls, captions: finalCaptions };
  };



  const submitVivaRealEdit = async () => {
    try {
      if (!editId) return;
      const idNum = Number(editId);
      
      let imageUrls: string[] = [];
      let imageCaptions: string[] = [];
      try {
        if (editImages.length > 0) {
          const both = await uploadEditImagesAndLegendas(idNum);
          imageUrls = both.urls;
          imageCaptions = both.captions;
          if (imageUrls.length === 0 && editImages.length > 0) {
            sonnerToast.warning('Imóvel atualizado, mas nenhuma imagem nova foi salva.');
          } else if (imageUrls.length < editImages.length + editExistingImages.length) {
            sonnerToast.warning(`Imóvel atualizado! ${imageUrls.length} de ${editImages.length + editExistingImages.length} imagens foram salvas.`);
          }
        } else {
          imageUrls = editExistingImages;
          imageCaptions = editExistingCaptions.map((c) => clampCaption(c ?? ''));
        }
      } catch (imgErr: any) {
        console.error('Erro ao processar imagens:', imgErr);
        sonnerToast.warning('Imóvel atualizado, mas houve erro ao salvar algumas imagens.');
        imageUrls = editExistingImages;
        imageCaptions = editExistingCaptions.map((c) => clampCaption(c ?? ''));
      }

      imageCaptions = imageUrls.map((_, i) => clampCaption(imageCaptions[i] ?? ''));
      
      const updates: any = {
        preco: parseBRLInput(editPreco),
        tamanho_m2: editArea === "" ? null : Number(editArea),
        quartos: editQuartos === "" ? null : Number(editQuartos),
        banheiros: editBanheiros === "" ? null : Number(editBanheiros),
        descricao: editDescricao,
        modalidade: editModalidade || null,
        imagens: imageUrls,
        imagens_legendas: imageUrls.length > 0 ? imageCaptions : [],
        // Features (amenidades) — null quando vazio para não inflar o registro com [].
        features: editFeatures.length > 0 ? editFeatures : null,
      };
      
      console.log(`💾 Salvando imóvel com ${imageUrls.length} imagem(ns)`);
      
      const res = await updateImovel(idNum, updates);
      if (!res) throw new Error('Falha ao atualizar imóvel');
      
      const msg = imageUrls.length === 0 
        ? 'Imóvel atualizado (todas as imagens foram removidas)'
        : `Imóvel atualizado com ${imageUrls.length} imagem(ns)`;
      toast({ title: msg });
      
      setIsVivaRealEditOpen(false);
      setEditId(null);
      setEditImages([]);
      setEditPreviews([]);
      setEditNewCaptions([]);
      setEditExistingImages([]);
      setEditExistingCaptions([]);
      setEditModalidade('');
      setEditFeatures([]);
      setEditImageLightboxIndex(null);
      refetchImoveisList();
    } catch (err) {
      toast({ title: 'Erro ao atualizar', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    }
  };

  const handleDeleteVivaReal = async (property: PropertyWithImages) => {
    try {
      const ok = await deleteImovel(Number(property.id));
      if (!ok) throw new Error('Falha ao excluir');
      toast({ title: 'Imóvel excluído com sucesso' });
      refetchImoveisList();
    } catch (err) {
      toast({ title: 'Erro ao excluir', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!isVivaRealEditOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isVivaRealEditOpen]);

  useEffect(() => {
    if (editImageLightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditImageLightboxIndex(null);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"]')) return;
      if (totalEditImageCount <= 0) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setEditImageLightboxIndex((i) =>
          i === null ? i : (i - 1 + totalEditImageCount) % totalEditImageCount
        );
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setEditImageLightboxIndex((i) => (i === null ? i : (i + 1) % totalEditImageCount));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editImageLightboxIndex, totalEditImageCount]);

  // Log de filtro apenas quando quantidade muda (evita spam)
  const prevFilteredCount = useRef(filteredProperties.length);
  if (prevFilteredCount.current !== filteredProperties.length) {
    console.log('🔍 Propriedades filtradas:', filteredProperties.length);
    prevFilteredCount.current = filteredProperties.length;
  }

  const particleTypes = ['default', 'star', 'spark', 'glow'];

  const getStatusBadge = (status: PropertyWithImages["status"]) => {
    const variants = {
      available: "bg-emerald-700 text-white border-emerald-600",
      sold: "bg-blue-700 text-white border-blue-600", 
      rented: "bg-yellow-700 text-white border-yellow-600"
    };
    
    const labels = {
      available: "Disponível",
      sold: "Vendido",
      rented: "Alugado"
    };

    return (
      <Badge variant="outline" className={variants[status || "available"]}>
        {labels[status || "available"]}
      </Badge>
    );
  };

  const getStatusIcon = (status: PropertyWithImages["status"]) => {
    switch (status) {
      case 'available':
        return CheckCircle;
      case 'sold':
        return Building2;
      case 'rented':
        return Key;
      default:
        return Home;
    }
  };

  const getTypeLabel = (type: PropertyWithImages["type"]) => {
    const labels = {
      house: "Casa",
      apartment: "Apartamento", 
      commercial: "Comercial",
      land: "Terreno"
    };
    return labels[type];
  };

  const translateTipoImovel = (v: string) => {
    const map: Record<string, string> = {
      'Home': 'Casa',
      'Apartment': 'Apartamento',
      'Building': 'Prédio',
      'Condo': 'Condomínio',
      'Land Lot': 'Terreno',
      'Sobrado': 'Sobrado',
      'Loja': 'Loja',
      'Agricultural': 'Agrícola',
      'Studio': 'Studio',
      // tolerância
      'House': 'Casa',
      'Land': 'Terreno',
      'Store': 'Loja',
    };
    return map[v] || v;
  };

  const getTypeColor = (type: PropertyWithImages["type"]) => {
    switch (type) {
      case 'house':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/50';
      case 'apartment':
        return 'bg-violet-500/20 text-violet-300 border-violet-400/50';
      case 'commercial':
        return 'bg-orange-500/20 text-orange-300 border-orange-400/50';
      case 'land':
        return 'bg-green-500/20 text-green-300 border-green-400/50';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-400/50';
    }
  };

  const getPurposeColor = (purpose: "Aluguel" | "Venda") => {
    switch (purpose) {
      case "Aluguel":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-400/50";
      case "Venda":
        return "bg-orange-500/20 text-orange-300 border-orange-400/50";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-400/50";
    }
  };

  const getAvailabilityBadge = (availability: 'disponivel'|'indisponivel'|'reforma'|undefined) => {
    const v = availability || 'disponivel';
    const map: Record<string, string> = {
      disponivel: 'bg-emerald-700 text-white border-emerald-600',
      indisponivel: 'bg-red-700 text-white border-red-600',
      reforma: 'bg-yellow-700 text-white border-yellow-600'
    };
    const label: Record<string, string> = {
      disponivel: 'Disponível',
      indisponivel: 'Indisponível',
      reforma: 'Reforma'
    };
    return (
      <Badge variant="outline" className={map[v]}>
        {label[v]}
      </Badge>
    );
  };

  const getPurposeIcon = (purpose: "Aluguel" | "Venda") => {
    switch (purpose) {
      case "Aluguel":
        return "🏠";
      case "Venda":
        return "🏢";
      default:
        return "🏠";
    }
  };

  const handleViewDetails = (property: PropertyWithImages) => {
    setSelectedProperty(property);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedProperty(null);
  };

  const handleEditProperty = (property: PropertyWithImages) => {
    setEditingProperty(property);
    setIsEditOpen(true);
  };

  const handleEditSubmit = () => {
    setIsEditOpen(false);
    setEditingProperty(null);
    // Forçar refetch dos dados para garantir atualização
    if (refetch) {
      refetch();
    }
  };

  const handleEditCancel = () => {
    setIsEditOpen(false);
    setEditingProperty(null);
  };

  const handlePreviousImage = (propertyId: string, totalImages: number) => {
    console.log('⬅️ Imagem anterior:', { propertyId, totalImages, currentIndex: currentImageIndex[propertyId] || 0 });
    setCurrentImageIndex(prev => ({
      ...prev,
      [propertyId]: prev[propertyId] > 0 ? prev[propertyId] - 1 : totalImages - 1
    }));
  };

  const handleNextImage = (propertyId: string, totalImages: number) => {
    console.log('➡️ Próxima imagem:', { propertyId, totalImages, currentIndex: currentImageIndex[propertyId] || 0 });
    setCurrentImageIndex(prev => ({
      ...prev,
      [propertyId]: (prev[propertyId] || 0) < totalImages - 1 ? (prev[propertyId] || 0) + 1 : 0
    }));
  };

  const getCurrentImageIndex = (propertyId: string) => {
    return currentImageIndex[propertyId] || 0;
  };

  const handleOpenImageGallery = (property: PropertyWithImages, initialIndex: number = 0) => {
    console.log('🖼️ Abrindo galeria de imagens:', { 
      property: property.title, 
      initialIndex, 
      imagesCount: property.property_images?.length || 0,
      images: property.property_images 
    });
    setImageGalleryProperty(property);
    setGalleryInitialIndex(initialIndex);
    setIsImageGalleryOpen(true);
  };

  const handleCloseImageGallery = () => {
    setIsImageGalleryOpen(false);
    setImageGalleryProperty(null);
    setGalleryInitialIndex(0);
  };

  const handleDeleteProperty = async (property: PropertyWithImages) => {
    try {
      console.log('🗑️ Iniciando deleção da propriedade:', property.id);

      // Verificar se é um imóvel VivaReal (tem listing_id)
      const isVivaReal = (property as any).listing_id !== undefined;
      
      if (isVivaReal) {
        // Deletar da tabela imoveisvivareal
        const idNum = Number(property.id);
        if (isNaN(idNum)) {
          throw new Error('ID inválido para deletar imóvel VivaReal');
        }
        
        const ok = await deleteImovel(idNum);
        if (!ok) {
          throw new Error('Falha ao deletar imóvel VivaReal');
        }
        
        console.log('✅ Imóvel VivaReal deletado com sucesso');
      } else {
        // Para propriedades legadas (se existirem), tentar deletar de property_images
        // Nota: A tabela properties não existe mais, então apenas logamos
        console.warn('⚠️ Tentativa de deletar propriedade legada. Tabela properties não existe mais.');
        
        if (property.property_images && property.property_images.length > 0) {
          const { error: imagesError } = await supabase
            .from('property_images')
            .delete()
            .eq('property_id', property.id);

          if (imagesError) {
            console.error('❌ Erro ao deletar imagens:', imagesError);
            // Não lançar erro, apenas logar
          } else {
            console.log('✅ Imagens deletadas com sucesso');
          }
        }
      }

      console.log('✅ Propriedade deletada com sucesso');

      toast({
        title: "Sucesso!",
        description: "Propriedade deletada com sucesso.",
      });

      // Forçar refetch dos dados
      if (refetch) {
        refetch();
      }

      setDeletingProperty(null);
    } catch (error) {
      console.error('💥 Erro ao deletar propriedade:', error);
      toast({
        title: "Erro",
        description: "Erro ao deletar propriedade. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Se estiver editando, mostrar o formulário de edição
  if (isEditOpen && editingProperty) {
    return (
      <Suspense fallback={<div className="text-gray-300 p-4">Carregando editor...</div>}>
        <PropertyEditForm
          property={editingProperty}
          onSubmit={handleEditSubmit}
          onCancel={handleEditCancel}
        />
      </Suspense>
    );
  }

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col">
      {ENABLE_DECORATIVE_FX && (
        <Suspense fallback={null}>
          <PropertyListDecorations
            particles={particles}
            particleTypes={particleTypes as Array<'default' | 'star' | 'spark' | 'glow'>}
          />
        </Suspense>
      )}

      <div className="relative z-10 flex flex-col w-full">
        <div className="border-b border-border/70">
          <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
            <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
              <PropertiesTopBar onRefresh={handleRefresh} refreshing={refreshing} />
              <PropertiesToolbar
                subtitle={statsLoading ? 'Portfólio ativo' : subtitle}
                canAdd={!isCorretor}
                onAdd={onAddNew}
                onRefresh={handleRefresh}
                refreshing={refreshing}
              />
              <PipelineKpis items={statsLoading ? [] : kpis} denseScroll />
            </div>
          </div>

          <div className="border-t border-border/70 px-3 py-2 sm:px-5 sm:py-3 md:py-4">
            <PropertiesFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchSuggestions={searchSuggestions}
              onPickSuggestion={(item) => {
                setSearchTerm(item);
                setFilters((prev) => ({ ...prev, search: item }));
                setSearchSuggestions([]);
              }}
              selectedTab={statusTab}
              onTabChange={handleStatusTabChange}
              counts={tabCounts}
              sortKey={sortKey}
              onSortChange={handleSortChange}
              advancedOpen={isFiltersOpen}
              onToggleAdvanced={() => setIsFiltersOpen((v) => !v)}
              advancedPanel={
                <PropertiesAdvancedFilters
                  filters={filters}
                  setFilters={setFilters}
                  setPage={setPage}
                  citySuggestions={citySuggestions}
                  neighborhoodSuggestions={neighborhoodSuggestions}
                  addressSuggestions={addressSuggestions}
                  onCityChange={async (v) => {
                    setFilters((prev) => ({ ...prev, cidade: v || undefined }));
                    setPage(1);
                    setCitySuggestions(await suggestCities(v));
                    setNeighborhoodSuggestions([]);
                  }}
                  onNeighborhoodChange={async (v) => {
                    setFilters((prev) => ({ ...prev, bairro: v || undefined }));
                    setPage(1);
                    setNeighborhoodSuggestions(await suggestNeighborhoods(filters.cidade || '', v));
                  }}
                  onAddressChange={async (v) => {
                    setFilters((prev) => ({ ...prev, endereco: v || undefined }));
                    setPage(1);
                    setAddressSuggestions(await suggestAddresses(v));
                  }}
                  onClearCitySuggestions={() => setCitySuggestions([])}
                  onClearNeighborhoodSuggestions={() => setNeighborhoodSuggestions([])}
                  onClearAddressSuggestions={() => setAddressSuggestions([])}
                  onClear={() => {
                    setPage(1);
                    setFilters({
                      search: filters.search,
                      disponibilidade: filters.disponibilidade,
                      modalidade: filters.modalidade,
                    });
                    setCitySuggestions([]);
                    setNeighborhoodSuggestions([]);
                    setAddressSuggestions([]);
                  }}
                  onApply={() => {
                    setPage(1);
                    refetchImoveisList();
                  }}
                />
              }
            />
          </div>
        </div>

        <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
          {loadingCombined && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
                >
                  <div className="h-48 bg-muted animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                    <div className="h-16 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingCombined && filteredProperties.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProperties.slice(0, visibleCount).map((property) => (
                <PropertiesPropertyCard
                  key={property.id}
                  property={property}
                  imageIndex={getCurrentImageIndex(property.id)}
                  isCorretor={isCorretor}
                  onPrevImage={() =>
                    handlePreviousImage(property.id, property.property_images?.length || 0)
                  }
                  onNextImage={() =>
                    handleNextImage(property.id, property.property_images?.length || 0)
                  }
                  onOpenGallery={() =>
                    handleOpenImageGallery(property, getCurrentImageIndex(property.id))
                  }
                  onView={() => handleViewDetails(property)}
                  onEdit={() =>
                    isVivaRealMode ? startVivaRealEdit(property) : handleEditProperty(property)
                  }
                  onAvailability={() => {
                    setAvailabilityTarget(property);
                    setAvailabilityValue(
                      ((property as any).disponibilidade || 'disponivel') as any,
                    );
                    setAvailabilityNote('');
                    setAvailabilityDialogOpen(true);
                  }}
                  onRequestDelete={() => {
                    setDeletingProperty(property);
                    setDeleteDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {!loadingCombined && visibleCount < filteredProperties.length && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="rounded-xl border-border bg-card"
                onClick={() => setVisibleCount((v) => Math.min(v + 24, filteredProperties.length))}
              >
                Carregar mais
              </Button>
            </div>
          )}

          {!loadingCombined && (
            <PropertiesPagination
              shown={Math.min(visibleCount, filteredProperties.length)}
              total={total}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}

          {!loadingCombined && filteredProperties.length === 0 && (
            <div className="text-center py-16 rounded-2xl border border-border bg-card shadow-sm">
              <Building2 className="h-14 w-14 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {total === 0 ? 'Nenhum imóvel cadastrado' : 'Nenhum imóvel encontrado'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                {total === 0
                  ? 'Comece adicionando seu primeiro imóvel ao portfólio.'
                  : 'Não há imóveis que correspondam aos filtros selecionados.'}
              </p>
              {!isCorretor && (
                <Button
                  onClick={onAddNew}
                  className="btn-on-emerald rounded-xl bg-emerald-800 text-white hover:bg-emerald-700"
                  style={{ color: '#ffffff' }}
                >
                  <Plus className="h-4 w-4 mr-2" style={{ color: '#ffffff' }} />
                  {total === 0 ? 'Adicionar primeiro imóvel' : 'Adicionar imóvel'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o imóvel &quot;{deletingProperty?.title}&quot;? Esta
              ação não pode ser desfeita e todas as imagens associadas também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeletingProperty(null);
                setDeleteDialogOpen(false);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingProperty) return;
                if (isVivaRealMode) handleDeleteVivaReal(deletingProperty);
                else handleDeleteProperty(deletingProperty);
                setDeleteDialogOpen(false);
              }}
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modals */}
      <Suspense fallback={null}>
        <PropertyDetailsPopup
          property={selectedProperty}
          open={isDetailsOpen}
          onClose={handleCloseDetails}
          onEdit={
            selectedProperty
              ? () => {
                  const p = selectedProperty;
                  handleCloseDetails();
                  if (isVivaRealMode) startVivaRealEdit(p);
                  else handleEditProperty(p);
                }
              : undefined
          }
        />
      </Suspense>

      {/* Modal de Alteração de Disponibilidade */}
      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Alterar disponibilidade</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3 flex-col">
              <Select value={availabilityValue} onValueChange={(v: any) => setAvailabilityValue(v as any)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Disponibilidade" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="indisponivel">Indisponível</SelectItem>
                  <SelectItem value="reforma">Reforma</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs italic text-muted-foreground">
                Se marcar como Indisponível ou Reforma, descreva o motivo na observação.
              </p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Observação</label>
              <Textarea
                value={availabilityNote}
                onChange={(e) => setAvailabilityNote(e.target.value)}
                className="mt-1"
                placeholder="Descreva o motivo quando marcar Indisponível ou Reforma"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setAvailabilityDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="btn-on-emerald rounded-xl bg-emerald-800 text-white hover:bg-emerald-700"
                style={{ color: '#ffffff' }}
                onClick={async () => {
                  try {
                    if (!availabilityTarget) return;
                    
                    // Regra de negócio: observação obrigatória quando indisponível ou reforma
                    if ((availabilityValue === 'indisponivel' || availabilityValue === 'reforma') && (!availabilityNote || availabilityNote.trim().length === 0)) {
                      toast({ title: 'Observação obrigatória', description: 'Descreva o motivo ao marcar como Indisponível ou Reforma.', variant: 'destructive' });
                      return;
                    }

                    const isViva = isVivaRealMode;
                    
                    if (isViva) {
                      // Usar updateImovel do hook para imóveis VivaReal
                      const result = await updateImovel(Number(availabilityTarget.id), {
                        disponibilidade: availabilityValue,
                        disponibilidade_observacao: availabilityNote || null
                      });
                      
                      if (!result) {
                        throw new Error('Erro ao atualizar disponibilidade do imóvel');
                      }
                    } else {
                      // Propriedades legadas não são mais suportadas (tabela properties não existe)
                      // Apenas logar e informar que não é possível atualizar
                      console.warn('⚠️ Tentativa de atualizar propriedade legada. Tabela properties não existe mais.');
                      throw new Error('Propriedades legadas não são mais suportadas. Use imóveis VivaReal.');
                    }

                    toast({ title: 'Disponibilidade atualizada com sucesso' });
                    setAvailabilityDialogOpen(false);
                    
                  } catch (err: any) {
                    toast({ title: 'Erro ao atualizar', description: err.message || 'Tente novamente', variant: 'destructive' });
                  }
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PropertyImageGallery
        property={imageGalleryProperty}
        open={isImageGalleryOpen}
        onClose={handleCloseImageGallery}
        initialImageIndex={galleryInitialIndex}
      />

      {/* Modal de Edição VivaReal — modal={false}: com modal=true o Radix bloqueia pointer-events fora do
          Content (RemoveScroll + DismissableLayer), e o lightbox no body não recebia clique nas setas/X/campo. */}
      <Dialog
        modal={false}
        open={isVivaRealEditOpen}
        onOpenChange={(open) => {
          setIsVivaRealEditOpen(open);
          if (!open) setEditImageLightboxIndex(null);
        }}
      >
        {isVivaRealEditOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-[40] bg-black/80"
              aria-hidden
              onPointerDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (editImageLightboxIndex !== null) setEditImageLightboxIndex(null);
                else setIsVivaRealEditOpen(false);
              }}
            />,
            document.body
          )}
        <DialogContent
          className="gap-0 overflow-hidden p-0 bg-background border-border text-foreground sm:max-w-2xl max-h-[min(90dvh,880px)] w-[min(92vw,42rem)] sm:rounded-2xl flex flex-col"
          /* Lightbox está fora deste nó (portal). Sem preventDefault, o DismissableLayer trata clique/foco na galeria como “fora” e fecha o modal. Não use position:relative aqui — sobrescreve o fixed do dialog.tsx e desloca o popup no fluxo da página. */
          onPointerDownOutside={(e) => {
            if (editImageLightboxIndex !== null) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (editImageLightboxIndex !== null) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (editImageLightboxIndex !== null) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (editImageLightboxIndex !== null) {
              e.preventDefault();
              setEditImageLightboxIndex(null);
            }
          }}
        >
          {/* Header — dark forest (mesmo idioma visual da Ver ficha) */}
          <div
            className="flex-shrink-0 px-5 sm:px-6 py-4 sm:py-5"
            style={{ backgroundColor: '#1a2e24' }}
          >
            <DialogHeader className="space-y-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <DialogTitle
                    className="text-lg sm:text-xl font-semibold leading-snug"
                    style={{ color: '#ffffff' }}
                  >
                    Editar Imóvel (VivaReal)
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 text-sm" style={{ color: '#a3a3a3' }}>
                    Atualize os campos básicos e adicione/remova imagens.
                  </DialogDescription>
                </div>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg hover:bg-white/10 shrink-0"
                    aria-label="Fechar"
                    style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.25)' }}
                    onClick={() => {
                      setIsVivaRealEditOpen(false);
                      setEditImageLightboxIndex(null);
                    }}
                  >
                    <X className="h-4 w-4" style={{ color: '#ffffff' }} />
                  </Button>
                </DialogClose>
              </div>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden space-y-4 px-5 sm:px-6 py-5 bg-background">
            <div>
              <label className="text-sm text-muted-foreground">Preço (R$)</label>
              <Input
                inputMode="numeric"
                value={editPreco}
                onChange={(e) => setEditPreco(formatBRLInput(e.target.value))}
                placeholder="R$ 0,00"
                className="mt-1 bg-background border-border text-foreground"
              />
           
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Área (m²)</label>
                <Input value={editArea} onChange={(e) => setEditArea(e.target.value)} className="mt-1 bg-background border-border text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Quartos</label>
                <Input value={editQuartos} onChange={(e) => setEditQuartos(e.target.value)} className="mt-1 bg-background border-border text-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Banheiros</label>
                <Input value={editBanheiros} onChange={(e) => setEditBanheiros(e.target.value)} className="mt-1 bg-background border-border text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Modalidade</label>
                <Select value={editModalidade} onValueChange={setEditModalidade}>
                  <SelectTrigger className="mt-1 bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border text-foreground">
                    {MODALIDADE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-foreground focus:bg-emerald-50 focus:text-emerald-900 dark:focus:bg-emerald-950/40 dark:focus:text-emerald-100">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Descrição</label>
              <textarea value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-md p-2 text-foreground min-h-[100px]"></textarea>
            </div>

            {/* Características / amenidades — gravadas em INGLÊS para casar com a tool
                `buscar_por_features` do agente n8n (ver src/constants/imovelFeatures.ts). */}
            <div>
              <label className="text-sm text-muted-foreground font-medium">Características</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FEATURE_OPTIONS.map((opt) => {
                  const active = editFeatures.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleEditFeature(opt.value)}
                      className={
                        'px-3 py-1.5 rounded-full text-sm border transition-colors ' +
                        (active
                          ? 'btn-on-emerald bg-emerald-800 border-emerald-700 text-white hover:bg-emerald-700'
                          : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground')
                      }
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {editFeatures.length === 0
                  ? 'Nenhuma característica selecionada'
                  : `${editFeatures.length} selecionada${editFeatures.length > 1 ? 's' : ''}`}
              </p>
            </div>

            {/*
             * =====================================================================================
             * CLAUDE AQUI ESTÁ A PARTE DE ADICIONAR A DESCRIÇÃO DA IMAGEM
             * (texto idêntico pedido pelo time: busque no repo por essa frase inteira)
             *
             * Miniaturas + lightbox + editExistingCaptions / editNewCaptions + persistência
             * imagens_legendas em imoveisvivareal — migration
             * 20260509120000_imoveisvivareal_imagens_legendas.sql
             * =====================================================================================
             */}
            {/* Seção de Imagens — chrome light-friendly (corpo cream) */}
            <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Imagens (até {MAX_IMAGES})
                  </label>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                    Toque ou clique na foto para ampliar. Use as setas ou deslize no celular. Abaixo da imagem você
                    pode escrever uma descrição curta (opcional, até {IMAGE_CAPTION_MAX} caracteres).
                  </p>
                </div>
                <span className="shrink-0 self-start rounded-full border border-border bg-background px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                  {editExistingImages.length + editImages.length}/{MAX_IMAGES}
                </span>
              </div>

              {/* Imagens existentes */}
              {editExistingImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Já no imóvel
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
                    {editExistingImages.map((url, idx) => (
                      <div
                        key={`existing-${idx}`}
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-all duration-200 hover:border-emerald-500/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditImageLightboxIndex(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setEditImageLightboxIndex(idx);
                          }
                        }}
                      >
                        <div className="relative aspect-[4/3] w-full">
                          <img
                            src={convertGoogleDriveUrl(url, 'thumbnail')}
                            alt={`Imagem ${idx + 1}`}
                            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                            onError={(e) => {
                              handleImageErrorWithFallback(e, url, '/placeholder-property.jpg');
                            }}
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 opacity-80 transition-opacity group-hover:opacity-100" />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm" style={{ color: '#ffffff' }}>
                              <Eye className="h-3.5 w-3.5" aria-hidden style={{ color: '#ffffff' }} />
                              Ver
                            </span>
                          </div>
                          <span className="pointer-events-none absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-md bg-black/55 px-1.5 text-[11px] font-semibold backdrop-blur-sm" style={{ color: '#ffffff' }}>
                            {idx + 1}
                          </span>
                        </div>
                        <div className="border-t border-border bg-background/80 px-2 py-1.5">
                          {(editExistingCaptions[idx] || '').length > 0 ? (
                            <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{editExistingCaptions[idx]}</p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/60">Sem descrição</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeExistingImage(idx);
                          }}
                          className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/95 shadow-lg ring-1 ring-black/20 transition-transform hover:scale-105 active:scale-95 sm:opacity-0 sm:group-hover:opacity-100"
                          style={{ color: '#ffffff' }}
                          aria-label="Remover imagem"
                        >
                          <X className="h-4 w-4" style={{ color: '#ffffff' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Novas imagens */}
              {editPreviews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Novas (ainda não salvas)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
                    {editPreviews.map((preview, idx) => (
                      <div
                        key={`new-${idx}`}
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-emerald-300/70 bg-emerald-50/50 dark:border-emerald-600/50 dark:bg-emerald-950/20 shadow-sm transition-all duration-200 hover:border-emerald-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditImageLightboxIndex(editExistingImages.length + idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setEditImageLightboxIndex(editExistingImages.length + idx);
                          }
                        }}
                      >
                        <div className="relative aspect-[4/3] w-full">
                          <img
                            src={preview}
                            alt={`Nova imagem ${idx + 1}`}
                            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/50 via-transparent to-black/10 opacity-80" />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm" style={{ color: '#ffffff' }}>
                              <Eye className="h-3.5 w-3.5" aria-hidden style={{ color: '#ffffff' }} />
                              Ver
                            </span>
                          </div>
                          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow" style={{ color: '#ffffff' }}>
                            Novo
                          </span>
                        </div>
                        <div className="border-t border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/80 dark:bg-emerald-950/30 px-2 py-1.5">
                          {(editNewCaptions[idx] || '').length > 0 ? (
                            <p className="line-clamp-2 text-[11px] leading-snug text-emerald-900/80 dark:text-emerald-100/90">{editNewCaptions[idx]}</p>
                          ) : (
                            <p className="text-[11px] text-emerald-700/70 dark:text-emerald-700/90">Sem descrição</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEditImage(idx);
                          }}
                          className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/95 shadow-lg ring-1 ring-black/20 transition-transform hover:scale-105 active:scale-95 sm:opacity-0 sm:group-hover:opacity-100"
                          style={{ color: '#ffffff' }}
                          aria-label="Remover imagem"
                        >
                          <X className="h-4 w-4" style={{ color: '#ffffff' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão para adicionar imagens do computador */}
              <label className="inline-flex h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:border-emerald-500/50 hover:bg-muted">
                <ImagePlus className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
                <span>Do computador</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onSelectEditImages(e.target.files)}
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border mt-2">
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-muted"
                onClick={() => {
                  setIsVivaRealEditOpen(false);
                  setEditImages([]);
                  setEditPreviews([]);
                  setEditNewCaptions([]);
                  setEditImageLightboxIndex(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                className="btn-on-emerald bg-emerald-800 hover:bg-emerald-700"
                style={{ color: '#ffffff' }}
                onClick={submitVivaRealEdit}
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {editImageLightboxIndex !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={
              'pointer-events-auto fixed inset-0 z-[100] flex max-h-[100dvh] flex-col backdrop-blur-xl supports-[height:100dvh]:min-h-[100dvh] ' +
              (isDarkGallery
                ? 'bg-zinc-950/95 text-white'
                : 'bg-white/[0.97] text-zinc-900 shadow-2xl ring-1 ring-black/10')
            }
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Visualização da imagem"
          >
            <header
              className={
                'flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3 sm:px-5 sm:py-4 ' +
                (isDarkGallery
                  ? 'border-white/10 bg-gradient-to-b from-zinc-900/95 to-zinc-950/80'
                  : 'border-zinc-200 bg-gradient-to-b from-white to-zinc-50')
              }
            >
              <div className="min-w-0 flex-1">
                <p
                  className={
                    'text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-xs ' +
                    (isDarkGallery ? 'text-emerald-400/90' : 'text-emerald-600')
                  }
                >
                  Galeria
                </p>
                <p
                  className={
                    'truncate text-sm font-medium sm:text-base ' +
                    (isDarkGallery ? 'text-zinc-100' : 'text-zinc-900')
                  }
                >
                  Foto {(editImageLightboxIndex ?? 0) + 1} de {Math.max(totalEditImageCount, 1)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar galeria"
                onClick={() => setEditImageLightboxIndex(null)}
                className={
                  'inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
                  (isDarkGallery
                    ? 'border-white/25 bg-zinc-900/90 text-zinc-100 hover:bg-red-600 hover:border-red-500 hover:text-white focus-visible:ring-red-400/60 focus-visible:ring-offset-zinc-950'
                    : 'border-zinc-500 bg-zinc-200 text-zinc-900 hover:bg-red-600 hover:border-red-600 hover:text-white focus-visible:ring-red-500/50 focus-visible:ring-offset-white')
                }
              >
                <X className="h-9 w-9" strokeWidth={2.75} aria-hidden />
              </button>
            </header>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2 sm:px-12 sm:py-6"
                onTouchStart={(e) => {
                  lightboxTouchStartX.current = e.changedTouches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  const start = lightboxTouchStartX.current;
                  lightboxTouchStartX.current = null;
                  const end = e.changedTouches[0]?.clientX;
                  if (start == null || end == null || totalEditImageCount <= 1) return;
                  const dx = end - start;
                  if (dx > 50) {
                    setEditImageLightboxIndex((i) =>
                      i === null ? i : (i - 1 + totalEditImageCount) % totalEditImageCount
                    );
                  } else if (dx < -50) {
                    setEditImageLightboxIndex((i) => (i === null ? i : (i + 1) % totalEditImageCount));
                  }
                }}
              >
                {totalEditImageCount > 0 && editImageLightboxIndex !== null && (
                  <>
                    <button
                      type="button"
                      aria-label="Imagem anterior"
                      disabled={totalEditImageCount <= 1}
                      onClick={() =>
                        setEditImageLightboxIndex((i) =>
                          i === null || totalEditImageCount <= 1
                            ? i
                            : (i - 1 + totalEditImageCount) % totalEditImageCount
                        )
                      }
                      className={
                        'pointer-events-auto absolute left-1 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-xl backdrop-blur-sm transition sm:flex disabled:pointer-events-none disabled:opacity-25 ' +
                        (isDarkGallery
                          ? 'border-white/15 bg-zinc-900/95 text-white hover:bg-emerald-600/90 hover:border-emerald-400/40'
                          : 'border-zinc-500 bg-zinc-100 text-zinc-900 shadow-lg hover:bg-emerald-600 hover:border-emerald-600 hover:text-white')
                      }
                    >
                      <ChevronLeft className="h-7 w-7 shrink-0" strokeWidth={2.75} />
                    </button>
                    <button
                      type="button"
                      aria-label="Próxima imagem"
                      disabled={totalEditImageCount <= 1}
                      onClick={() =>
                        setEditImageLightboxIndex((i) =>
                          i === null || totalEditImageCount <= 1 ? i : (i + 1) % totalEditImageCount
                        )
                      }
                      className={
                        'pointer-events-auto absolute right-1 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-xl backdrop-blur-sm transition sm:flex disabled:pointer-events-none disabled:opacity-25 ' +
                        (isDarkGallery
                          ? 'border-white/15 bg-zinc-900/95 text-white hover:bg-emerald-600/90 hover:border-emerald-400/40'
                          : 'border-zinc-500 bg-zinc-100 text-zinc-900 shadow-lg hover:bg-emerald-600 hover:border-emerald-600 hover:text-white')
                      }
                    >
                      <ChevronRight className="h-7 w-7 shrink-0" strokeWidth={2.75} />
                    </button>
                    <div
                      className={
                        'mx-auto max-h-full max-w-[min(100vw-1rem,1200px)] overflow-hidden rounded-lg shadow-2xl sm:rounded-2xl ' +
                        (isDarkGallery ? 'ring-1 ring-white/10' : 'ring-1 ring-zinc-300 shadow-xl')
                      }
                    >
                      <img
                        src={
                          editImageLightboxIndex < editExistingImages.length
                            ? convertGoogleDriveUrl(editExistingImages[editImageLightboxIndex], 'full')
                            : editPreviews[editImageLightboxIndex - editExistingImages.length] ?? ''
                        }
                        alt=""
                        className="max-h-[min(52dvh,520px)] w-auto max-w-[100vw] object-contain sm:max-h-[min(72dvh,880px)]"
                        onError={(e) => {
                          if (editImageLightboxIndex < editExistingImages.length) {
                            handleImageErrorWithFallback(
                              e,
                              editExistingImages[editImageLightboxIndex],
                              '/placeholder-property.jpg'
                            );
                          }
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              {totalEditImageCount > 1 && (
                <div className="flex shrink-0 justify-center gap-1.5 overflow-x-auto px-3 pb-2 sm:hidden">
                  {Array.from({ length: totalEditImageCount }).map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      aria-label={`Ir para foto ${dotIdx + 1}`}
                      onClick={() => setEditImageLightboxIndex(dotIdx)}
                      className={
                        'h-2 w-2 shrink-0 rounded-full transition-all ' +
                        (editImageLightboxIndex === dotIdx
                          ? isDarkGallery
                            ? 'w-6 bg-emerald-400'
                            : 'w-6 bg-emerald-600'
                          : isDarkGallery
                            ? 'bg-zinc-600 hover:bg-zinc-500'
                            : 'bg-zinc-300 hover:bg-zinc-400')
                      }
                    />
                  ))}
                </div>
              )}

              <div
                className={
                  'flex shrink-0 items-center justify-center gap-4 border-t py-3 sm:hidden ' +
                  (isDarkGallery ? 'border-white/10 bg-zinc-900/80' : 'border-zinc-200 bg-zinc-100/90')
                }
              >
                <button
                  type="button"
                  aria-label="Imagem anterior"
                  disabled={totalEditImageCount <= 1}
                  onClick={() =>
                    setEditImageLightboxIndex((i) =>
                      i === null || totalEditImageCount <= 1
                        ? i
                        : (i - 1 + totalEditImageCount) % totalEditImageCount
                    )
                  }
                  className={
                    'flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 disabled:opacity-30 ' +
                    (isDarkGallery
                      ? 'border-white/15 bg-zinc-800 text-white'
                      : 'border-zinc-500 bg-zinc-100 text-zinc-900 hover:bg-emerald-600 hover:text-white hover:border-emerald-600')
                  }
                >
                  <ChevronLeft className="h-7 w-7 shrink-0" strokeWidth={2.75} />
                </button>
                <button
                  type="button"
                  aria-label="Próxima imagem"
                  disabled={totalEditImageCount <= 1}
                  onClick={() =>
                    setEditImageLightboxIndex((i) =>
                      i === null || totalEditImageCount <= 1 ? i : (i + 1) % totalEditImageCount
                    )
                  }
                  className={
                    'flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg active:scale-95 disabled:opacity-30 ' +
                    (isDarkGallery
                      ? 'border-white/15 bg-zinc-800 text-white'
                      : 'border-zinc-500 bg-zinc-100 text-zinc-900 hover:bg-emerald-600 hover:text-white hover:border-emerald-600')
                  }
                >
                  <ChevronRight className="h-7 w-7 shrink-0" strokeWidth={2.75} />
                </button>
              </div>
            </div>

            <footer
              className={
                'shrink-0 space-y-3 rounded-t-2xl border border-b-0 px-3 py-4 sm:px-6 sm:py-5 ' +
                (isDarkGallery
                  ? 'border-white/10 bg-gradient-to-b from-zinc-900/98 to-zinc-950 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]'
                  : 'border-zinc-200 bg-gradient-to-b from-white to-zinc-50 shadow-[0_-12px_32px_rgba(0,0,0,0.1)]')
              }
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="flex items-end justify-between gap-2">
                <label
                  htmlFor="edit-image-caption"
                  className={'text-sm font-medium ' + (isDarkGallery ? 'text-zinc-200' : 'text-zinc-800')}
                >
                  Descrição desta foto
                </label>
                <span className={'tabular-nums text-xs ' + (isDarkGallery ? 'text-zinc-500' : 'text-zinc-500')}>
                  {editImageLightboxIndex === null
                    ? 0
                    : editImageLightboxIndex < editExistingImages.length
                      ? (editExistingCaptions[editImageLightboxIndex] ?? '').length
                      : (editNewCaptions[editImageLightboxIndex - editExistingImages.length] ?? '').length}
                  /{IMAGE_CAPTION_MAX}
                </span>
              </div>
              <Input
                id="edit-image-caption"
                maxLength={IMAGE_CAPTION_MAX}
                value={
                  editImageLightboxIndex === null
                    ? ''
                    : editImageLightboxIndex < editExistingImages.length
                      ? editExistingCaptions[editImageLightboxIndex] ?? ''
                      : editNewCaptions[editImageLightboxIndex - editExistingImages.length] ?? ''
                }
                onChange={(e) => {
                  const lb = editImageLightboxIndex;
                  const v = clampCaption(e.target.value);
                  if (lb === null) return;
                  if (lb < editExistingImages.length) {
                    setEditExistingCaptions((prev) => {
                      const n = [...prev];
                      n[lb] = v;
                      return n;
                    });
                  } else {
                    const ni = lb - editExistingImages.length;
                    setEditNewCaptions((prev) => {
                      const n = [...prev];
                      n[ni] = v;
                      return n;
                    });
                  }
                }}
                placeholder="Opcional — ex.: Sala com varanda"
                className={
                  'h-11 text-[15px] focus-visible:ring-2 ' +
                  (isDarkGallery
                    ? 'border-zinc-600 bg-zinc-950/80 text-white placeholder:text-zinc-500 focus-visible:ring-emerald-500/40'
                    : 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-emerald-600/35')
                }
              />
              <p
                className={
                  'text-center text-[11px] leading-relaxed sm:text-left ' +
                  (isDarkGallery ? 'text-zinc-500' : 'text-zinc-500')
                }
              >
                Fica salva com o imóvel ao clicar em &quot;Salvar&quot; no formulário.
              </p>
            </footer>
          </div>,
          document.body
        )}
    </div>
  );
}
