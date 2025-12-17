import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

export default function DatabaseTest() {
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");
  const [testResult, setTestResult] = useState<string>("");

  const addDiagnostic = (message: string) => {
    setDiagnostics(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      addDiagnostic('🔍 Testando conexão com Supabase...');
      
      const { data, error } = await supabase
        .from('properties')
        .select('count', { count: 'exact', head: true });

      if (error) {
        addDiagnostic(`❌ Erro de conexão: ${error.message}`);
        toast({
          title: "Erro de Conexão",
          description: `Falha ao conectar: ${error.message}`,
          variant: "destructive",
        });
        return false;
      }

      addDiagnostic(`✅ Conexão estabelecida. ${data || 0} propriedades encontradas`);
      toast({
        title: "Conexão OK",
        description: `Conectado ao Supabase com sucesso!`,
      });
      return true;
    } catch (error: any) {
      addDiagnostic(`💥 Erro inesperado: ${error.message}`);
      console.error('💥 Erro completo:', error);
      toast({
        title: "Erro Inesperado",
        description: `${error.message}`,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const testDatabase = async () => {
    try {
      setLoading(true);
      setMessage('🔍 Testando conexão com o banco...');
      
      // Teste das propriedades
      const { data, error } = await supabase
        .from('properties')
        .select('count', { count: 'exact', head: true });

      if (error) {
        setMessage(`❌ Erro: ${error.message}`);
        setTestResult('error');
      } else {
        setMessage(`✅ Conectado! ${data || 0} propriedades encontradas`);
        setTestResult('success');
      }
    } catch (error: any) {
      console.error('Erro:', error);
      setMessage(`❌ Erro: ${error.message}`);
      setTestResult('error');
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setDiagnostics([]);
    
    try {
      await testConnection();
      await testDatabase();
    } catch (error: any) {
      addDiagnostic(`💥 Erro ao executar todos os testes: ${error.message}`);
      console.error('💥 Erro completo:', error);
      toast({
        title: "Erro ao Executar Todos os Testes",
        description: `${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Teste do Banco de Dados</h2>
      
      <div className="space-y-2">
        <Button 
          onClick={testDatabase} 
          disabled={loading}
          className="mb-4"
        >
          {loading ? "Testando..." : "Testar Conexão & Tabelas"}
        </Button>
        
        {message && (
          <div className={`p-3 rounded ${testResult === 'success' ? 'bg-green-100 text-green-800' : testResult === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
            <pre className="whitespace-pre-wrap text-sm">{message}</pre>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Button onClick={runAllTests} disabled={loading}>
          {loading ? "Executando..." : "Executar Todos os Testes"}
        </Button>
        
        <div className="space-y-2">
          {diagnostics.map((diagnostic, index) => (
            <div key={index} className="p-2 bg-gray-100 rounded text-sm font-mono">
              {diagnostic}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 