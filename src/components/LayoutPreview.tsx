import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Settings, Trash2, QrCode, CheckCircle } from 'lucide-react';

// Dados de exemplo para mostrar os layouts
const sampleInstances = [
  {
    id: '1',
    name: 'WhatsApp Vendas',
    profileName: 'João Silva',
    phone: '+55 11 99999-1234',
    status: 'connected' as const,
    messageCount: 45,
    contactCount: 123,
    chatCount: 12,
    lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h atrás
    profilePicUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'
  },
  {
    id: '2',
    name: 'WhatsApp Suporte',
    profileName: 'Maria Santos',
    phone: '+55 11 88888-5678',
    status: 'qr_code' as const,
    messageCount: 0,
    contactCount: 0,
    chatCount: 0,
    lastSeen: undefined
  },
  {
    id: '3',
    name: 'WhatsApp Marketing',
    profileName: 'Pedro Costa',
    phone: '+55 11 77777-9012',
    status: 'connected' as const,
    messageCount: 89,
    contactCount: 256,
    chatCount: 34,
    lastSeen: new Date(Date.now() - 30 * 60 * 1000), // 30min atrás
    profilePicUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face'
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'qr_code': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'connected': return <CheckCircle className="h-4 w-4" />;
    case 'qr_code': return <QrCode className="h-4 w-4" />;
    default: return <Smartphone className="h-4 w-4" />;
  }
};

