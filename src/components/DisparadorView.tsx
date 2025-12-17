import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Upload, Send, FileDown, Settings, Zap, List, Shuffle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit/logger';
import { ConfigurationsView, ConfigurationForm } from '@/components/dispatch';
import { DispatchConfiguration } from '@/lib/dispatch/types';
import { useDispatchConfigurations } from '@/hooks/useDispatchConfigurations';
import { resolveMessageTemplate, estimateDispatchDuration } from '@/lib/dispatch/utils';
import { DispatchService, DispatchRow } from '@/services/dispatchService';

type UploadRow = { nome: string; telefone: string; email?: string };

function parseCSV(content: string): UploadRow[] {
  const rows: UploadRow[] = [];
  // normalizar quebras de linha
  const lines = content.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return rows;
  const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headersRaw = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const idxNome = headersRaw.findIndex(h => ['nome','name'].includes(h));
  const idxTelefone = headersRaw.findIndex(h => ['telefone','phone','celular','whatsapp'].includes(h));
  const idxEmail = headersRaw.findIndex(h => ['email','e-mail'].includes(h));
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.replace(/^\"|\"$/g, '').trim());
    const nome = idxNome >= 0 ? (cols[idxNome] || '') : '';
    const telefone = idxTelefone >= 0 ? (cols[idxTelefone] || '') : '';
    const email = idxEmail >= 0 ? (cols[idxEmail] || '') : '';
    if (nome || telefone || email) rows.push({ nome, telefone, email });
  }
  return rows;
}

