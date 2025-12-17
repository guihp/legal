import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Palette, Globe, Upload } from 'lucide-react';

export function ConfigurationsViewMinimal() {
  console.log('🔧 ConfigurationsViewMinimal renderizado');
  
  // Estado local apenas para teste
  const [companyName, setCompanyName] = useState('ImobiPro');
  const [companySubtitle, setCompanySubtitle] = useState('Gestão Imobiliária');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  
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
                {/* Upload de Logo */}
                <div className="space-y-3">
                  <Label className="text-white font-medium">Logo da Empresa</Label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 hover:border-blue-500 transition-colors">
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                      <p className="text-white font-medium mb-1">
                        Clique ou arraste uma imagem
                      </p>
                      <p className="text-gray-400 text-sm">
                        PNG, JPG ou SVG até 2MB
                      </p>
                      <Button
                        className="mt-3 bg-blue-600 hover:bg-blue-700"
                      >
                        Selecionar Arquivo
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Nome da Empresa */}
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-white font-medium">
                    Nome da Empresa
                  </Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="Nome da sua empresa"
                  />
                </div>

                {/* Subtítulo */}
                <div className="space-y-2">
                  <Label htmlFor="company-subtitle" className="text-white font-medium">
                    Subtítulo
                  </Label>
                  <Input
                    id="company-subtitle"
                    value={companySubtitle}
                    onChange={(e) => setCompanySubtitle(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                    placeholder="Descrição da sua empresa"
                  />
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
                {/* Cor Primária */}
                <div className="space-y-3">
                  <Label className="text-white font-medium">Cor Primária</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-12 rounded-lg border-2 border-gray-600 cursor-pointer"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white font-mono"
                      placeholder="#3B82F6"
                    />
                  </div>
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
                  Preview em Tempo Real
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Veja como ficará na sidebar
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {/* Preview da Sidebar */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
                      style={{ background: `linear-gradient(45deg, ${primaryColor}, ${primaryColor}dd)` }}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">
                        {companyName || 'Nome da Empresa'}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {companySubtitle || 'Subtítulo'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Indicadores do Preview */}
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Tema:</span>
                    <span className="text-white">Dark</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Cor:</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border border-gray-600"
                        style={{ backgroundColor: primaryColor }}
                      />
                      <span className="text-white font-mono text-xs">
                        {primaryColor}
                      </span>
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