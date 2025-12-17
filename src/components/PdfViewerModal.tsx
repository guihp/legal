import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, Download, FileText, AlertCircle, Printer, DollarSign, User, Building2, Calendar } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { convertWordToPDF, isWordDocument, cleanupPdfUrl } from '@/utils/documentConverter';
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: any;
}

export function PdfViewerModal({ isOpen, onClose, contract }: PdfViewerModalProps) {
  if (!contract) return null;

  const handleDownload = () => {
    try {
      // Criar documento HTML para download
      const pdfContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Contrato_${contract.numero}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0;
              padding: 20px;
              background: white;
              color: #333;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 3px solid #007bff;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
              font-size: 2em;
            }
            .header h2 {
              color: #666;
              margin: 10px 0 0 0;
              font-size: 1.5em;
            }
            .section {
              margin-bottom: 25px;
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 8px;
              background: #f9f9f9;
            }
            .section h3 {
              color: #007bff;
              margin: 0 0 15px 0;
              font-size: 1.3em;
            }
            .info { 
              margin-bottom: 12px; 
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #eee;
            }
            .label { 
              font-weight: bold; 
              color: #555;
            }
            .value {
              color: #333;
              text-align: right;
            }
            .status {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 15px;
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .status.ativo { background: #d4edda; color: #155724; }
            .status.pendente { background: #fff3cd; color: #856404; }
            .status.vencendo { background: #f8d7da; color: #721c24; }
            .financial {
              background: #007bff;
              color: white;
              text-align: center;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .financial .value {
              font-size: 2em;
              font-weight: bold;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CONTRATO ${contract.tipo?.toUpperCase() || 'INDEFINIDO'}</h1>
            <h2>Número: ${contract.numero}</h2>
          </div>
          
          <div class="section">
            <h3>Informações do Cliente</h3>
            <div class="info">
              <span class="label">Nome:</span>
              <span class="value">${contract.client_name || 'Não informado'}</span>
            </div>
            <div class="info">
              <span class="label">Status:</span>
              <span class="value">
                <span class="status ${contract.status?.toLowerCase() || 'pendente'}">${contract.status || 'Pendente'}</span>
              </span>
            </div>
          </div>
          
          <div class="section">
            <h3>Informações da Propriedade</h3>
            <div class="info">
              <span class="label">Título:</span>
              <span class="value">${contract.property_title || 'Não informado'}</span>
            </div>
            <div class="info">
              <span class="label">Endereço:</span>
              <span class="value">${contract.property_address || 'Não informado'}</span>
            </div>
          </div>
          
          <div class="financial">
            <h3>Valor do Contrato</h3>
            <div class="value">R$ ${typeof contract.valor === 'string' ? parseFloat(contract.valor || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : (contract.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          
          <div class="section">
            <h3>Datas Importantes</h3>
            <div class="info">
              <span class="label">Data de Início:</span>
              <span class="value">${contract.data_inicio ? new Date(contract.data_inicio).toLocaleDateString('pt-BR') : 'Não informado'}</span>
            </div>
            <div class="info">
              <span class="label">Data de Fim:</span>
              <span class="value">${contract.data_fim ? new Date(contract.data_fim).toLocaleDateString('pt-BR') : 'Indefinido'}</span>
            </div>
            ${contract.data_assinatura ? `
            <div class="info">
              <span class="label">Data de Assinatura:</span>
              <span class="value">${new Date(contract.data_assinatura).toLocaleDateString('pt-BR')}</span>
            </div>
            ` : ''}
            ${contract.proximo_vencimento ? `
            <div class="info">
              <span class="label">Próximo Vencimento:</span>
              <span class="value">${new Date(contract.proximo_vencimento).toLocaleDateString('pt-BR')}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="section">
            <h3>Detalhes do Contrato</h3>
            <div class="info">
              <span class="label">Tipo:</span>
              <span class="value">${contract.tipo || 'Não informado'}</span>
            </div>
            <div class="info">
              <span class="label">Data de Criação:</span>
              <span class="value">${contract.created_at ? new Date(contract.created_at).toLocaleDateString('pt-BR') + ' às ' + new Date(contract.created_at).toLocaleTimeString('pt-BR') : 'Não informado'}</span>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Dashboard Imobiliário - Contratos</strong></p>
            <p>Documento gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            <p>Este é um documento oficial do sistema de contratos.</p>
          </div>
        </body>
        </html>
      `;

      // Fazer download
      const blob = new Blob([pdfContent], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Contrato_${contract.numero}_${new Date().toISOString().split('T')[0]}.html`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Contrato baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao baixar contrato:', error);
      toast.error('Erro ao baixar contrato');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'ativo': { variant: 'default' as const, className: 'bg-green-500 hover:bg-green-600' },
      'pendente': { variant: 'secondary' as const, className: 'bg-yellow-500 hover:bg-yellow-600' },
      'vencendo': { variant: 'destructive' as const, className: 'bg-red-500 hover:bg-red-600' },
      'expirado': { variant: 'destructive' as const, className: 'bg-gray-500 hover:bg-gray-600' }
    };

    const config = statusConfig[status?.toLowerCase() as keyof typeof statusConfig] || statusConfig.pendente;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {status || 'Pendente'}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-blue-600">
                Visualização do Contrato
            </DialogTitle>
              <p className="text-gray-600 mt-1">Nº {contract.numero}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="hidden md:flex"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="py-6">
          {/* Header do contrato */}
          <div className="text-center mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">
              CONTRATO {contract.tipo?.toUpperCase() || 'INDEFINIDO'}
            </h1>
            <h2 className="text-xl text-gray-700">Número: {contract.numero}</h2>
          </div>

          {/* Grid de informações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Dados do Cliente */}
            <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center mb-4">
                <User className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-blue-600">Dados do Cliente</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Nome:</label>
                  <p className="text-gray-900 font-medium">{contract.client_name || 'Não informado'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status:</label>
                  <div className="mt-1">
                    {getStatusBadge(contract.status)}
                  </div>
                </div>
              </div>
            </div>

            {/* Dados da Propriedade */}
            <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-500">
              <div className="flex items-center mb-4">
                <Building2 className="h-5 w-5 text-green-600 mr-2" />
                <h3 className="text-lg font-semibold text-green-600">Dados da Propriedade</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Título:</label>
                  <p className="text-gray-900 font-medium">{contract.property_title || 'Não informado'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Endereço:</label>
                  <p className="text-gray-900">{contract.property_address || 'Não informado'}</p>
                </div>
              </div>
            </div>

            {/* Datas */}
            <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-500">
              <div className="flex items-center mb-4">
                <Calendar className="h-5 w-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-purple-600">Datas Importantes</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Data de Início:</label>
                  <p className="text-gray-900">
                    {contract.data_inicio ? new Date(contract.data_inicio).toLocaleDateString('pt-BR') : 'Não informado'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Data de Fim:</label>
                  <p className="text-gray-900">
                    {contract.data_fim ? new Date(contract.data_fim).toLocaleDateString('pt-BR') : 'Indefinido'}
                  </p>
                </div>
                {contract.data_assinatura && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data de Assinatura:</label>
                    <p className="text-gray-900">
                      {new Date(contract.data_assinatura).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
                {contract.proximo_vencimento && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Próximo Vencimento:</label>
                    <p className="text-gray-900 font-medium text-orange-600">
                      {new Date(contract.proximo_vencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Detalhes do Contrato */}
            <div className="bg-orange-50 p-6 rounded-lg border-l-4 border-orange-500">
              <div className="flex items-center mb-4">
                <FileText className="h-5 w-5 text-orange-600 mr-2" />
                <h3 className="text-lg font-semibold text-orange-600">Detalhes do Contrato</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Tipo:</label>
                  <p className="text-gray-900 font-medium capitalize">{contract.tipo || 'Não informado'}</p>
                      </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Criado em:</label>
                  <p className="text-gray-900">
                    {contract.created_at ? 
                      new Date(contract.created_at).toLocaleDateString('pt-BR') + ' às ' + 
                      new Date(contract.created_at).toLocaleTimeString('pt-BR') : 
                      'Não informado'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Valor financeiro destacado */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-lg text-center mb-8 shadow-lg">
            <div className="flex items-center justify-center mb-3">
              <DollarSign className="h-8 w-8 mr-2" />
              <h3 className="text-2xl font-semibold">Valor do Contrato</h3>
            </div>
            <div className="text-4xl font-bold">
              R$ {typeof contract.valor === 'string' ? 
                parseFloat(contract.valor || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 
                (contract.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
              }
            </div>
          </div>

          {/* Informações adicionais */}
          <div className="bg-gray-50 p-6 rounded-lg border">
            <h4 className="font-semibold text-gray-800 mb-3">ℹ️ Informações Adicionais</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">ID do Contrato:</span> {contract.id}
              </div>
              <div>
                <span className="font-medium">Última Atualização:</span>{' '}
                {contract.updated_at ? 
                  new Date(contract.updated_at).toLocaleDateString('pt-BR') + ' às ' + 
                  new Date(contract.updated_at).toLocaleTimeString('pt-BR') : 
                  'Não informado'
                }
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 mt-8 pt-6 border-t">
            <p className="font-semibold">Dashboard Imobiliário - Sistema de Contratos</p>
            <p>Documento visualizado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            <p>Este documento é uma visualização do contrato original armazenado no sistema.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 