import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Paperclip,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ChatTemplate, ChatTemplateCreateInput } from '@/hooks/useChatTemplates';
import type { ChatMediaItemType } from '@/lib/chatMediaFiles';
import { normalizeAttachmentForChat } from '@/lib/chatMediaFiles';
import { TEMPLATE_MEDIA_ACCEPT, templateMediaLabel } from '@/lib/chatTemplateMedia';
import { uploadChatMediaAndGetPublicUrl } from '@/lib/uploadChatMedia';
import { useToast } from '@/hooks/use-toast';

type PendingMedia = {
  url: string;
  type: ChatMediaItemType;
  mimeType: string;
  name: string;
  previewUrl?: string;
};

type ManageChatTemplatesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  templates: ChatTemplate[];
  loading?: boolean;
  onAdd: (input: ChatTemplateCreateInput) => Promise<{ success: boolean } | void>;
  onDelete: (id: string) => void;
};

function TemplateMediaThumb({
  type,
  url,
  name,
  className,
}: {
  type?: string | null;
  url?: string | null;
  name?: string | null;
  className?: string;
}) {
  if (!url) return null;
  if (type === 'imagem') {
    return (
      <img
        src={url}
        alt={name || 'Mídia do template'}
        className={cn('h-14 w-14 rounded-lg object-cover border border-[var(--cv-border)]', className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--cv-border)] bg-[var(--cv-hover)]',
        className,
      )}
    >
      <FileText className="h-6 w-6 text-[var(--cv-icon)]" />
    </div>
  );
}

