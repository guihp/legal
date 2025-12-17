import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Eye, 
  EyeOff, 
  Copy,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { 
  extractTemplateVariables, 
  validateMessageTemplate, 
  resolveMessageTemplate 
} from '@/lib/dispatch/utils';

interface MessageTemplateEditorProps {
  value: string;
  onChange: (template: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showPreview?: boolean;
  maxLength?: number;
}

const commonVariables = [
  { key: 'nome', label: 'Nome', example: 'João Silva' },
  { key: 'telefone', label: 'Telefone', example: '(11) 99999-9999' },
  { key: 'email', label: 'Email', example: 'joao@exemplo.com' }
];

const templatePresets = [
  {
    name: 'Apresentação Inicial',
    template: 'Olá {nome}! Sou {corretor} da {empresa}. Vi seu interesse no imóvel e gostaria de ajudar. Quando podemos conversar?'
  },
  {
    name: 'Follow-up Lead',
    template: 'Oi {nome}! Como está? Ainda tem interesse no imóvel que você consultou? Tenho outras opções similares que podem te interessar!'
  },
  {
    name: 'Agendamento Visita',
    template: 'Olá {nome}! Que tal agendarmos uma visita ao imóvel? Tenho disponibilidade hoje à tarde ou amanhã de manhã. Qual prefere?'
  },
  {
    name: 'Proposta Personalizada',
    template: 'Oi {nome}! Preparei uma proposta especial para o imóvel que você tem interesse. Posso enviar por WhatsApp ou prefere que conversemos por telefone?'
  }
];

const sampleData = {
  nome: 'Maria Santos',
  telefone: '(11) 98765-4321',
  email: 'maria@exemplo.com',
  corretor: 'João Corretor',
  empresa: 'ImobiPRO'
};

export function MessageTemplateEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Digite sua mensagem aqui...",
  showPreview = true,
  maxLength = 1000
}: MessageTemplateEditorProps) {
  const [isPreviewVisible, setIsPreviewVisible] = useState(showPreview);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const variables = extractTemplateVariables(value);
  const resolvedPreview = resolveMessageTemplate(value, sampleData);

  // Validar template sempre que mudar
  useEffect(() => {
    const errors = validateMessageTemplate(value);
    setValidationErrors(errors);
  }, [value]);

  const handleInsertVariable = (variable: string) => {
    if (disabled) return;
    
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + `{${variable}}` + value.slice(end);
    
    onChange(newValue);
    
    // Reposicionar cursor após a variável inserida
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
    }, 0);
  };

  const handlePresetSelect = (template: string) => {
    if (disabled) return;
    onChange(template);
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(resolvedPreview);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const handleReset = () => {
    if (disabled) return;
    onChange('Olá {nome}, tudo bem?');
  };

  const characterCount = value.length;
  const isOverLimit = maxLength && characterCount > maxLength;
  const hasErrors = validationErrors.length > 0;

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Template da Mensagem
          {variables.length > 0 && (
            <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/50">
              {variables.length} variável{variables.length !== 1 ? 'is' : ''}
            </Badge>
          )}
          {hasErrors && (
            <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-400/50">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Erros
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Presets */}
        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-medium">Templates Prontos:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templatePresets.map((preset, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect(preset.template)}
                disabled={disabled}
                className="text-left h-auto p-2 text-gray-300 border-gray-600 hover:bg-gray-800"
              >
                <div>
                  <div className="font-medium text-xs">{preset.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {preset.template.slice(0, 50)}...
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Variáveis disponíveis */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400 font-medium">Variáveis Disponíveis:</div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleReset}
              disabled={disabled}
              className="text-gray-400 hover:text-white h-auto p-1"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {commonVariables.map((variable) => (
              <Button
                key={variable.key}
                variant="outline"
                size="sm"
                type="button"
                onClick={() => handleInsertVariable(variable.key)}
                disabled={disabled}
                className="text-xs text-gray-300 border-gray-600 hover:bg-gray-800"
                title={`Inserir variável: ${variable.label} (exemplo: ${variable.example})`}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {`{${variable.key}}`}
              </Button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={`min-h-[120px] bg-gray-900/50 border-gray-700 text-white resize-none ${
              hasErrors ? 'border-red-500' : ''
            } ${isOverLimit ? 'border-yellow-500' : ''}`}
            maxLength={maxLength}
          />
          
          {/* Contador e status */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {hasErrors ? (
                <span className="text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {validationErrors[0]}
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Template válido
                </span>
              )}
            </div>
            
            <span className={`${isOverLimit ? 'text-yellow-400' : 'text-gray-500'}`}>
              {characterCount}{maxLength && `/${maxLength}`}
            </span>
          </div>
        </div>

        {/* Variáveis detectadas */}
        {variables.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-medium">Variáveis Detectadas:</div>
            <div className="flex flex-wrap gap-1">
              {variables.map((variable, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-emerald-500/20 text-emerald-300 border-emerald-400/50 text-xs"
                >
                  {`{${variable}}`}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {showPreview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400 font-medium">Preview:</div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                  className="text-gray-400 hover:text-white h-auto p-1"
                >
                  {isPreviewVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                {isPreviewVisible && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={handleCopyPreview}
                    className="text-gray-400 hover:text-white h-auto p-1"
                    title="Copiar preview"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            
            {isPreviewVisible && (
              <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="text-sm text-gray-300 italic">
                  {resolvedPreview || 'Digite uma mensagem para ver o preview...'}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  * Preview usando dados de exemplo: {Object.entries(sampleData).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Erros de validação */}
        {validationErrors.length > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="text-xs text-red-400 font-medium mb-1">Problemas encontrados:</div>
            <ul className="text-xs text-red-300 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