export function DisparadorView() {
  const { profile } = useUserProfile();
  const { instances, loadChats, createChat, sendMessage, loading } = useWhatsAppInstances();
  const { getDefaultConfiguration, getConfigurationById, getActiveConfigurations } = useDispatchConfigurations();

  // Estados do envio manual
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [message, setMessage] = useState<string>('Olá {nome}, tudo bem?');
  const [sending, setSending] = useState<boolean>(false);
  const [sentCount, setSentCount] = useState<number>(0);
  const [errorLog, setErrorLog] = useState<string[]>([]);

  // Estados das configurações
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [isConfigFormOpen, setIsConfigFormOpen] = useState(false);
  const [configToEdit, setConfigToEdit] = useState<DispatchConfiguration | null>(null);
  const [activeTab, setActiveTab] = useState<'envio' | 'configuracoes'>('envio');
  // Filtro por estágio do lead (CRM)
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string>('');
  const [loadingLeads, setLoadingLeads] = useState<boolean>(false);

  const canSend = useMemo(() => Boolean(selectedInstance && rows.length > 0 && message.trim().length > 0), [selectedInstance, rows, message]);

  // Carregar configuração padrão ao montar o componente
  useEffect(() => {
    const defaultConfig = getDefaultConfiguration();
    if (defaultConfig && !selectedConfigId) {
      setSelectedConfigId(defaultConfig.id);
      applyConfiguration(defaultConfig.id);
    }
  }, [getDefaultConfiguration, selectedConfigId]);

  // Carregar estágios de leads (distintos) para filtro
  useEffect(() => {
    const loadStages = async () => {
      try {
        if (!profile?.company_id) return;
        const { data, error } = await supabase
          .from('leads')
          .select('stage')
          .eq('company_id', profile.company_id)
          .not('stage', 'is', null);
        if (error) throw error;
        const unique = Array.from(new Set((data || []).map((r: any) => (r.stage as string).trim()).filter(Boolean)));
        unique.sort();
        setStageOptions(unique);
      } catch (e) {
        console.warn('Falha ao carregar estágios de leads:', e);
      }
    };
    loadStages();
  }, [profile?.company_id]);

  const handleDownloadTemplate = () => {
    const csv = 'nome,telefone,email\nJoão Silva,55999998888,joao@exemplo.com\nMaria Souza,55911112222,maria@exemplo.com\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-disparador.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    try {
      setFileName(file.name);
      const text = await file.text();
      const parsed = parseCSV(text);
      setRows(parsed);
    } catch (e: any) {
      setErrorLog(prev => [...prev, `Falha ao ler arquivo: ${e?.message || e}`]);
    }
  };

  const resolveTemplate = (tpl: string, row: UploadRow) => {
    return resolveMessageTemplate(tpl, {
      nome: row.nome || '',
      telefone: row.telefone || '',
      email: row.email || ''
    });
  };

  // Aplicar configuração selecionada
  const applyConfiguration = (configId: string) => {
    if (!configId) return;
    
    const config = getConfigurationById(configId);
    if (!config) return;

    // Aplicar template de mensagem
    setMessage(config.messageTemplate);
    
    // Filtrar instâncias baseado nos corretores da configuração
    if (config.assignedBrokers.length > 0) {
      const brokerInstances = instances.filter(instance => 
        config.assignedBrokers.includes(instance.user_id)
      );
      
      // Selecionar primeira instância ativa se disponível
      const activeInstance = brokerInstances.find(i => i.status === 'connected');
      if (activeInstance) {
        setSelectedInstance(activeInstance.id);
      }
    }
  };

  // Handlers para configurações
  const handleConfigurationSelect = (config: DispatchConfiguration) => {
    setSelectedConfigId(config.id);
    applyConfiguration(config.id);
    setActiveTab('envio');
  };

  const handleCreateConfiguration = () => {
    setConfigToEdit(null);
    setIsConfigFormOpen(true);
  };

  const handleEditConfiguration = (config: DispatchConfiguration) => {
    setConfigToEdit(config);
    setIsConfigFormOpen(true);
  };

  const handleConfigurationSuccess = (config: DispatchConfiguration) => {
    // Aplicar a configuração recém criada/editada
    setSelectedConfigId(config.id);
    applyConfiguration(config.id);
    setActiveTab('envio');
  };

  // Alternar para próxima configuração ativa (roleta)
  const spinConfiguration = () => {
    const active = getActiveConfigurations();
    if (!active || active.length === 0) return;
    if (!selectedConfigId) {
      setSelectedConfigId(active[0].id);
      applyConfiguration(active[0].id);
      return;
    }
    const currentIndex = active.findIndex(c => c.id === selectedConfigId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % active.length : 0;
    const next = active[nextIndex];
    setSelectedConfigId(next.id);
    applyConfiguration(next.id);
  };

  // Carregar leads do CRM por estágio selecionado
  const loadLeadsByStage = async () => {
    if (!stageFilter || !profile?.company_id) return;
    setLoadingLeads(true);
    setErrorLog([]);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('name, phone, email')
        .eq('company_id', profile.company_id)
        .eq('stage', stageFilter);
      if (error) throw error;
      const mapped: UploadRow[] = (data || []).map((l: any) => ({
        nome: l.name || '',
        telefone: l.phone || '',
        email: l.email || ''
      }));
      setRows(mapped);
      setFileName(`Leads CRM (${stageFilter})`);
    } catch (e: any) {
      setErrorLog(prev => [...prev, `Erro ao carregar leads do CRM: ${e?.message || e}`]);
    } finally {
      setLoadingLeads(false);
    }
  };

  const startSending = async () => {
    if (!canSend) return;
    setSending(true);
    setSentCount(0);
    setErrorLog([]);
    
    try {
      // Obter configuração aplicada se houver
      const appliedConfig = selectedConfigId ? getConfigurationById(selectedConfigId) : undefined;
      
      // Validar configuração se aplicada
      if (appliedConfig) {
        const validation = DispatchService.validateConfiguration(appliedConfig, instances);
        if (!validation.isValid) {
          setErrorLog(validation.errors);
          return;
        }
      }

      // Preparar contexto para o serviço
      const dispatchContext = {
        configuration: appliedConfig,
        instances,
        sendMessage,
        createChat,
        loadChats
      };

      // Converter rows para formato do serviço
      const dispatchRows: DispatchRow[] = rows.map(row => ({
        nome: row.nome,
        telefone: row.telefone,
        email: row.email
      }));

      // Se não há configuração aplicada, usar envio simples com instância selecionada
      if (!appliedConfig && selectedInstance) {
        // Forçar uso da instância selecionada
        dispatchContext.instances = instances.filter(i => i.id === selectedInstance);
      }

      // Executar envio usando o serviço
      const result = await DispatchService.executeBulkDispatch(
        dispatchRows,
        dispatchContext,
        (sent, total) => {
          setSentCount(sent);
        },
        (error) => {
          setErrorLog(prev => [...prev, error]);
        }
      );

      // Atualizar estado final
      setSentCount(result.totalSent);
      if (result.errors.length > 0) {
        setErrorLog(prev => [...prev, ...result.errors]);
      }

    } catch (error: any) {
      console.error('Erro no envio:', error);
      setErrorLog(prev => [...prev, `Erro geral: ${error?.message || error}`]);
    } finally {
      setSending(false);
    }
  };

  const selectedConfig = selectedConfigId ? getConfigurationById(selectedConfigId) : null;

  return (
    <div className="space-y-6 p-6 min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Disparador WhatsApp</h1>
        <p className="text-gray-400">Envie mensagens em massa usando configurações pré-definidas ou modo manual.</p>
        
        {/* Aviso de Módulo em Testes */}
        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
            <span className="text-amber-400 font-semibold text-sm uppercase tracking-wide">
              Módulo em Fase de Testes
            </span>
          </div>
          <p className="text-amber-200/80 text-sm mt-1">
            Este módulo está passando por otimizações e será aprimorado na próxima atualização do sistema.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'envio' | 'configuracoes')}>
        <TabsList className="bg-gray-800/50 border-gray-700">
          <TabsTrigger value="envio" className="data-[state=active]:bg-emerald-600">
            <Zap className="w-4 h-4 mr-2" />
            Envio
            {selectedConfig && (
              <Badge variant="outline" className="ml-2 bg-emerald-500/20 text-emerald-300 border-emerald-400/50">
                {selectedConfig.name}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="data-[state=active]:bg-blue-600">
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="envio">
          <Card className="bg-gray-800/50 border-gray-700/60">
            <CardContent className="p-6 space-y-6">
              
              {/* Seletor de configuração */}
              {selectedConfig && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300 font-medium">Configuração Aplicada:</span>
                      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-400/50">
                        {selectedConfig.name}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('configuracoes')}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <List className="w-4 h-4 mr-1" />
                      Trocar
                    </Button>
                  </div>
                  {selectedConfig.description && (
                    <p className="text-sm text-emerald-200/80">{selectedConfig.description}</p>
                  )}
                </div>
              )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Instância WhatsApp</Label>
              <div className="flex items-center gap-2">
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-gray-200">
                    <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione a instância'} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 text-gray-200 border-gray-700">
                    {instances.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.instance_name} — {i.status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={spinConfiguration}
                  className="border-emerald-500/50 text-emerald-300"
                  title="Roletar configurações ativas"
                >
                  <Shuffle className="w-4 h-4 mr-1" />
                  Roleta
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Leads do CRM por Estágio (opcional)</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-gray-200">
                    <SelectValue placeholder={stageOptions.length ? 'Selecione o estágio' : 'Carregando estágios...'} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 text-gray-200 border-gray-700 max-h-64">
                    {stageOptions.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadLeadsByStage}
                  disabled={!stageFilter || loadingLeads}
                  className="border-emerald-500/50 text-emerald-300"
                >
                  {loadingLeads ? 'Carregando...' : 'Carregar leads'}
                </Button>
                <div className="text-xs text-gray-400">{rows.length > 0 && fileName.startsWith('Leads CRM') ? `${rows.length} leads carregados` : ''}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Planilha (.csv) com nome, telefone, email</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  className="bg-gray-900/50 border-blue-500/50 text-blue-300 placeholder:text-blue-300 file:text-blue-300 file:bg-gray-800 file:border-blue-500/50 file:rounded-md file:px-3 file:py-1.5 file:hover:bg-gray-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="border-blue-500/50 text-blue-300 font-medium"
                >
                  <FileDown className="h-4 w-4 mr-2" /> Baixar modelo
                </Button>
              </div>
              {fileName && <p className="text-xs text-gray-400">Arquivo: {fileName} — {rows.length} linhas</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Mensagem (suporta variáveis {`{nome}`}, {`{telefone}`}, {`{email}`})</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="bg-gray-900/50 border-gray-700 text-gray-200 min-h-[120px]" />
          </div>

          {/* Informações sobre envio e configuração */}
          {rows.length > 0 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-300">Informações do Envio:</span>
                {selectedConfig && (
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/50">
                    Config: {selectedConfig.name}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-blue-200">Total:</span>
                  <span className="ml-1 text-white font-medium">{rows.length} mensagens</span>
                </div>
                <div>
                  <span className="text-blue-200">Intervalo:</span>
                  <span className="ml-1 text-white font-medium">
                    {selectedConfig?.intervalBetweenMessages || 150}ms
                  </span>
                </div>
                <div>
                  <span className="text-blue-200">Tempo est.:</span>
                  <span className="ml-1 text-white font-medium">
                    {Math.ceil(estimateDispatchDuration(
                      rows.length, 
                      selectedConfig?.intervalBetweenMessages || 150,
                      selectedConfig?.assignedBrokers.length || 1
                    ))} min
                  </span>
                </div>
                <div>
                  <span className="text-blue-200">Corretores:</span>
                  <span className="ml-1 text-white font-medium">
                    {selectedConfig?.assignedBrokers.length || 1}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={startSending} disabled={!canSend || sending} className="bg-gradient-to-r from-blue-600 to-purple-600">
              {sending ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" /> Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Enviar em massa
                </>
              )}
            </Button>
            <p className="text-sm text-gray-400">Enviados: {sentCount} / {rows.length}</p>
          </div>

          {rows.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-400 mb-2">Pré-visualização (primeiras 10 linhas):</p>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-300">
                <strong>Nome</strong>
                <strong>Telefone</strong>
                <strong>Email</strong>
                {rows.slice(0, 10).map((r, idx) => (
                  <React.Fragment key={idx}>
                    <span className="truncate">{r.nome}</span>
                    <span className="truncate">{r.telefone}</span>
                    <span className="truncate">{r.email}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

              {errorLog.length > 0 && (
                <div className="bg-red-900/20 border border-red-700/40 rounded p-3 text-sm text-red-300">
                  {errorLog.slice(0, 10).map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                  {errorLog.length > 10 && <div>... e mais {errorLog.length - 10} erros</div>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes">
          <ConfigurationsView
            onCreateNew={handleCreateConfiguration}
            onEdit={handleEditConfiguration}
            onSelect={handleConfigurationSelect}
            selectedConfigId={selectedConfigId}
          />
        </TabsContent>
      </Tabs>

      {/* Modal do formulário de configuração */}
      <ConfigurationForm
        isOpen={isConfigFormOpen}
        onClose={() => setIsConfigFormOpen(false)}
        configurationToEdit={configToEdit}
        onSuccess={handleConfigurationSuccess}
      />
    </div>
  );
}

export default DisparadorView;