const formatLastSeen = (date?: Date) => {
  if (!date) return 'Nunca ativo';
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (diffMinutes < 60) return `${diffMinutes}min atrás`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h atrás`;
};

export function LayoutPreview() {
  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-4">🎨 Escolha o Layout das Conexões</h1>
        <p className="text-gray-400">Clique no botão "Escolher Este" do layout que mais gostar</p>
      </div>

      {/* OPÇÃO 1: CARDS COMPACTOS */}
      <Card className="bg-gray-800/50 border-gray-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>📱 OPÇÃO 1: Cards Compactos</span>
            <Button className="bg-blue-600 hover:bg-blue-700">Escolher Este</Button>
          </CardTitle>
          <p className="text-gray-400 text-sm">3 por linha • Compacto • Informações essenciais</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sampleInstances.map((instance) => (
              <div key={`compact-${instance.id}`} className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      {instance.profilePicUrl ? (
                        <img 
                          src={instance.profilePicUrl} 
                          alt={instance.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                          <Smartphone className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-800 ${
                        instance.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}></div>
                    </div>
                    <div className="truncate">
                      <h3 className="font-medium text-white text-sm truncate">{instance.name}</h3>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(instance.status)} text-xs px-2 py-1`}>
                    {getStatusIcon(instance.status)}
                  </Badge>
                </div>

                <div className="space-y-2 mb-3">
                  <p className="text-xs text-gray-400 truncate">{instance.profileName}</p>
                  <p className="text-xs font-mono text-gray-300">{instance.phone}</p>
                  <p className="text-xs text-gray-500">{formatLastSeen(instance.lastSeen)}</p>
                </div>

                {instance.status === 'connected' && (
                  <div className="flex justify-between text-xs mb-3 bg-gray-700/30 rounded p-2">
                    <span className="text-blue-400">💬 {instance.messageCount}</span>
                    <span className="text-green-400">👥 {instance.contactCount}</span>
                    <span className="text-purple-400">💭 {instance.chatCount}</span>
                  </div>
                )}

                <div className="flex justify-end gap-1">
                  {instance.status === 'qr_code' && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-yellow-400 hover:bg-yellow-600/20">
                      <QrCode className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:bg-gray-700">
                    <Settings className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:bg-red-600/20">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* OPÇÃO 2: LISTA VERTICAL */}
      <Card className="bg-gray-800/50 border-gray-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>📋 OPÇÃO 2: Lista Vertical Detalhada</span>
            <Button className="bg-green-600 hover:bg-green-700">Escolher Este</Button>
          </CardTitle>
          <p className="text-gray-400 text-sm">Uma por linha • Muitos detalhes • Layout horizontal</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sampleInstances.map((instance) => (
              <div key={`list-${instance.id}`} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {instance.profilePicUrl ? (
                        <img 
                          src={instance.profilePicUrl} 
                          alt={instance.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                          <Smartphone className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border border-gray-800 ${
                        instance.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}></div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-white">{instance.name}</h3>
                      <p className="text-sm text-gray-400">{instance.profileName}</p>
                      <p className="text-xs font-mono text-gray-500">{instance.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <Badge className={`${getStatusColor(instance.status)}`}>
                      {getStatusIcon(instance.status)}
                      <span className="ml-1">{instance.status === 'connected' ? 'Conectado' : 'QR Code'}</span>
                    </Badge>
                    
                    {instance.status === 'connected' && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-400">💬 {instance.messageCount} msgs</span>
                        <span className="text-green-400">👥 {instance.contactCount} contatos</span>
                        <span className="text-purple-400">💭 {instance.chatCount} chats</span>
                      </div>
                    )}
                    
                    <span className="text-xs text-gray-500">{formatLastSeen(instance.lastSeen)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {instance.status === 'qr_code' && (
                      <Button variant="outline" size="sm">QR Code</Button>
                    )}
                    <Button variant="ghost" size="sm">⚙️</Button>
                    <Button variant="ghost" size="sm">🗑️</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* OPÇÃO 3: GRID MASONRY */}
      <Card className="bg-gray-800/50 border-gray-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>🎯 OPÇÃO 3: Grid Masonry (Pinterest-style)</span>
            <Button className="bg-purple-600 hover:bg-purple-700">Escolher Este</Button>
          </CardTitle>
          <p className="text-gray-400 text-sm">Tamanhos variados • Visual atrativo • Estilo Pinterest</p>
        </CardHeader>
        <CardContent>
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {sampleInstances.map((instance) => (
              <div key={`masonry-${instance.id}`} className="break-inside-avoid bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
                <div className="text-center mb-4">
                  <div className="relative inline-block">
                    {instance.profilePicUrl ? (
                      <img 
                        src={instance.profilePicUrl} 
                        alt={instance.name}
                        className="w-16 h-16 rounded-full mx-auto mb-2 object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center">
                        <Smartphone className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-gray-800 ${
                      instance.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></div>
                  </div>
                  <h3 className="font-bold text-white">{instance.name}</h3>
                  <p className="text-sm text-gray-400">{instance.profileName}</p>
                </div>

                <div className="text-center mb-4">
                  <Badge className={`${getStatusColor(instance.status)} px-3 py-1`}>
                    {getStatusIcon(instance.status)}
                    <span className="ml-1">{instance.status === 'connected' ? 'Conectado' : 'QR Code'}</span>
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="bg-gray-700/30 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Contato</div>
                    <div className="font-mono text-sm text-white">{instance.phone}</div>
                  </div>

                  {instance.status === 'connected' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-blue-600/20 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-blue-400">{instance.messageCount}</div>
                        <div className="text-xs text-gray-400">Msgs</div>
                      </div>
                      <div className="bg-green-600/20 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-green-400">{instance.contactCount}</div>
                        <div className="text-xs text-gray-400">Contatos</div>
                      </div>
                      <div className="bg-purple-600/20 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-purple-400">{instance.chatCount}</div>
                        <div className="text-xs text-gray-400">Chats</div>
                      </div>
                    </div>
                  )}

                  <div className="text-center text-xs text-gray-500">
                    {formatLastSeen(instance.lastSeen)}
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {instance.status === 'qr_code' && (
                    <Button variant="outline" size="sm" className="flex-1">QR Code</Button>
                  )}
                  <Button variant="ghost" size="sm">⚙️</Button>
                  <Button variant="ghost" size="sm">🗑️</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-gray-400">Após escolher, voltaremos ao layout normal das conexões</p>
      </div>
    </div>
  );
} 