import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Palette, 
  Globe, 
  Upload, 
  RotateCcw,
  Camera,
  X,
  Check,
  Loader2,
  Type,
  Maximize2,
  Edit3,
  Bold
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/contexts/ThemeContext';
import { usePreview } from '@/contexts/PreviewContext';
import { toast } from 'sonner';

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter', category: 'Sans-serif' },
  { value: 'Roboto', label: 'Roboto', category: 'Sans-serif' },
  { value: 'Open Sans', label: 'Open Sans', category: 'Sans-serif' },
  { value: 'Lato', label: 'Lato', category: 'Sans-serif' },
  { value: 'Montserrat', label: 'Montserrat', category: 'Sans-serif' },
  { value: 'Poppins', label: 'Poppins', category: 'Sans-serif' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro', category: 'Sans-serif' },
  { value: 'Nunito', label: 'Nunito', category: 'Sans-serif' },
  { value: 'Fira Sans', label: 'Fira Sans', category: 'Sans-serif' },
  { value: 'Work Sans', label: 'Work Sans', category: 'Sans-serif' },
  { value: 'Oswald', label: 'Oswald', category: 'Display' },
  { value: 'Raleway', label: 'Raleway', category: 'Display' },
  { value: 'Playfair Display', label: 'Playfair Display', category: 'Serif' },
  { value: 'Merriweather', label: 'Merriweather', category: 'Serif' },
  { value: 'PT Serif', label: 'PT Serif', category: 'Serif' },
  { value: 'Crimson Text', label: 'Crimson Text', category: 'Serif' },
  { value: 'Bebas Neue', label: 'Bebas Neue', category: 'Display' },
  { value: 'Anton', label: 'Anton', category: 'Display' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', category: 'Monospace' },
  { value: 'Fira Code', label: 'Fira Code', category: 'Monospace' },
];

export function ConfigurationsView() {
  const { profile } = useUserProfile();
  const { 
    settings, 
    loading, 
    updating, 
    hasLogo,
    updateSetting, 
    uploadLogo, 
    removeLogo,
    resetToDefaults 
  } = useCompanySettings();
  
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Debug: verificar se o ref está sendo inicializado
  React.useEffect(() => {
    console.log('ConfigurationsView mounted, fileInputRef:', fileInputRef.current);
    console.log('useCompanySettings state:', { settings, loading, updating, hasLogo });
    console.log('useUserProfile state:', { profile });
  }, []);

  // Debug: monitorar mudanças nos estados
  React.useEffect(() => {
    console.log('Estados atualizados:', { 
      settings: settings ? 'loaded' : 'null', 
      loading, 
      updating, 
      hasLogo,
      settingsLogoUrl: settings?.logo_url,
      profileCompanyId: profile?.company_id,
      profileLoaded: !!profile
    });
  }, [settings, loading, updating, hasLogo, profile]);

  // Forçar renderização mesmo com loading se demorar muito
  const [forceRender, setForceRender] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.log('⚠️ Loading demorou muito, forçando renderização');
        setForceRender(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);
  
  const {
    previewName,
    setPreviewName,
    previewSubtitle,
    setPreviewSubtitle,
    previewNameFont,
    setPreviewNameFont,
    previewNameSize,
    setPreviewNameSize,
    previewNameColor,
    setPreviewNameColor,
    previewNameBold,
    setPreviewNameBold,
    previewSubtitleFont,
    setPreviewSubtitleFont,
    previewSubtitleSize,
    setPreviewSubtitleSize,
    previewSubtitleColor,
    setPreviewSubtitleColor,
    previewSubtitleBold,
    setPreviewSubtitleBold,
    previewLogoSize,
    setPreviewLogoSize,
    isPreviewMode,
    setIsPreviewMode,
  } = usePreview();
  
  const [dragOver, setDragOver] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  React.useEffect(() => {
    if (settings) {
      setPreviewName(settings.display_name);
      setPreviewSubtitle(settings.display_subtitle);
      setPreviewNameFont(settings.company_name_font_family);
      setPreviewNameSize(settings.company_name_font_size);
      setPreviewNameColor(settings.company_name_color);
      setPreviewNameBold(settings.company_name_bold);
      setPreviewSubtitleFont(settings.company_subtitle_font_family);
      setPreviewSubtitleSize(settings.company_subtitle_font_size);
      setPreviewSubtitleColor(settings.company_subtitle_color);
      setPreviewSubtitleBold(settings.company_subtitle_bold);
      setPreviewLogoSize(settings.logo_size);
      setHasUnsavedChanges(false);
    }
    
    // Ativar modo preview ao entrar na tela de configurações
    setIsPreviewMode(true);
    
    // Desativar modo preview ao sair da tela
    return () => {
      setIsPreviewMode(false);
    };
  }, [settings, setPreviewName, setPreviewSubtitle, setPreviewNameFont, setPreviewNameSize, setPreviewNameColor, setPreviewNameBold, setPreviewSubtitleFont, setPreviewSubtitleSize, setPreviewSubtitleColor, setPreviewSubtitleBold, setPreviewLogoSize, setIsPreviewMode]);

  React.useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragEnterPage = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeavePage = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDropPage = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('dragenter', handleDragEnterPage);
    document.addEventListener('dragover', preventDefaults);
    document.addEventListener('dragleave', handleDragLeavePage);
    document.addEventListener('drop', handleDropPage);

    return () => {
      document.removeEventListener('dragenter', handleDragEnterPage);
      document.removeEventListener('dragover', preventDefaults);
      document.removeEventListener('dragleave', handleDragLeavePage);
      document.removeEventListener('drop', handleDropPage);
    };
  }, []);

  const handleNameChange = async () => {
    if (previewName !== settings?.display_name) {
      await updateSetting('display_name', previewName);
    }
  };

  const handleSubtitleChange = async () => {
    if (previewSubtitle !== settings?.display_subtitle) {
      await updateSetting('display_subtitle', previewSubtitle);
    }
  };

  const handleNameFontChange = (value: string) => {
    setPreviewNameFont(value);
    setHasUnsavedChanges(true);
  };

  const handleNameSizeChange = (value: number[]) => {
    const size = value[0];
    setPreviewNameSize(size);
    setHasUnsavedChanges(true);
  };

  const handleNameColorChange = (value: string) => {
    setPreviewNameColor(value);
    setHasUnsavedChanges(true);
  };

  const handleNameBoldChange = (value: boolean) => {
    setPreviewNameBold(value);
    setHasUnsavedChanges(true);
  };

  const handleSubtitleFontChange = (value: string) => {
    setPreviewSubtitleFont(value);
    setHasUnsavedChanges(true);
  };

  const handleSubtitleSizeChange = (value: number[]) => {
    const size = value[0];
    setPreviewSubtitleSize(size);
    setHasUnsavedChanges(true);
  };

  const handleSubtitleColorChange = (value: string) => {
    setPreviewSubtitleColor(value);
    setHasUnsavedChanges(true);
  };

  const handleSubtitleBoldChange = (value: boolean) => {
    setPreviewSubtitleBold(value);
    setHasUnsavedChanges(true);
  };

  const handleLogoSizeChange = (value: number[]) => {
    const size = value[0];
    setPreviewLogoSize(size);
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    try {
      if (hasUnsavedChanges) {
        // Salvar alterações pendentes
        await Promise.all([
          updateSetting('company_name_font_family', previewNameFont),
          updateSetting('company_name_font_size', previewNameSize),
          updateSetting('company_name_color', previewNameColor),
          updateSetting('company_name_bold', previewNameBold),
          updateSetting('company_subtitle_font_family', previewSubtitleFont),
          updateSetting('company_subtitle_font_size', previewSubtitleSize),
          updateSetting('company_subtitle_color', previewSubtitleColor),
          updateSetting('company_subtitle_bold', previewSubtitleBold),
          updateSetting('logo_size', previewLogoSize),
        ]);
        setHasUnsavedChanges(false);
        toast.success('✅ Alterações salvas! Atualizando interface...');
      } else {
        // Apenas atualizar interface
        toast.success('✅ Interface atualizada!');
      }
      
      // Refresh automático após salvar
      setTimeout(() => {
        window.location.reload();
      }, 1000); // 1 segundo de delay para mostrar o toast
      
    } catch (error) {
      toast.error('Erro ao salvar alterações');
    }
  };

  const handleFileSelect = async (file: File) => {
    console.log('🔄 handleFileSelect chamado com arquivo:', file.name, file.type, file.size);
    console.log('📤 Chamando uploadLogo...');
    try {
      const result = await uploadLogo(file);
      console.log('✅ uploadLogo resultado:', result);
      if (result) {
        toast.success('✅ Logo atualizado com sucesso!');
      } else {
        toast.error('Erro ao enviar logo');
      }
    } catch (error) {
      console.error('❌ Erro no handleFileSelect:', error);
      toast.error('Erro ao processar arquivo');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    if (updating === 'logo_url') return;
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileSelect(imageFile);
    } else {
      toast.error('Por favor, selecione um arquivo de imagem');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOver(false);
    }
  };

  // Debug: verificar se está sempre em loading
  console.log('🔍 Estado de loading:', loading, 'settings:', !!settings, 'forceRender:', forceRender);

  if (loading && !forceRender) {
    return (
      <div className="min-h-screen bg-theme-primary text-theme-primary p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary-color" />
              <p className="text-theme-secondary">Carregando configurações...</p>
              

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-primary text-theme-primary p-6">


      <div className="max-w-6xl mx-auto space-y-8">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-theme-primary mb-2">
              Configurações
            </h1>
            <p className="text-theme-secondary">
              Personalize a aparência e configurações da sua empresa
            </p>
          </div>
          
          <Button 
            onClick={resetToDefaults}
            variant="outline"
            disabled={updating === 'reset'}
            className="border-theme-primary text-theme-secondary hover:bg-theme-tertiary"
          >
            {updating === 'reset' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Restaurar Padrões
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Coluna Principal - Configurações */}
          <div className="lg:col-span-2 space-y-6">
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-theme-card border-theme-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary-color">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-theme-primary">Empresa</CardTitle>
                        <CardDescription className="text-theme-secondary">
                          Personalize a identidade da sua empresa
                        </CardDescription>
                      </div>
                    </div>
                    
                    {/* Botões para gerenciar logo - usando HTML nativo */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          console.log('📷 BOTÃO HEADER CLICADO!');
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              console.log('📁 Arquivo selecionado via botão header:', file);
                              handleFileSelect(file);
                            }
                          };
                          input.click();
                        }}
                        disabled={updating === 'logo_url'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 12px',
                          border: '1px solid #3B82F6',
                          borderRadius: '6px',
                          background: 'transparent',
                          color: '#3B82F6',
                          cursor: updating === 'logo_url' ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          opacity: updating === 'logo_url' ? 0.5 : 1,
                          transition: 'all 0.2s',
                          zIndex: 999
                        }}
                        onMouseEnter={(e) => {
                          if (updating !== 'logo_url') {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Camera className="h-4 w-4" />
                        {hasLogo ? 'Alterar Logo' : 'Adicionar Logo'}
                      </button>
                      
                      {hasLogo && (
                        <button
                          onClick={() => {
                            console.log('🗑️ BOTÃO REMOVER HEADER CLICADO!');
                            const confirmar = confirm('Tem certeza que deseja remover o logo?');
                            if (confirmar) {
                              removeLogo();
                            }
                          }}
                          disabled={updating === 'logo_url'}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 12px',
                            border: '1px solid #EF4444',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#EF4444',
                            cursor: updating === 'logo_url' ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            opacity: updating === 'logo_url' ? 0.5 : 1,
                            transition: 'all 0.2s',
                            zIndex: 999
                          }}
                          onMouseEnter={(e) => {
                            if (updating !== 'logo_url') {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <X className="h-4 w-4" />
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-theme-primary font-medium">Logo da Empresa</Label>
                    


                    <div
                      className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer ${
                        dragOver
                          ? 'border-primary-color bg-blue-500/10 scale-[1.02] shadow-lg border-blue-400'
                          : 'border-theme-secondary hover:border-primary-color hover:bg-gray-800/50'
                      }`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onClick={(e) => {
                        if (!updating && !hasLogo) {
                          e.preventDefault();
                          console.log('🖱️ Div clicada para upload');
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              console.log('📁 Arquivo selecionado via div:', file);
                              handleFileSelect(file);
                            }
                          };
                          input.click();
                        }
                      }}
                    >
                      {updating === 'logo_url' ? (
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary-color" />
                          <p className="text-theme-secondary">Fazendo upload...</p>
                        </div>
                      ) : hasLogo ? (
                        <div className="text-center">
                          {/* Imagem clicável com overlay hover */}
                          <div 
                            className="relative group cursor-pointer mx-auto mb-3 w-16 h-16"
                            onClick={() => {
                              console.log('🖼️ Imagem clicada - mostrando opções!');
                              
                              // Criar modal simples com opções
                              const escolha = confirm('Escolha uma ação:\n\nOK = Trocar logo\nCancelar = Remover logo');
                              
                              if (escolha) {
                                // Trocar logo
                                console.log('🔄 Usuário escolheu trocar logo');
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) {
                                    console.log('📁 Arquivo selecionado para trocar:', file);
                                    handleFileSelect(file);
                                  }
                                };
                                input.click();
                              } else {
                                // Remover logo
                                console.log('🗑️ Usuário escolheu remover logo');
                                const confirmarRemocao = confirm('Tem certeza que deseja remover o logo?');
                                if (confirmarRemocao) {
                                  removeLogo();
                                }
                              }
                            }}
                          >
                            <img 
                              src={settings?.logo_url} 
                              alt="Logo da empresa"
                              className="h-16 w-16 object-contain rounded transition-opacity group-hover:opacity-75"
                            />
                            {/* Overlay com ícone de câmera no hover */}
                            <div className="absolute inset-0 bg-black bg-opacity-50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Camera className="h-6 w-6 text-white" />
                            </div>
                            {/* Indicação de que é clicável */}
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Edit3 className="h-3 w-3 text-white" />
                            </div>
                          </div>
                          
                          {/* Texto explicativo */}
                          <p className="text-xs text-theme-secondary mb-3">
                            Clique na imagem para alterar ou remover
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className={`h-8 w-8 mx-auto mb-3 transition-colors ${
                            dragOver ? 'text-blue-400' : 'text-theme-secondary'
                          }`} />
                          <p className={`font-medium mb-1 transition-colors ${
                            dragOver ? 'text-blue-400' : 'text-theme-primary'
                          }`}>
                            {dragOver ? 'Solte a imagem aqui!' : 'Clique ou arraste uma imagem'}
                          </p>
                          <p className="text-theme-secondary text-sm">
                            PNG, JPG ou SVG até 2MB
                          </p>
                          {!dragOver && (
                            <>
                              <Button
                                className="mt-3 bg-primary-color hover:bg-primary-color-hover"
                                onClick={() => {
                                  console.log('🔵 Botão principal clicado!');
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      console.log('📁 Arquivo selecionado via botão principal:', file);
                                      handleFileSelect(file);
                                    }
                                  };
                                  input.click();
                                }}
                                disabled={updating === 'logo_url'}
                              >
                                Selecionar Arquivo
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          console.log('Input file onChange triggered, files:', e.target.files);
                          const file = e.target.files?.[0];
                          if (file) {
                            console.log('Arquivo selecionado:', file.name, file.type, file.size);
                            handleFileSelect(file);
                          }
                          // Reset input para permitir selecionar o mesmo arquivo novamente
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>

                  <Separator className="bg-theme-secondary" />

                  <div className="space-y-2">
                    <Label htmlFor="company-name" className="text-theme-primary font-medium">
                      Nome da Empresa
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="company-name"
                        value={previewName}
                        onChange={(e) => setPreviewName(e.target.value)}
                        onBlur={handleNameChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleNameChange()}
                        disabled={updating === 'display_name'}
                        className="bg-theme-tertiary border-theme-primary text-theme-primary"
                        placeholder="Nome da sua empresa"
                      />
                      {updating === 'display_name' && (
                        <Button size="icon" disabled>
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company-subtitle" className="text-theme-primary font-medium">
                      Subtítulo
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="company-subtitle"
                        value={previewSubtitle}
                        onChange={(e) => setPreviewSubtitle(e.target.value)}
                        onBlur={handleSubtitleChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubtitleChange()}
                        disabled={updating === 'display_subtitle'}
                        className="bg-theme-tertiary border-theme-primary text-theme-primary"
                        placeholder="Descrição da sua empresa"
                      />
                      {updating === 'display_subtitle' && (
                        <Button size="icon" disabled>
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>



          </div>

          {/* Coluna Lateral - Preview Moderno e Fixo */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
                  <CardHeader className="relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                        <CardTitle className="text-white font-semibold">Preview & Edição</CardTitle>
                      </div>
                      <div className="px-2 py-1 bg-blue-500/20 rounded-full">
                        <span className="text-xs text-blue-300 font-medium">TEMPO REAL</span>
                      </div>
                    </div>
                    <CardDescription className="text-slate-400">
                      Visualize e edite em tempo real
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="relative space-y-6">
                    {/* Preview da Sidebar com Controles */}
                    <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border border-slate-600/50 shadow-inner space-y-4">
                      {/* Logo Section */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Maximize2 className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-slate-300 font-medium">Logo</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {settings?.logo_url ? (
                            <img 
                              src={settings.logo_url} 
                              alt="Logo preview"
                              style={{ 
                                height: `${previewLogoSize}px`, 
                                width: `${previewLogoSize}px` 
                              }}
                              className="rounded-lg object-contain shadow-md"
                            />
                          ) : (
                            <div 
                              style={{ 
                                height: `${previewLogoSize}px`, 
                                width: `${previewLogoSize}px`,
                                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
                              }}
                              className="rounded-lg flex items-center justify-center text-white shadow-md"
                            >
                              <Building2 className="h-5 w-5" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-400">Tamanho</Label>
                              <Slider
                                value={[previewLogoSize]}
                                onValueChange={handleLogoSizeChange}
                                min={32}
                                max={80}
                                step={4}
                                className="flex-1"
                                disabled={updating === 'logo_size'}
                              />
                              <span className="text-xs text-slate-400">{previewLogoSize}px</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-600/30 my-4"></div>

                      {/* Nome Section */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Edit3 className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-slate-300 font-medium">Nome da Empresa</span>
                        </div>
                        
                        {/* Nome Preview e Input */}
                        <Input
                          value={previewName}
                          onChange={(e) => setPreviewName(e.target.value)}
                          onBlur={handleNameChange}
                          placeholder="Nome da empresa"
                          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                          style={{ 
                            fontFamily: previewNameFont,
                            fontSize: `${Math.min(previewNameSize, 16)}px`,
                            color: previewNameColor,
                            fontWeight: previewNameBold ? 'bold' : 'normal'
                          }}
                        />
                        
                        {/* Controles do Nome */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Fonte</Label>
                            <Select
                              value={previewNameFont}
                              onValueChange={handleNameFontChange}
                            >
                              <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white text-xs h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-600">
                                {FONT_OPTIONS.slice(0, 10).map((font) => (
                                  <SelectItem key={font.value} value={font.value} className="text-xs">
                                    {font.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Tamanho</Label>
                            <Slider
                              value={[previewNameSize]}
                              onValueChange={handleNameSizeChange}
                              min={14}
                              max={32}
                              step={1}
                              className="mt-2"
                            />
                            <span className="text-xs text-slate-400">{previewNameSize}px</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Cor</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={previewNameColor}
                                onChange={(e) => handleNameColorChange(e.target.value)}
                                className="w-8 h-8 rounded border border-slate-600 cursor-pointer"
                              />
                              <Input
                                value={previewNameColor}
                                onChange={(e) => handleNameColorChange(e.target.value)}
                                className="bg-slate-700/50 border-slate-600 text-white text-xs h-8 font-mono"
                                placeholder="#FFFFFF"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Negrito</Label>
                            <div className="flex items-center h-8">
                              <Switch
                                checked={previewNameBold}
                                onCheckedChange={handleNameBoldChange}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-600/30 my-4"></div>

                      {/* Subtítulo Section */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Edit3 className="h-4 w-4 text-orange-400" />
                          <span className="text-sm text-slate-300 font-medium">Subtítulo</span>
                        </div>
                        
                        {/* Subtítulo Preview e Input */}
                        <Input
                          value={previewSubtitle}
                          onChange={(e) => setPreviewSubtitle(e.target.value)}
                          onBlur={handleSubtitleChange}
                          placeholder="Subtítulo da empresa"
                          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                          style={{ 
                            fontFamily: previewSubtitleFont,
                            fontSize: `${Math.min(previewSubtitleSize, 14)}px`,
                            color: previewSubtitleColor,
                            fontWeight: previewSubtitleBold ? 'bold' : 'normal'
                          }}
                        />
                        
                        {/* Controles do Subtítulo */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Fonte</Label>
                            <Select
                              value={previewSubtitleFont}
                              onValueChange={handleSubtitleFontChange}
                            >
                              <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white text-xs h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-600">
                                {FONT_OPTIONS.slice(0, 10).map((font) => (
                                  <SelectItem key={font.value} value={font.value} className="text-xs">
                                    {font.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Tamanho</Label>
                            <Slider
                              value={[previewSubtitleSize]}
                              onValueChange={handleSubtitleSizeChange}
                              min={10}
                              max={20}
                              step={1}
                              className="mt-2"
                            />
                            <span className="text-xs text-slate-400">{previewSubtitleSize}px</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Cor</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={previewSubtitleColor}
                                onChange={(e) => handleSubtitleColorChange(e.target.value)}
                                className="w-8 h-8 rounded border border-slate-600 cursor-pointer"
                              />
                              <Input
                                value={previewSubtitleColor}
                                onChange={(e) => handleSubtitleColorChange(e.target.value)}
                                className="bg-slate-700/50 border-slate-600 text-white text-xs h-8 font-mono"
                                placeholder="#9CA3AF"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Negrito</Label>
                            <div className="flex items-center h-8">
                              <Switch
                                checked={previewSubtitleBold}
                                onCheckedChange={handleSubtitleBoldChange}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botão Salvar */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="pt-4 border-t border-slate-600/50"
                    >
                      <Button
                        onClick={handleSaveChanges}
                        disabled={updating !== null}
                        className={`w-full text-white shadow-lg transition-all duration-300 ${
                          hasUnsavedChanges 
                            ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 shadow-green-500/25' 
                            : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-blue-500/25'
                        }`}
                        size="lg"
                      >
                        {updating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            {hasUnsavedChanges ? 'Salvar Alterações' : 'Atualizar Interface'}
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Botão Salvar Mobile */}
        <div className="lg:hidden mt-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="max-w-md mx-auto"
          >
            <Button
              onClick={handleSaveChanges}
              disabled={updating !== null}
              className={`w-full text-white ${
                hasUnsavedChanges 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              size="lg"
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {hasUnsavedChanges ? 'Salvar Alterações' : 'Atualizar Interface'}
                </>
              )}
            </Button>
          </motion.div>
        </div>

      </div>
    </div>
  );
}