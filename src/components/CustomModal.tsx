import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, X, User, Clock, MapPin } from "lucide-react";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'warning' | 'error' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  onConfirm,
  confirmText = "OK",
  cancelText = "Cancelar",
  showCancel = false
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-12 w-12 text-emerald-700 mx-auto mb-4" />;
      case 'warning':
        return <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />;
      case 'error':
        return <X className="h-12 w-12 text-red-400 mx-auto mb-4" />;
      case 'confirm':
        return <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4 animate-pulse" />;
      default:
        return null;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-200/80',
          button: 'bg-emerald-800 hover:bg-emerald-700 text-white'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-600/20 border-yellow-500/30',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        };
      case 'error':
        return {
          bg: 'bg-red-600/20 border-red-500/30',
          button: 'bg-red-600 hover:bg-red-700'
        };
      case 'confirm':
        return {
          bg: 'bg-red-600/15 border-red-500/30',
          button: 'bg-red-600 hover:bg-red-700'
        };
      default:
        return {
          bg: 'bg-gray-600/20 border-gray-500/30',
          button: 'bg-gray-600 hover:bg-gray-700'
        };
    }
  };

  const colors = getColorClasses();

  const lines = (message || '').split('\n').map(l => l.trim()).filter(Boolean);
  const isSuccess = type === 'success';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-md rounded-2xl shadow-2xl ${
        isSuccess
          ? 'bg-[#F7F5F0] border border-emerald-200/80 text-emerald-950'
          : 'bg-gradient-to-br from-gray-950 to-gray-900 border border-gray-800/80 text-white'
      }`}>
        <DialogHeader className={`pb-2 ${isSuccess ? 'border-b border-emerald-200/60' : 'border-b border-gray-700/60'}`}>
          <div className="text-center">
            {getIcon()}
            <DialogTitle className={`text-2xl font-extrabold mb-1 tracking-wide ${isSuccess ? 'text-emerald-950' : 'text-white'}`}>
              {title}
            </DialogTitle>
            {type !== 'confirm' && (
              <DialogDescription className={`text-base ${isSuccess ? 'text-emerald-800' : 'text-gray-300'}`}>
                {message}
              </DialogDescription>
            )}
            {type === 'confirm' && (
              <DialogDescription className="text-gray-300 text-base">
                Esta ação é irreversível. Revise os detalhes antes de confirmar.
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <div className={`${type === 'confirm' ? 'mt-6' : 'mt-4'} space-y-4`}>
          {type === 'confirm' && (
            <div className={`relative p-4 rounded-2xl border ${colors.bg} shadow-inner`}>
              <div className="absolute -inset-px rounded-2xl border border-red-500/20 pointer-events-none"></div>
              <div className="space-y-2">
                {lines.length > 0 ? (
                  lines.map((line, idx) => {
                    let Icon = User as any;
                    if (/im[oó]vel/i.test(line)) Icon = MapPin;
                    if (/data/i.test(line)) Icon = Clock;
                    return (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <Icon className="h-4 w-4 mt-0.5 text-gray-400" />
                        <span className="text-gray-200">{line}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-400 text-sm">Sem detalhes adicionais.</div>
                )}
              </div>
              <div className="mt-3 text-xs text-red-300/90 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                <span>Ao confirmar, o evento será removido do Google Calendar e do sistema.</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {showCancel && (
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-all"
              >
                {cancelText}
              </Button>
            )}
            <Button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className={`flex-1 ${colors.button} shadow-md hover:shadow-lg transition-transform hover:scale-[1.02]`}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 