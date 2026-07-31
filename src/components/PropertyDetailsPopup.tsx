import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  X,
  Shield,
  Globe,
  Link as LinkIcon,
  Copy,
  ChevronLeft,
  ChevronRight,
  Share2,
  Pencil,
  ExternalLink,
  CalendarPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PropertyWithImages } from "@/hooks/useProperties";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { convertGoogleDriveUrl, handleImageErrorWithFallback } from "@/utils/imageUtils";
import { MarketingActionCards } from "./MarketingActionCards";
import {
  availabilityLabel,
  formatPropertyPrice,
  translateCategoria,
  translateModalidade,
  translateTipoImovel,
} from "@/components/properties/helpers";

type PropertyExtra = PropertyWithImages & {
  disponibilidade?: string;
  disponibilidade_observacao?: string;
  listing_id?: string;
  modalidade?: string;
  tipo_imovel?: string;
  tipo_categoria?: string;
  suite?: number | null;
  garagem?: number | null;
  features?: string[] | null;
  cep?: string | null;
  bairro?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  andar?: number | null;
  ano_construcao?: number | null;
  company_id?: string | null;
  accepts_partnership?: boolean | null;
  partnership_notes?: string | null;
  imagens_legendas?: string[] | null;
};

interface PropertyDetailsPopupProps {
  property: PropertyWithImages | null;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

function formatCep(cep?: string | null): string | null {
  if (!cep) return null;
  const digits = String(cep).replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  return String(cep);
}

function dashStat(n?: number | null): string {
  if (n == null || Number(n) <= 0) return "—";
  return String(n);
}

export function PropertyDetailsPopup({ property, open, onClose, onEdit }: PropertyDetailsPopupProps) {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const isCorretor = profile?.role === "corretor";
  const [availOpen, setAvailOpen] = useState(false);
  const [availValue, setAvailValue] = useState<"disponivel" | "indisponivel" | "reforma">("disponivel");
  const [availNote, setAvailNote] = useState("");

  const [lpOpen, setLpOpen] = useState(false);
  const [lpLoading, setLpLoading] = useState(false);
  const [lpData, setLpData] = useState<any>(null);
  const [lpSlug, setLpSlug] = useState("");
  const [lpTitle, setLpTitle] = useState("");
  const [lpPublished, setLpPublished] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if (!lpOpen || !property) return;
    loadLpData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpOpen, property?.id]);

  useEffect(() => {
    if (open && property) {
      setGalleryIndex(0);
    }
  }, [open, property?.id]);

  const resolveLpCompanyId = (): string | null => {
    const fromProperty = (property as PropertyExtra | null)?.company_id;
    return profile?.company_id ?? fromProperty ?? null;
  };

  const loadLpData = async () => {
    if (!property) return;
    const companyId = resolveLpCompanyId();
    if (!companyId) {
      toast.error("Não foi possível identificar a empresa do imóvel.");
      return;
    }

    try {
      setLpLoading(true);
      const { data, error } = await supabase
        .from("property_landing_pages")
        .select("*")
        .eq("property_id", property.id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) {
        console.error(error);
        toast.error("Erro ao carregar dados da landing page.");
        return;
      }

      if (data) {
        setLpData(data);
        setLpSlug((data as { slug?: string }).slug || "");
        setLpTitle((data as { page_title?: string | null }).page_title || "");
        setLpPublished(!!(data as { is_published?: boolean }).is_published);
      } else {
        setLpData(null);
        setLpSlug(`imovel-${property.id}`);
        setLpTitle(property.title || "");
        setLpPublished(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar landing page.");
    } finally {
      setLpLoading(false);
    }
  };

  const handleSaveLp = async () => {
    if (!lpSlug) {
      toast.error("O link (slug) é obrigatório.");
      return;
    }

    if (!/^[a-z0-9-]+$/.test(lpSlug)) {
      toast.error("O link deve conter apenas letras minúsculas, números e hifens.");
      return;
    }

    const companyId = resolveLpCompanyId();
    if (!companyId) {
      toast.error("Empresa não identificada. Faça login novamente.");
      return;
    }

    const propertyCompanyId = (property as PropertyExtra | null)?.company_id;
    if (propertyCompanyId && propertyCompanyId !== companyId) {
      toast.error("Este imóvel não pertence à sua empresa.");
      return;
    }

    try {
      const pageTitle = lpTitle.trim() || null;

      if (lpData?.id) {
        const { error } = await supabase
          .from("property_landing_pages")
          .update({
            slug: lpSlug,
            is_published: lpPublished,
            page_title: pageTitle,
          })
          .eq("id", lpData.id)
          .eq("company_id", companyId);
        if (error) throw error;
        setLpData({ ...lpData, slug: lpSlug, is_published: lpPublished, page_title: pageTitle });
        toast.success("Landing page atualizada!");
      } else {
        const { data, error } = await supabase
          .from("property_landing_pages")
          .insert({
            property_id: Number(property!.id),
            company_id: companyId,
            slug: lpSlug,
            is_published: lpPublished,
            page_title: pageTitle,
          })
          .select()
          .single();
        if (error) throw error;
        setLpData(data);
        toast.success("Landing page criada com sucesso!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Erro ao salvar. O slug pode já estar em uso por outro imóvel.");
    }
  };

  const publicLink = `${window.location.origin}/imovel/${lpSlug || (property ? `imovel-${property.id}` : "")}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    toast.success("Link copiado para a área de transferência!");
  };

  const handleShare = async () => {
    const shareUrl = publicLink;
    const shareTitle = property?.title || "Imóvel";
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      }
    } catch {
      /* user cancelled or share failed — fall through to copy */
    }
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado para compartilhar!");
  };

  const goPrevImage = () => {
    const len = property?.property_images?.length ?? 0;
    if (len < 2) return;
    setGalleryIndex((i) => (i - 1 + len) % len);
  };

  const goNextImage = () => {
    const len = property?.property_images?.length ?? 0;
    if (len < 2) return;
    setGalleryIndex((i) => (i + 1) % len);
  };

  if (!property) return null;

  const extra = property as PropertyExtra;
  const listingCode = extra.listing_id || "—";
  const disponibilidade = extra.disponibilidade || "disponivel";
  const statusLabel = availabilityLabel(disponibilidade).toUpperCase();

  const tipoLabel = extra.tipo_imovel ? translateTipoImovel(extra.tipo_imovel) : property.title;
  const placeLabel = extra.bairro || property.city;
  const displayTitle =
    tipoLabel && placeLabel
      ? `${tipoLabel} · ${placeLabel}`
      : tipoLabel || placeLabel || property.title || "Imóvel";

  let addressLine = "—";
  if (extra.endereco || extra.numero) {
    const street = [extra.endereco, extra.numero].filter(Boolean).join(", ");
    const loc = [extra.bairro, property.city].filter(Boolean).join(" · ");
    const withState = property.state ? `${loc || property.city} / ${property.state}` : loc;
    addressLine = [street, withState].filter(Boolean).join(" · ") || "—";
  } else if (property.address) {
    addressLine = property.address;
  } else {
    addressLine =
      [property.city, property.state].filter(Boolean).join(" / ") || "—";
  }

  const mapsUrl =
    addressLine !== "—"
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`
      : null;

  const priceLabel =
    extra.modalidade === "Rent" ? "VALOR DE ALUGUEL" : "VALOR DE VENDA";

  const galleryImages = property.property_images ?? [];
  const galleryLen = galleryImages.length;
  const activeGalleryIndex = galleryLen > 0 ? Math.min(galleryIndex, galleryLen - 1) : 0;
  const activeGalleryImage = galleryLen > 0 ? galleryImages[activeGalleryIndex] : null;
  const activeCaption =
    (activeGalleryImage as { legenda?: string } | null)?.legenda ||
    (Array.isArray(extra.imagens_legendas) ? extra.imagens_legendas[activeGalleryIndex] : null);

  const fichaRows: { label: string; value: string }[] = [];
  {
    const tipoParts = [
      extra.tipo_imovel ? translateTipoImovel(extra.tipo_imovel) : null,
      translateCategoria(extra.tipo_categoria),
    ].filter(Boolean);
    if (tipoParts.length) fichaRows.push({ label: "Tipo de imóvel", value: tipoParts.join(" · ") });

    const modalidade = translateModalidade(extra.modalidade);
    if (modalidade) fichaRows.push({ label: "Modalidade", value: modalidade });

    fichaRows.push({
      label: "Situação",
      value: [
        availabilityLabel(disponibilidade),
        extra.disponibilidade_observacao?.trim() || null,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    if (extra.suite != null && Number(extra.suite) > 0) {
      fichaRows.push({ label: "Suítes", value: String(extra.suite) });
    }
    if (extra.andar != null && Number(extra.andar) > 0) {
      fichaRows.push({ label: "Andar", value: String(extra.andar) });
    }
    if (extra.ano_construcao != null && Number(extra.ano_construcao) > 0) {
      fichaRows.push({ label: "Ano de construção", value: String(extra.ano_construcao) });
    }
    if (Array.isArray(extra.features) && extra.features.length > 0) {
      fichaRows.push({ label: "Destaques", value: extra.features.join(" · ") });
    }
    if (extra.accepts_partnership) {
      fichaRows.push({
        label: "Parceria",
        value: extra.partnership_notes?.trim() || "Aceita parceria",
      });
    }
    if (property.description?.trim()) {
      fichaRows.push({
        label: "Descrição",
        value: property.description.trim(),
      });
    }
  }

  const cepFormatted = formatCep(extra.cep);
  const statusDotClass =
    disponibilidade === "indisponivel"
      ? "bg-rose-400"
      : disponibilidade === "reforma"
        ? "bg-amber-400"
        : "bg-white";
  const statusBadgeClass =
    disponibilidade === "indisponivel"
      ? "bg-rose-700/90"
      : disponibilidade === "reforma"
        ? "bg-amber-600/90"
        : "bg-emerald-600";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[min(100%,72rem)] max-h-[92vh] flex flex-col gap-0 overflow-hidden p-0 bg-background border-border text-foreground sm:rounded-2xl">
        {/* Header — dark forest/charcoal */}
        <div
          className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5"
          style={{ backgroundColor: "#1a2e24" }}
        >
          <DialogHeader className="space-y-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tracking-wide mb-1" style={{ color: "#9ca3af" }}>
                  {listingCode}
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <DialogTitle
                    className="text-lg sm:text-xl font-semibold leading-snug"
                    style={{ color: "#ffffff" }}
                  >
                    {displayTitle}
                  </DialogTitle>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide shrink-0",
                      statusBadgeClass,
                    )}
                    style={{ color: "#ffffff" }}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClass)} aria-hidden />
                    {statusLabel}
                  </span>
                </div>
                <DialogDescription className="mt-1.5 text-sm" style={{ color: "#a3a3a3" }}>
                  {addressLine}
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="hidden sm:inline-flex h-9 rounded-lg border-white/40 bg-transparent hover:bg-white/10"
                  style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.4)" }}
                >
                  <Share2 className="h-3.5 w-3.5 mr-1.5" style={{ color: "#ffffff" }} />
                  Compartilhar
                </Button>
                {onEdit && !isCorretor ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onEdit();
                    }}
                    className="hidden sm:inline-flex h-9 rounded-lg border-white/40 bg-transparent hover:bg-white/10"
                    style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.4)" }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" style={{ color: "#ffffff" }} />
                    Editar imóvel
                  </Button>
                ) : null}
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 rounded-lg hover:bg-white/10"
                    aria-label="Fechar"
                    style={{ color: "#ffffff", backgroundColor: "rgba(0,0,0,0.25)" }}
                  >
                    <X className="h-4 w-4" style={{ color: "#ffffff" }} />
                  </Button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:flex-row lg:overflow-hidden">
          {/* Left — gallery */}
          <div className="flex w-full flex-shrink-0 flex-col border-b border-border/60 bg-muted/20 lg:w-[55%] lg:overflow-hidden lg:border-b-0 lg:border-r">
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-5">
              <div className="relative flex w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted">
                {activeGalleryImage ? (
                  <>
                    <img
                      src={convertGoogleDriveUrl(activeGalleryImage.image_url, "full")}
                      alt={`${property.title} - Imagem ${activeGalleryIndex + 1}`}
                      className="max-h-[min(36vh,320px)] min-h-[180px] w-full object-cover sm:min-h-[220px] sm:max-h-[min(42vh,380px)]"
                      loading="eager"
                      onError={(e) => {
                        handleImageErrorWithFallback(
                          e,
                          activeGalleryImage.image_url,
                          "/placeholder-property.jpg",
                        );
                      }}
                    />
                    {activeCaption ? (
                      <div
                        className="absolute bottom-3 left-3 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ backgroundColor: "rgba(26,46,36,0.85)", color: "#ffffff" }}
                      >
                        {activeCaption}
                      </div>
                    ) : null}
                    {galleryLen > 0 ? (
                      <div
                        className="absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
                        style={{ backgroundColor: "rgba(26,46,36,0.9)", color: "#ffffff" }}
                      >
                        {activeGalleryIndex + 1} / {galleryLen}
                      </div>
                    ) : null}
                    {galleryLen > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={goPrevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/95 text-neutral-900 shadow-md ring-1 ring-black/10 inline-flex items-center justify-center"
                          aria-label="Imagem anterior"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={goNextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/95 text-neutral-900 shadow-md ring-1 ring-black/10 inline-flex items-center justify-center"
                          aria-label="Próxima imagem"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <div
                    className="flex min-h-[200px] w-full items-center justify-center py-16"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(135deg, #EDE9E1 0 10px, #E4DFD4 10px 20px)",
                    }}
                  >
                    <span className="text-[11px] font-semibold tracking-[0.18em] text-stone-500 uppercase">
                      Sem fotos
                    </span>
                  </div>
                )}
              </div>

              {galleryLen > 0 ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Galeria
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Clique na miniatura para ampliar
                    </p>
                  </div>
                  <div className="max-h-[min(22vh,180px)] overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] sm:max-h-[min(28vh,220px)]">
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                      {galleryImages.map((image, index) => (
                        <button
                          key={image.id ?? `${image.image_url}-${index}`}
                          type="button"
                          onClick={() => setGalleryIndex(index)}
                          className={cn(
                            "aspect-square overflow-hidden rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
                            index === activeGalleryIndex
                              ? "border-emerald-800 ring-1 ring-emerald-800/30"
                              : "border-transparent opacity-85 hover:opacity-100",
                          )}
                        >
                          <img
                            src={convertGoogleDriveUrl(image.image_url, "thumbnail")}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              handleImageErrorWithFallback(
                                e,
                                image.image_url,
                                "/placeholder-property.jpg",
                              );
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right — details */}
          <div className="min-h-0 flex-1 p-4 sm:p-6 lg:overflow-y-auto lg:overscroll-contain">
            <div className="space-y-5">
              {/* Price */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {priceLabel}
                </p>
                <p className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
                  {formatPropertyPrice(property.price || 0, extra.modalidade)}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  {
                    label: "ÁREA",
                    value: property.area ? `${property.area} m²` : "—",
                  },
                  { label: "QUARTOS", value: dashStat(property.bedrooms) },
                  { label: "BANHEIROS", value: dashStat(property.bathrooms) },
                  { label: "VAGAS", value: dashStat(extra.garagem) },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border bg-card px-3 py-3 text-center"
                  >
                    <p className="text-base sm:text-lg font-semibold tabular-nums text-foreground">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Location */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Localização
                </p>
                <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 space-y-2">
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="leading-snug">{addressLine}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    {cepFormatted ? (
                      <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        CEP {cepFormatted}
                      </span>
                    ) : null}
                    {mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                      >
                        Ver no mapa
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Ficha técnica */}
              {fichaRows.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Ficha técnica
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                    {fichaRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 px-3.5 py-2.5 text-sm"
                      >
                        <span className="font-semibold text-foreground shrink-0 sm:w-40">
                          {row.label}
                        </span>
                        <span className="text-muted-foreground leading-snug break-words whitespace-pre-wrap min-w-0">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 flex-col gap-3 border-t border-border bg-background px-4 sm:px-6 py-3 sm:py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLpOpen(true)}
              className="rounded-lg border-border h-9"
            >
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Gerar landing page
            </Button>
            <MarketingActionCards property={property as PropertyWithImages} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="rounded-lg border-border h-9"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar link público
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-lg border-border h-9"
            >
              Fechar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAvailValue((disponibilidade as "disponivel" | "indisponivel" | "reforma") || "disponivel");
                setAvailNote("");
                setAvailOpen(true);
              }}
              className="rounded-lg border-border h-9"
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Alterar disponibilidade
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                navigate("/agenda");
              }}
              className="btn-on-emerald rounded-lg h-9 bg-emerald-900 hover:bg-emerald-800"
              style={{ color: "#ffffff" }}
            >
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" style={{ color: "#ffffff" }} />
              Agendar visita
            </Button>
          </div>
        </div>

        {/* Modal disponibilidade */}
        <Dialog open={availOpen} onOpenChange={setAvailOpen}>
          <DialogContent className="bg-background border-border text-foreground sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">Alterar disponibilidade</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Se marcar como Indisponível ou Reforma, descreva o motivo na observação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Select value={availValue} onValueChange={(v: any) => setAvailValue(v)}>
                  <SelectTrigger className="w-48 bg-background border-border text-foreground">
                    <SelectValue placeholder="Disponibilidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="indisponivel">Indisponível</SelectItem>
                    <SelectItem value="reforma">Reforma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Observação</label>
                <Textarea
                  value={availNote}
                  onChange={(e) => setAvailNote(e.target.value)}
                  className="mt-1 bg-background border-border text-foreground"
                  placeholder="Descreva o motivo quando marcar Indisponível ou Reforma"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  className="border-border text-foreground hover:bg-muted"
                  onClick={() => setAvailOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const isViva = !(property as any).property_images?.[0]?.id;
                      const table = isViva ? "imoveisvivareal" : "properties";
                      const idCol = "id";
                      if (
                        (availValue === "indisponivel" || availValue === "reforma") &&
                        (!availNote || availNote.trim().length === 0)
                      ) {
                        toast.error("Informe a observação para Indisponível ou Reforma.");
                        return;
                      }
                      const updates: any = {
                        disponibilidade: availValue,
                        disponibilidade_observacao: availNote || null,
                      };
                      const idValue: any = isViva ? Number(property.id) : property.id;
                      const { error } = await supabase
                        .from(table)
                        .update(updates)
                        .eq(idCol, idValue)
                        .select("id")
                        .maybeSingle();
                      if (error) throw error;
                      setAvailOpen(false);
                      toast.success("Disponibilidade atualizada.");
                    } catch (err: any) {
                      console.error(err);
                      toast.error("Erro ao atualizar disponibilidade.");
                    }
                  }}
                  className="btn-on-emerald bg-emerald-800 hover:bg-emerald-700"
                  style={{ color: "#ffffff" }}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Landing Page */}
        <Dialog open={lpOpen} onOpenChange={setLpOpen}>
          <DialogContent className="gap-0 overflow-hidden p-0 bg-background border-border text-foreground sm:max-w-md sm:rounded-2xl">
            <div className="flex-shrink-0 px-5 sm:px-6 py-4 sm:py-5" style={{ backgroundColor: "#1a2e24" }}>
              <DialogHeader className="space-y-1.5">
                <DialogTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2" style={{ color: "#ffffff" }}>
                  <Globe className="h-5 w-5 shrink-0" style={{ color: "#ffffff" }} />
                  Landing Page Individual
                </DialogTitle>
                <DialogDescription className="text-sm" style={{ color: "#a3a3a3" }}>
                  Gere uma página de divulgação exclusiva para este imóvel para captar leads.
                </DialogDescription>
              </DialogHeader>
            </div>

            {lpLoading ? (
              <div className="py-10 text-center text-muted-foreground px-6">Carregando dados da LP...</div>
            ) : (
              <div className="space-y-4 px-5 sm:px-6 py-5 bg-background">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Título da página (opcional)</label>
                  <Input
                    value={lpTitle}
                    onChange={(e) => setLpTitle(e.target.value)}
                    placeholder="Ex.: Casa 3 quartos no Turú — aparece no título do navegador"
                    className="bg-background border-border text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se vazio, usamos os dados do imóvel na página pública.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Link personalizado (slug)</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted text-muted-foreground sm:text-xs">
                      /imovel/
                    </span>
                    <Input
                      value={lpSlug}
                      onChange={(e) =>
                        setLpSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      }
                      placeholder="imovel-123"
                      className="rounded-l-none bg-background border-border text-foreground flex-1 text-sm pt-2"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div
                    className={`w-10 h-5 rounded-full flex items-center cursor-pointer transition-colors px-1 ${lpPublished ? "bg-emerald-600" : "bg-muted-foreground/40"}`}
                    onClick={() => setLpPublished(!lpPublished)}
                  >
                    <div
                      className={`w-3 h-3 rounded-full shadow-sm transition-transform duration-200 ${lpPublished ? "translate-x-5" : "translate-x-0"}`}
                      style={{ backgroundColor: "#ffffff" }}
                    />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {lpPublished ? "Página Publicada" : "Rascunho (Offline)"}
                  </span>
                </div>

                {lpPublished ? (
                  <div className="p-3 rounded-xl border border-border bg-muted/30 mt-1">
                    <div className="text-xs text-muted-foreground mb-1.5">
                      Link público (ativo após salvar):
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm truncate flex-1 text-foreground/80 font-mono">
                        {`${window.location.origin}/imovel/${lpSlug}`}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0 hover:bg-muted"
                        onClick={handleCopyLink}
                        disabled={!lpSlug}
                      >
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0 hover:bg-muted"
                        onClick={() => window.open(`/imovel/${lpSlug}`, "_blank")}
                        disabled={!lpSlug}
                      >
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    {!lpData?.id && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Clique em &quot;Salvar&quot; para registrar a página e tornar o link acessível.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border bg-muted/20 p-3">
                    Com o modo rascunho, o link{" "}
                    <span className="font-mono">/imovel/{lpSlug || "…"}</span> não fica público.
                    Ative &quot;Publicada&quot; e salve para divulgar.
                  </p>
                )}

                <div className="flex gap-3 justify-end pt-4 mt-2 border-t border-border">
                  <Button
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted"
                    onClick={() => setLpOpen(false)}
                  >
                    Fechar
                  </Button>
                  <Button
                    onClick={handleSaveLp}
                    className="btn-on-emerald bg-emerald-800 hover:bg-emerald-700"
                    style={{ color: "#ffffff" }}
                  >
                    {lpData ? "Salvar Alterações" : "Gerar Página"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
