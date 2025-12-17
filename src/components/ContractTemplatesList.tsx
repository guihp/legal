import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Search, 
  Download, 
  Trash2, 
  Calendar,
  User,
  FileCheck,
  Loader2,
  AlertCircle,
  Home,
  Building2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useContractTemplates } from '@/contexts/ContractTemplatesContext';
import { FILE_TYPE_LABELS, ContractTemplate } from '@/types/contract-templates';

export const ContractTemplatesList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const { 
    templates, 
    loading, 
    error, 
    deleteTemplate, 
    downloadFile
  } = useContractTemplates();

  // Verificação de segurança para templates
  const safeTemplates = Array.isArray(templates) ? templates : [];
  
  const filteredTemplates = safeTemplates.filter(template =>
    template?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (template?.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o template "${name}"?\n\nEsta ação irá:\n• Remover o arquivo do storage\n• Excluir o registro da tabela\n• Não poderá ser desfeita`)) {
      setDeletingId(id);
      try {
        await deleteTemplate(id);
        console.log('✅ Template excluído com sucesso');
      } catch (error) {
        console.error('❌ Erro ao excluir template:', error);
        alert('Erro ao excluir template. Verifique o console para mais detalhes.');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleDownload = async (template: ContractTemplate) => {
    setDownloadingId(template.id);
    try {
      await downloadFile(template);
      console.log('✅ Download concluído com sucesso');
    } catch (error) {
      console.error('❌ Erro no download:', error);
      alert('Erro ao fazer download do arquivo. Verifique o console para mais detalhes.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isWordDocument = (fileName: string, fileType?: string): boolean => {
    return fileName.toLowerCase().endsWith('.doc') || 
           fileName.toLowerCase().endsWith('.docx') ||
           fileType?.includes('word') ||
           fileType?.includes('msword');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-400">Carregando templates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Templates de Contrato</h2>
            <p className="text-gray-400">Gerencie seus modelos de contrato</p>
          </div>
        </div>
        
        <Alert variant="destructive" className="bg-red-900/50 border-red-600">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Erro ao carregar templates</p>
              <p className="text-sm">{error}</p>
              <p className="text-sm text-gray-300">
                Certifique-se de que a tabela 'contract_templates' foi criada no Supabase.
                Execute o SQL do arquivo 'database_contract_templates.sql' para criar a estrutura necessária.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/60">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Sistema de Templates Não Configurado</h3>
            <p className="text-gray-400 mb-4">
              Para usar o sistema de templates, execute a migração do banco de dados.
            </p>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-600 text-left">
              <p className="text-sm text-gray-300 mb-2">Execute no SQL Editor do Supabase:</p>
              <code className="text-xs text-blue-300 block whitespace-pre-wrap">
{`-- 1. Criar bucket no storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-templates', 'contract-templates', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar tabela (execute o arquivo database_contract_templates.sql)`}
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Templates de Contrato</h2>
          <p className="text-gray-400">Baixe ou exclua seus modelos de contrato</p>
        </div>
        <Badge variant="outline" className="border-blue-500 text-blue-400">
          {safeTemplates.length} template{safeTemplates.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Search */}
      <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/60">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/60 hover:bg-gray-800/70 transition-all duration-300 shadow-lg hover:shadow-xl">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Template Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        >
                          <FileText className="h-6 w-6 text-blue-400" />
                        </motion.div>
                        <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                        
                        {/* Badge do Tipo de Contrato */}
                        <Badge 
                          variant="outline" 
                          className={`${
                            template.template_type === 'Venda' 
                              ? 'bg-green-500/20 text-green-300 border-green-400/50'
                              : 'bg-blue-500/20 text-blue-300 border-blue-400/50'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            {template.template_type === 'Venda' ? (
                              <Building2 className="h-3 w-3" />
                            ) : (
                              <Home className="h-3 w-3" />
                            )}
                            <span>{template.template_type || 'Locação'}</span>
                          </div>
                        </Badge>
                        
                        <Badge 
                          variant="outline" 
                          className="bg-gray-500/20 text-gray-300 border-gray-400/50"
                        >
                          {FILE_TYPE_LABELS[template.file_type || ''] || 'Documento'}
                        </Badge>
                        {isWordDocument(template.file_name, template.file_type) && (
                          <Badge 
                            variant="outline" 
                            className="bg-purple-500/20 text-purple-300 border-purple-400/50"
                          >
                            Conversão PDF
                          </Badge>
                        )}
                      </div>
                      
                      {template.description && (
                        <p className="text-gray-300 text-sm">{template.description}</p>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <FileCheck className="h-4 w-4" />
                          <span>{template.file_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(template.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <User className="h-4 w-4" />
                          <span>{formatFileSize(template.file_size)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      {/* Botão Baixar */}
                      <motion.div
                        whileHover={{ scale: 1.1, y: -2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-blue-700 border-blue-600 text-blue-100 hover:bg-blue-600 hover:text-white backdrop-blur-sm transition-all duration-200 min-w-[100px]"
                          onClick={() => handleDownload(template)}
                          disabled={downloadingId === template.id || deletingId === template.id}
                        >
                          {downloadingId === template.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              {isWordDocument(template.file_name, template.file_type) ? 'Convertendo...' : 'Baixando...'}
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar{isWordDocument(template.file_name, template.file_type) ? ' PDF' : ''}
                            </>
                          )}
                        </Button>
                      </motion.div>
                      
                      {/* Botão Deletar */}
                      <motion.div
                        whileHover={{ scale: 1.1, y: -2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-red-700 border-red-600 text-red-100 hover:bg-red-600 hover:text-white backdrop-blur-sm transition-all duration-200 min-w-[100px]"
                          onClick={() => handleDelete(template.id, template.name)}
                          disabled={downloadingId === template.id || deletingId === template.id}
                        >
                          {deletingId === template.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Excluindo...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {filteredTemplates.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700/60">
              <CardContent className="p-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                >
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                </motion.div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {searchTerm ? 'Nenhum template encontrado' : 'Nenhum template cadastrado'}
                </h3>
                <p className="text-gray-400">
                  {searchTerm 
                    ? 'Tente ajustar os termos de busca.' 
                    : 'Faça upload de templates de contrato para começar.'
                  }
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}; 