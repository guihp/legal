import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Download } from "lucide-react";
import { useProperties } from "@/hooks/useProperties";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";

function ReportsView() {
  const { properties, loading: propertiesLoading } = useProperties();
  const { clients, loading: clientsLoading } = useClients();
  const { toast } = useToast();
  
  const isLoading = propertiesLoading || clientsLoading;

  const handlePropertiesExport = async () => {
    try {
      if (!properties || properties.length === 0) {
        toast({
          title: "Aviso",
          description: "Não há propriedades para gerar o relatório.",
          variant: "destructive",
        });
        return;
      }

      // Import dinâmico para evitar problemas de cache
      const jsPDF = (await import('jspdf')).default;
      
      const doc = new jsPDF();
      const today = new Date().toLocaleDateString('pt-BR');
      
      // Configurar título
      doc.setFontSize(20);
      doc.text('Relatório de Propriedades', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Gerado em: ${today}`, 20, 35);
      
      // Resumo geral
      doc.setFontSize(14);
      doc.text('Resumo Geral', 20, 55);
      
      const availableProperties = properties.filter(p => p && p.status === 'available') || [];
      const soldProperties = properties.filter(p => p && p.status === 'sold') || [];
      const rentedProperties = properties.filter(p => p && p.status === 'rented') || [];
      
      doc.setFontSize(10);
      doc.text(`Total de Propriedades: ${properties.length}`, 20, 70);
      doc.text(`Disponíveis: ${availableProperties.length}`, 20, 80);
      doc.text(`Vendidas: ${soldProperties.length}`, 20, 90);
      doc.text(`Alugadas: ${rentedProperties.length}`, 20, 100);
      
      doc.save(`relatorio-propriedades-${today.replace(/\//g, '-')}.pdf`);
      
      toast({
        title: "Relatório gerado!",
        description: "O relatório de propriedades foi baixado em PDF com sucesso.",
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro na exportação",
        description: "Erro ao gerar relatório. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleMarketAnalysisExport = async () => {
    try {
      if (!properties || properties.length === 0) {
        toast({
          title: "Aviso",
          description: "Não há dados suficientes para gerar a análise de mercado.",
          variant: "destructive",
        });
        return;
      }

      // Import dinâmico para evitar problemas de cache
      const jsPDF = (await import('jspdf')).default;

      const doc = new jsPDF();
      const today = new Date().toLocaleDateString('pt-BR');
      
      // Configurar título
      doc.setFontSize(20);
      doc.text('Análise de Mercado', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Gerado em: ${today}`, 20, 35);
      
      // Resumo geral
      doc.setFontSize(14);
      doc.text('Resumo de Leads', 20, 55);
      
      const totalLeads = clients ? clients.length : 0;
      const activeSources = clients && clients.length > 0 ? new Set(clients.map(c => c.source)).size : 0;
      
      doc.setFontSize(10);
      doc.text(`Total de Leads: ${totalLeads}`, 20, 70);
      doc.text(`Fontes Ativas: ${activeSources}`, 20, 80);
      doc.text(`Total de Propriedades: ${properties.length}`, 20, 90);
      
      doc.save(`analise-mercado-${today.replace(/\//g, '-')}.pdf`);
      
      toast({
        title: "Relatório gerado!",
        description: "A análise de mercado foi baixada em PDF com sucesso.",
      });
      
    } catch (error) {
      console.error('Erro ao gerar análise de mercado:', error);
      toast({
        title: "Erro na exportação",
        description: "Erro ao gerar análise de mercado. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Relatórios</h1>
        <p className="text-gray-400">Visualize e exporte relatórios detalhados em PDF</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Propriedades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">Relatório completo de todas as propriedades</p>
            <div className="space-y-2 text-sm text-gray-300 mb-4">
              <div>Total de propriedades: {properties.length}</div>
              <div>Disponíveis: {properties.filter(p => p.status === 'available').length}</div>
            </div>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handlePropertiesExport}
              disabled={isLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isLoading ? "Carregando..." : "Exportar PDF"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Análise de Mercado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">Análise de tendências e origem de clientes</p>
            <div className="space-y-2 text-sm text-gray-300 mb-4">
              <div>Total de leads: {clients.length}</div>
              <div>Fontes ativas: {new Set(clients.map(c => c.source)).size}</div>
            </div>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleMarketAnalysisExport}
              disabled={isLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isLoading ? "Carregando..." : "Exportar PDF"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ReportsView;