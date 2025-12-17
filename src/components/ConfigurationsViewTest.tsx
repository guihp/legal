import React from 'react';

export function ConfigurationsViewTest() {
  console.log('🧪 ConfigurationsViewTest renderizado');
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Configurações - Teste</h1>
        <div className="bg-gray-900 p-6 rounded-lg">
          <p className="text-gray-300">
            Este é um componente de teste básico para verificar se o roteamento funciona.
          </p>
          <div className="mt-4 space-y-2">
            <div>✅ Componente carregado com sucesso</div>
            <div>✅ Estilos básicos aplicados</div>
            <div>✅ Não está usando hooks complexos</div>
          </div>
        </div>
      </div>
    </div>
  );
}