export function ManageChatTemplatesModal({
  open,
  onOpenChange,
  companyId,
  templates,
  loading = false,
  onAdd,
  onDelete,
}: ManageChatTemplatesModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [isOfficialApi, setIsOfficialApi] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setShortcut('');
    setMessage('');
    setIsOfficialApi(false);
    if (pendingMedia?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(pendingMedia.previewUrl);
    }
    setPendingMedia(null);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open]);

  const handleMediaPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !companyId) return;

    setUploadingMedia(true);
    try {
      const { file: normalized, type } = await normalizeAttachmentForChat(file, 'whatsapp');
      const url = await uploadChatMediaAndGetPublicUrl(normalized, 'whatsapp', type, companyId);
      const previewUrl = type === 'imagem' ? url : URL.createObjectURL(normalized);
      if (pendingMedia?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(pendingMedia.previewUrl);
      }
      setPendingMedia({
        url,
        type,
        mimeType: normalized.type || file.type,
        name: file.name,
        previewUrl,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar mídia';
      toast({ title: 'Erro no upload', description: msg, variant: 'destructive' });
    } finally {
      setUploadingMedia(false);
    }
  };

  const clearPendingMedia = () => {
    if (pendingMedia?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(pendingMedia.previewUrl);
    }
    setPendingMedia(null);
  };

  const handleAdd = async () => {
    const s = shortcut.trim();
    const m = message.trim();
    if (!s || (!m && !pendingMedia)) return;

    setSubmitting(true);
    try {
      const result = await onAdd({
        shortcut: s,
        message: m,
        isOfficialApi,
        media: pendingMedia
          ? {
              url: pendingMedia.url,
              type: pendingMedia.type,
              mimeType: pendingMedia.mimeType,
              name: pendingMedia.name,
            }
          : null,
      });
      if (result?.success !== false) {
        resetForm();
        toast({ title: 'Template salvo', description: `Atalho /${s.replace(/^\//, '')} criado.` });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const shortcutNorm = shortcut.trim().replace(/^\//, '');
  const canSave =
    shortcutNorm.length > 0 &&
    (message.trim().length > 0 || Boolean(pendingMedia)) &&
    !submitting &&
    !uploadingMedia;

  const formDirty =
    shortcutNorm.length > 0 ||
    message.trim().length > 0 ||
    Boolean(pendingMedia) ||
    isOfficialApi;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.button
            type="button"
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-labelledby="manage-templates-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'relative z-10 flex w-full max-w-2xl flex-col overflow-hidden',
              'h-[min(92vh,820px)] rounded-2xl border border-[var(--cv-border)]',
              'bg-[var(--cv-shell)] shadow-2xl shadow-black/45',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="shrink-0 flex items-start justify-between gap-3 border-b border-[var(--cv-border)] bg-[var(--cv-panel)] px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cv-accent)]/15 ring-1 ring-[var(--cv-accent)]/25"
                  aria-hidden
                >
                  <MessageSquareText className="h-5 w-5 text-[var(--cv-accent)]" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="manage-templates-title"
                    className="text-base font-semibold tracking-tight text-[var(--cv-text)]"
                  >
                    Mensagens rápidas
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--cv-text-muted)]">
                    Crie atalhos, anexe mídia e marque templates da API Oficial.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-lg text-[var(--cv-icon)] hover:bg-[var(--cv-hover)]"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </header>

            {/* Formulário — fixo no topo, não rola */}
            <div className="shrink-0 border-b border-[var(--cv-border)] bg-[var(--cv-panel)]/40 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--cv-text)]">Novo template</h3>
                {formDirty ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex items-center gap-1 text-xs text-[var(--cv-text-muted)] hover:text-[var(--cv-text)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Limpar
                  </button>
                ) : null}
              </div>

              <div className="rounded-xl border border-[var(--cv-border)] bg-[var(--cv-shell)] p-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-[140px_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-shortcut" className="text-[11px] font-medium uppercase tracking-wide text-[var(--cv-text-muted)]">
                      Atalho *
                    </Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[var(--cv-accent)]">
                        /
                      </span>
                      <Input
                        id="tpl-shortcut"
                        placeholder="template"
                        value={shortcut.replace(/^\//, '')}
                        onChange={(e) => setShortcut(e.target.value.replace(/^\//, ''))}
                        className="h-11 rounded-xl border-[var(--cv-border)] bg-[var(--cv-input-bg)] pl-7 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-message" className="text-[11px] font-medium uppercase tracking-wide text-[var(--cv-text-muted)]">
                      Mensagem {pendingMedia ? '(legenda)' : '*'}
                    </Label>
                    <Textarea
                      id="tpl-message"
                      placeholder="Texto do template ou legenda da mídia…"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      className="min-h-[72px] resize-none rounded-xl border-[var(--cv-border)] bg-[var(--cv-input-bg)]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Mídia */}
                  <div className="rounded-xl border border-[var(--cv-border)] bg-[var(--cv-search-bg)]/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--cv-text)]">
                        <Paperclip className="h-3.5 w-3.5" />
                        Mídia
                      </span>
                      {pendingMedia ? (
                        <button
                          type="button"
                          onClick={clearPendingMedia}
                          className="text-[10px] font-medium text-red-400 hover:text-red-300"
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept={TEMPLATE_MEDIA_ACCEPT}
                      onChange={(e) => void handleMediaPick(e)}
                    />
                    {pendingMedia ? (
                      <div className="flex items-center gap-2.5 rounded-lg bg-[var(--cv-panel)] p-2">
                        {pendingMedia.type === 'imagem' ? (
                          <img
                            src={pendingMedia.previewUrl || pendingMedia.url}
                            alt=""
                            className="h-12 w-12 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--cv-hover)]">
                            <FileText className="h-5 w-5 text-[var(--cv-icon)]" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{pendingMedia.name}</p>
                          <p className="text-[10px] text-[var(--cv-text-muted)]">
                            {templateMediaLabel(pendingMedia.type)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={uploadingMedia || !companyId}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--cv-border)] py-4 text-xs text-[var(--cv-text-muted)] hover:border-[var(--cv-accent)]/40 hover:bg-[var(--cv-hover)]/30 disabled:opacity-50"
                      >
                        {uploadingMedia ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--cv-accent)]" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                        Anexar arquivo
                      </button>
                    )}
                  </div>

                  {/* API Oficial */}
                  <div
                    className={cn(
                      'rounded-xl border p-3 transition-all',
                      isOfficialApi
                        ? 'border-[var(--cv-accent)]/45 bg-[var(--cv-accent)]/8'
                        : 'border-[var(--cv-border)] bg-[var(--cv-search-bg)]/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isOfficialApi ? 'text-[var(--cv-accent)]' : 'text-[var(--cv-icon)]',
                          )}
                        />
                        <span className="text-xs font-semibold text-[var(--cv-text)]">API Oficial</span>
                        {isOfficialApi ? (
                          <Badge className="h-4 border-0 bg-[var(--cv-accent)] px-1.5 text-[9px] text-[var(--cv-tab-active-text)]">
                            ON
                          </Badge>
                        ) : null}
                      </div>
                      <Switch
                        id="tpl-official"
                        checked={isOfficialApi}
                        onCheckedChange={setIsOfficialApi}
                        className="scale-90 data-[state=checked]:bg-[var(--cv-accent)]"
                      />
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-[var(--cv-text-muted)]">
                      Envio fora da janela 24h. Webhook com{' '}
                      <span className="font-mono text-[var(--cv-accent)]">tag: api_oficial</span>.
                      Texto bloqueado no chat.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de salvar — sempre visível */}
            <div className="shrink-0 border-b border-[var(--cv-border)] bg-[var(--cv-panel)] px-5 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
              <div className="mb-2 flex flex-wrap items-center gap-1.5 min-h-[20px]">
                {shortcutNorm ? (
                  <Badge variant="outline" className="font-mono text-[10px] border-[var(--cv-accent)]/30 text-[var(--cv-accent)]">
                    /{shortcutNorm}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-[var(--cv-text-muted)]">Preencha atalho + mensagem ou mídia</span>
                )}
                {isOfficialApi ? (
                  <Badge className="h-4 gap-0.5 border-0 bg-[var(--cv-accent)]/20 px-1.5 text-[9px] text-[var(--cv-accent)]">
                    <Zap className="h-2.5 w-2.5" />
                    API Oficial
                  </Badge>
                ) : null}
                {pendingMedia ? (
                  <Badge variant="outline" className="text-[9px] text-[var(--cv-text-muted)]">
                    {templateMediaLabel(pendingMedia.type)}
                  </Badge>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="h-11 shrink-0 rounded-xl px-4 text-[var(--cv-text-muted)] hover:bg-[var(--cv-hover)]"
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  disabled={!canSave || loading}
                  onClick={() => void handleAdd()}
                  className={cn(
                    'h-11 flex-1 rounded-xl text-base font-semibold shadow-md transition-all',
                    'bg-[var(--cv-accent)] text-[var(--cv-tab-active-text)] hover:bg-[var(--cv-accent-hover)]',
                    'disabled:opacity-40 disabled:shadow-none',
                  )}
                >
                  {submitting || loading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  Salvar template
                </Button>
              </div>
              {!canSave && shortcutNorm ? (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-500/90">
                  <AlertCircle className="h-3 w-3" />
                  Adicione mensagem ou mídia para salvar.
                </p>
              ) : null}
            </div>

            {/* Lista — só esta parte rola */}
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--cv-text)]">Templates salvos</h3>
                <span className="rounded-full bg-[var(--cv-search-bg)] px-2.5 py-0.5 text-[11px] tabular-nums text-[var(--cv-text-muted)]">
                  {templates.length}
                </span>
              </div>

              {loading && templates.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-[var(--cv-text-muted)]">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--cv-accent)]" />
                  <span className="text-sm">Carregando…</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--cv-border)] px-6 py-10 text-center">
                  <MessageSquareText className="mx-auto mb-2 h-8 w-8 text-[var(--cv-icon)]" />
                  <p className="text-sm text-[var(--cv-text-muted)]">Nenhum template ainda.</p>
                  <p className="mt-1 text-xs text-[var(--cv-text-muted)]">
                    Use o formulário acima e clique em <strong className="text-[var(--cv-text)]">Salvar template</strong>.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2 pb-2">
                  {templates.map((t) => (
                    <li
                      key={t.id}
                      className="group flex gap-3 rounded-xl border border-[var(--cv-border)] bg-[var(--cv-panel)]/50 p-3 hover:border-[var(--cv-accent)]/20 hover:bg-[var(--cv-hover)]/30"
                    >
                      {t.media_url ? (
                        <TemplateMediaThumb type={t.media_type} url={t.media_url} name={t.media_name} />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--cv-accent)]/12 font-mono text-sm font-bold text-[var(--cv-accent)]">
                          {t.shortcut.startsWith('/') ? t.shortcut.slice(0, 2) : t.shortcut.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-xs text-[var(--cv-accent)]">
                            {t.shortcut}
                          </Badge>
                          {t.is_official_api ? (
                            <Badge className="h-4 gap-0.5 border-0 bg-[var(--cv-accent)]/15 text-[9px] text-[var(--cv-accent)]">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              API Oficial
                            </Badge>
                          ) : null}
                          {t.media_type ? (
                            <Badge variant="outline" className="text-[9px] text-[var(--cv-text-muted)]">
                              {templateMediaLabel(t.media_type)}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-[var(--cv-text-muted)] line-clamp-2">
                          {t.message?.trim() || 'Somente mídia'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-[var(--cv-text-muted)] hover:bg-red-500/15 hover:text-red-400"
                        onClick={() => onDelete(t.id)}
                        aria-label={`Excluir ${t.shortcut}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
