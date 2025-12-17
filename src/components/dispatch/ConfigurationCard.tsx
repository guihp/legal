import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff,
  Star,
  StarOff,
  Clock,
  Users,
  MessageSquare,
  Calendar,
  Zap
} from 'lucide-react';
import { DispatchConfiguration } from '@/lib/dispatch/types';
import { formatDuration, estimateDispatchDuration } from '@/lib/dispatch/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface ConfigurationCardProps {
  config: DispatchConfiguration;
  isSelected: boolean;
  isManager: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onSetDefault: () => void;
  onSelect?: () => void;
  index: number;
}

export function ConfigurationCard({
  config,
  isSelected,
  isManager,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActive,
  onSetDefault,
  onSelect,
  index
}: ConfigurationCardProps) {
  const estimatedTime = estimateDispatchDuration(100, config.intervalBetweenMessages, config.assignedBrokers.length);
  
  // Contar dias ativos na semana
  const activeDays = Object.values(config.timeWindows).filter(day => day?.enabled).length;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card 
        className={`bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all cursor-pointer ${
          isSelected ? 'ring-2 ring-emerald-500 border-emerald-500' : ''
        }`}
        onClick={onSelect}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-white text-lg">{config.name}</CardTitle>
                {config.isDefault && (
                  <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-400/50">
                    <Star className="w-3 h-3 mr-1" />
                    Padrão
                  </Badge>
                )}
                <Badge 
                  variant={config.isActive ? 'default' : 'outline'}
                  className={config.isActive 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' 
                    : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
                  }
                >
                  {config.isActive ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
              
              {config.description && (
                <p className="text-gray-400 text-sm">{config.description}</p>
              )}
            </div>

            {isManager && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="text-gray-400 hover:text-white"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDuplicate}
                  className="text-gray-400 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleActive}
                  className={config.isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}
                >
                  {config.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                </Button>

                {!config.isDefault && config.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSetDefault}
                    className="text-yellow-400 hover:text-yellow-300"
                  >
                    <StarOff className="w-4 h-4" />
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-gray-900 border-gray-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Deletar Configuração</AlertDialogTitle>
                      <AlertDialogDescription className="text-gray-400">
                        Tem certeza que deseja deletar a configuração "{config.name}"? 
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-gray-800 text-white border-gray-700">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={onDelete}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Deletar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <Users className="w-4 h-4" />
              <span>{config.assignedBrokers.length} corretor{config.assignedBrokers.length !== 1 ? 'es' : ''}</span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="w-4 h-4" />
              <span>{activeDays} dia{activeDays !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(estimatedTime)} (100 msgs)</span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-400">
              <Zap className="w-4 h-4" />
              <span>{config.maxMessagesPerHour}/h max</span>
            </div>
          </div>

          {config.messageTemplate && (
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-sm">Preview da mensagem:</span>
              </div>
              <p className="text-gray-300 text-sm italic line-clamp-2">
                {config.messageTemplate.length > 100 
                  ? `${config.messageTemplate.substring(0, 100)}...`
                  : config.messageTemplate
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
