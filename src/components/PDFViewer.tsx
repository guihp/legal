import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  Maximize2,
  Minimize2,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Printer
} from 'lucide-react';
import { ContractTemplate } from '@/types/contract-templates';

// React-PDF será carregado dinamicamente sob demanda

const LazyPdf: React.FC<{
  fileUrl: string;
  pageNumber: number;
  scale: number;
  onLoadSuccess: (e: { numPages: number }) => void;
  onLoadError: (e: Error) => void;
}> = ({ fileUrl, pageNumber, scale, onLoadSuccess, onLoadError }) => {
  const [Comp, setComp] = React.useState<{ Document: any; Page: any } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    import('react-pdf')
      .then((mod: any) => {
        if (!cancelled) setComp({ Document: (mod as any).Document, Page: (mod as any).Page });
      })
      .catch(() => setComp(null));
    return () => { cancelled = true; };
  }, []);
  if (!Comp) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-gray-400">Carregando PDF...</span>
      </div>
    );
  }
  const { Document, Page } = Comp as any;
  return (
    <Document file={fileUrl} onLoadSuccess={onLoadSuccess} onLoadError={onLoadError}>
      <Page pageNumber={pageNumber} scale={scale} />
    </Document>
  );
};

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  template: ContractTemplate | null;
  fileUrl: string | null;
  contract: any;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  isOpen,
  onClose,
  template,
  fileUrl,
  contract
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useIframe, setUseIframe] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    if (isOpen && fileUrl) {
      console.log('🔍 Iniciando carregamento do PDF:', fileUrl);
      console.log('🔍 Template info:', template);
      setLoading(true);
      setError(null);
      setPageNumber(1);
      setScale(1.0);
      setRotation(0);
      setUseIframe(false);
      setLoadingTimeout(false);

      // Para PDFs, usar iframe diretamente após um breve delay
      const isPDFFile = template?.file_type?.includes('pdf') || 
                       template?.file_name?.toLowerCase().endsWith('.pdf') ||
                       fileUrl.toLowerCase().includes('.pdf');
      
      if (isPDFFile) {
        console.log('📄 Arquivo PDF detectado, usando iframe em 2 segundos...');
        const timeout = setTimeout(() => {
          console.log('⏰ Ativando iframe para PDF');
          setLoadingTimeout(true);
          setUseIframe(true);
          setLoading(false);
        }, 2000); // Reduzido para 2 segundos para PDFs

        return () => clearTimeout(timeout);
      } else {
        // Para outros arquivos, timeout normal
        const timeout = setTimeout(() => {
          console.log('⏰ Timeout de carregamento - usando fallback iframe');
          setLoadingTimeout(true);
          setUseIframe(true);
          setLoading(false);
        }, 15000);

        return () => clearTimeout(timeout);
      }
    }
  }, [isOpen, fileUrl, template]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('✅ PDF carregado com sucesso:', numPages, 'páginas');
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    setLoadingTimeout(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('❌ Erro ao carregar PDF:', error);
    setError('Erro ao carregar o documento PDF');
    setLoading(false);
    setUseIframe(true); // Fallback para iframe
  };

  const handleRetry = () => {
    console.log('🔄 Tentando recarregar o PDF...');
    setLoading(true);
    setError(null);
    setUseIframe(false);
    setLoadingTimeout(false);
    
    // Force re-render
    const currentUrl = fileUrl;
    if (currentUrl) {
      // Adicionar timestamp para forçar reload
      const urlWithTimestamp = currentUrl.includes('?') 
        ? `${currentUrl}&t=${Date.now()}`
        : `${currentUrl}?t=${Date.now()}`;
      
      // Simular mudança de URL para forçar reload
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = () => {
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
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    setScale(1.0);
    setRotation(0);
    setIsFullscreen(false);
    setLoading(true);
    setError(null);
    setPageNumber(1);
    setNumPages(0);
    setUseIframe(false);
    setLoadingTimeout(false);
    onClose();
  };

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages));
  };

  const isPDF = template?.file_type?.includes('pdf') || template?.file_name?.toLowerCase().endsWith('.pdf');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={`relative bg-gray-900 rounded-lg shadow-2xl border border-gray-700 z-[10000] ${
            isFullscreen 
              ? 'w-screen h-screen rounded-none' 
              : 'w-[95vw] h-[95vh] max-w-7xl'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white truncate">
                {template?.name || 'Visualizar Documento'}
              </h2>
              <p className="text-sm text-gray-400 truncate">
                {template?.file_name}
                {useIframe && <span className="ml-2 text-yellow-400">(Modo compatibilidade)</span>}
              </p>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-2 ml-4">
              {/* Botão de retry */}
              {(error || loadingTimeout) && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRetry}
                    className="text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-gray-600 mx-2" />
                </>
              )}

              {isPDF && numPages > 0 && !useIframe && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPrevPage}
                    disabled={pageNumber <= 1}
                    className="text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm text-gray-400 min-w-[4rem] text-center">
                    {pageNumber} / {numPages}
                  </span>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={pageNumber >= numPages}
                    className="text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <div className="w-px h-6 bg-gray-600 mx-2" />
                </>
              )}
              
              {!useIframe && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={scale <= 0.5}
                    className="text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm text-gray-400 min-w-[3rem] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={scale >= 3.0}
                    className="text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  
                  <div className="w-px h-6 bg-gray-600 mx-2" />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRotate}
                    className="text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrint}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <Printer className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <Download className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFullscreen}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              
              <div className="w-px h-6 bg-gray-600 mx-2" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-gray-300 hover:text-white hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden" style={{ height: 'calc(100% - 73px)' }}>
            <div className="w-full h-full bg-gray-800 overflow-auto flex items-center justify-center">
              {loading && !loadingTimeout ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-400">Carregando documento...</p>
                    <p className="text-gray-500 text-sm mt-2">
                      Isso pode levar alguns segundos
                    </p>
                  </div>
                </div>
              ) : error && !useIframe ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
                    <p className="text-red-400 mb-2">Erro ao carregar documento</p>
                    <p className="text-gray-400 text-sm mb-4">{error}</p>
                    <div className="flex gap-2 justify-center">
                      <Button 
                        onClick={handleRetry}
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Tentar Novamente
                      </Button>
                      <Button 
                        onClick={handleDownload}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Fazer Download
                      </Button>
                    </div>
                  </div>
                </div>
              ) : fileUrl ? (
                <div className="p-4 w-full h-full">
                  {isPDF ? (
                    useIframe || loadingTimeout ? (
                      // Fallback: usar iframe
                      <div className="w-full h-full bg-white rounded-lg overflow-hidden">
                        <iframe
                          src={fileUrl}
                          className="w-full h-full border-0"
                          title={template?.name}
                          allow="fullscreen"
                          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                          onLoad={() => {
                            console.log('✅ Iframe carregado com sucesso');
                            setLoading(false);
                          }}
                          onError={(e) => {
                            console.log('❌ Erro no iframe:', e);
                            setError('Não foi possível carregar o documento');
                          }}
                        />
                      </div>
                    ) : (
                      // React-PDF
                      <div 
                        className="flex justify-center"
                        style={{
                          transform: `rotate(${rotation}deg)`,
                          transformOrigin: 'center',
                          transition: 'transform 0.3s ease'
                        }}
                      >
                        <LazyPdf
                          fileUrl={fileUrl}
                          pageNumber={pageNumber}
                          scale={scale}
                          onLoadSuccess={onDocumentLoadSuccess}
                          onLoadError={onDocumentLoadError}
                        />
                      </div>
                    )
                  ) : (
                    <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl max-h-full overflow-auto mx-auto">
                      <div className="text-center">
                        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-800 mb-4">
                          {template?.name}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Arquivo: {template?.file_name}
                        </p>
                        <div className="bg-gray-100 p-6 rounded-lg">
                          <p className="text-gray-700 mb-4">
                            Este tipo de arquivo não pode ser visualizado diretamente no navegador.
                          </p>
                          <Button 
                            onClick={handleDownload}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Fazer Download para Visualizar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-4" />
                    <p className="text-yellow-400">Documento não disponível</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}; 