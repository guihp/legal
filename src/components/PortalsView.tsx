
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Link2, Settings, CheckCircle, FileText, Download } from "lucide-react";
import { useProperties } from "@/hooks/useProperties";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function PortalsView() {
  const { properties, loading: propertiesLoading } = useProperties();
  const { clients, loading: clientsLoading } = useClients();
  const { toast } = useToast();

  const portals = [
    {
      name: "Viva Real",
      status: "connected",
      properties: 45,
      logo: "🏠"
    },
    {
      name: "ZAP Imóveis",
      status: "connected",
      properties: 38,
      logo: "🏢"
    },
    {
      name: "OLX",
      status: "disconnected",
      properties: 0,
      logo: "📱"
    },
    {
      name: "Imóvel Web",
      status: "pending",
      properties: 12,
      logo: "🌐"
    }
  ];

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: "bg-green-600 text-white",
      disconnected: "bg-red-600 text-white",
      pending: "bg-yellow-600 text-black"
    };
    
    const labels = {
      connected: "Conectado",
      disconnected: "Desconectado",
      pending: "Pendente"
    };

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const generatePortalsReport = () => {
    try {
      const doc = new jsPDF();
      const today = new Date().toLocaleDateString('pt-BR');
      
      // Configurar fonte e título
      doc.setFontSize(20);
      doc.text('Relatório de Portais Imobiliários', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Gerado em: ${today}`, 20, 35);
      
      // Resumo geral
      doc.setFontSize(14);
      doc.text('Resumo Geral', 20, 55);
      
      const totalConnected = portals.filter(p => p.status === 'connected').length;
      const totalProperties = portals.reduce((sum, p) => sum + p.properties, 0);
      const totalPortals = portals.length;
      
      doc.setFontSize(10);
      doc.text(`Total de Portais: ${totalPortals}`, 20, 70);
      doc.text(`Portais Conectados: ${totalConnected}`, 20, 80);
      doc.text(`Total de Propriedades Sincronizadas: ${totalProperties}`, 20, 90);
      doc.text(`Total de Propriedades no Sistema: ${properties.length}`, 20, 100);
      doc.text(`Total de Leads: ${clients.length}`, 20, 110);
      
      // Tabela de portais
      doc.setFontSize(14);
      doc.text('Detalhamento por Portal', 20, 130);
      
      const tableData = portals.map(portal => [
        portal.name,
        portal.status === 'connected' ? 'Conectado' : 
        portal.status === 'pending' ? 'Pendente' : 'Desconectado',
        portal.properties.toString(),
        portal.properties > 0 ? `${((portal.properties / properties.length) * 100).toFixed(1)}%` : '0%'
      ]);
      
      (doc as any).autoTable({
        head: [['Portal', 'Status', 'Propriedades', '% do Total']],
        body: tableData,
        startY: 140,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [75, 85, 99],
          textColor: 255,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      });
      
      // Estatísticas por tipo de propriedade
      const yPosition = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(14);
      doc.text('Distribuição por Tipo de Propriedade', 20, yPosition);
      
      const propertyTypes = {
        house: properties.filter(p => p.type === 'house').length,
        apartment: properties.filter(p => p.type === 'apartment').length,
        commercial: properties.filter(p => p.type === 'commercial').length,
        land: properties.filter(p => p.type === 'land').length,
      };
      
      const typeLabels = {
        house: 'Casas',
        apartment: 'Apartamentos',
        commercial: 'Comercial',
        land: 'Terrenos'
      };
      
      const typeData = Object.entries(propertyTypes).map(([type, count]) => [
        typeLabels[type as keyof typeof typeLabels],
        count.toString(),
        properties.length > 0 ? `${((count / properties.length) * 100).toFixed(1)}%` : '0%'
      ]);
      
      (doc as any).autoTable({
        head: [['Tipo', 'Quantidade', '% do Total']],
        body: typeData,
        startY: yPosition + 10,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      });
      
      // Origem dos leads
      const lastY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(14);
      doc.text('Origem dos Leads', 20, lastY);
      
      const leadsBySource = clients.reduce((acc, client) => {
        acc[client.source] = (acc[client.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const leadsData = Object.entries(leadsBySource).map(([source, count]) => [
        source,
        count.toString(),
        clients.length > 0 ? `${((count / clients.length) * 100).toFixed(1)}%` : '0%'
      ]);
      
      (doc as any).autoTable({
        head: [['Origem', 'Quantidade', '% do Total']],
        body: leadsData,
        startY: lastY + 10,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: 255,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      });
      
      // Rodapé
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.text('Relatório gerado pelo Sistema ImobiPro', 20, pageHeight - 20);
      doc.text(`© ${new Date().getFullYear()} - Todos os direitos reservados`, 20, pageHeight - 10);
      
      // Salvar o PDF
      doc.save(`relatorio-portais-${today.replace(/\//g, '-')}.pdf`);
      
      toast({
        title: "Relatório gerado!",
        description: "O relatório de portais foi baixado com sucesso.",
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro na geração",
        description: "Ocorreu um erro ao gerar o relatório de portais.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Portais</h1>
          <p className="text-gray-400">Gerencie suas integrações com portais imobiliários</p>
        </div>
        <Button 
          onClick={generatePortalsReport}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={propertiesLoading || clientsLoading}
        >
          <FileText className="h-4 w-4 mr-2" />
          {propertiesLoading || clientsLoading ? "Carregando..." : "Gerar Relatório PDF"}
        </Button>
      </div>

      {/* Card de resumo para relatório */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resumo para Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {portals.filter(p => p.status === 'connected').length}
              </div>
              <div className="text-sm text-gray-400">Portais Conectados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {portals.reduce((sum, p) => sum + p.properties, 0)}
              </div>
              <div className="text-sm text-gray-400">Propriedades Sincronizadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {properties.length}
              </div>
              <div className="text-sm text-gray-400">Total de Propriedades</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {clients.length}
              </div>
              <div className="text-sm text-gray-400">Total de Leads</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <Button 
              onClick={generatePortalsReport}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={propertiesLoading || clientsLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {propertiesLoading || clientsLoading ? "Carregando dados..." : "Baixar Relatório Completo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {portals.map((portal) => (
          <Card key={portal.name} className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-3">
                  <span className="text-2xl">{portal.logo}</span>
                  {portal.name}
                </CardTitle>
                {getStatusBadge(portal.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Propriedades Sincronizadas:</span>
                  <span className="text-white font-medium">{portal.properties}</span>
                </div>
                
                <div className="flex gap-2">
                  {portal.status === "connected" ? (
                    <>
                      <Button variant="outline" size="sm" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700">
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700">
                        <Link2 className="h-4 w-4 mr-2" />
                        Sincronizar
                      </Button>
                    </>
                  ) : (
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      <Globe className="h-4 w-4 mr-2" />
                      Conectar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
