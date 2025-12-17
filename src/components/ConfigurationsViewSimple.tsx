import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Palette, Globe } from 'lucide-react';

export function ConfigurationsViewSimple() {
  console.log('🔧 ConfigurationsViewSimple renderizado');
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Configurações
            </h1>
            <p className="text-gray-400">
              Personalize a aparência e configurações da sua empresa
            </p>
          </div>
          
          <Button 
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Restaurar Padrões
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Coluna Principal - Configurações */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 🏢 Configurações da Empresa */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-600">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Empresa</CardTitle>
                    <CardDescription className="text-gray-400">
                      Personalize a identidade da sua empresa
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="text-gray-300">
                  Configurações da empresa estarão aqui...
                </div>
              </CardContent>
            </Card>

            {/* 🎨 Aparência */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-600">
                    <Palette className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Aparência</CardTitle>
                    <CardDescription className="text-gray-400">
                      Customize o visual da interface
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="text-gray-300">
                  Configurações de aparência estarão aqui...
                </div>
              </CardContent>
            </Card>

            {/* 🌐 Configurações Regionais */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-600">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Regional</CardTitle>
                    <CardDescription className="text-gray-400">
                      Configurações de idioma e localização
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="text-gray-300">
                  Configurações regionais estarão aqui...
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Lateral - Preview */}
          <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-700 sticky top-6">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Preview
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Versão simplificada sem hooks complexos
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">
                        ImobiPro
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        Gestão Imobiliária
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}