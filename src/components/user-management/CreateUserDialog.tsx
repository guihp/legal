import type { FormEvent } from 'react';
import { AlertTriangle, Loader2, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserRole } from './helpers';

export type CreateUserForm = {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  department: string;
  phone: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  form: CreateUserForm;
  onFieldChange: (field: keyof CreateUserForm, value: string) => void;
  isAdmin: boolean;
  isManager: boolean;
  loading: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
};

export function CreateUserDialog({
  open,
  onClose,
  form,
  onFieldChange,
  isAdmin,
  isManager,
  loading,
  error,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md border-border bg-background">
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
          <DialogDescription>Adicione um novo membro à empresa.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-full-name">Nome Completo *</Label>
            <Input
              id="create-full-name"
              value={form.full_name}
              onChange={(e) => onFieldChange('full_name', e.target.value)}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-email">Email *</Label>
            <Input
              id="create-email"
              type="email"
              value={form.email}
              onChange={(e) => onFieldChange('email', e.target.value)}
              placeholder="usuario@exemplo.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Este email recebe alertas de visitas agendadas.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-password">Senha Temporária</Label>
            <Input
              id="create-password"
              type="text"
              value={form.password}
              onChange={(e) => onFieldChange('password', e.target.value)}
              placeholder="Senha padrão para novos usuários"
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label>Cargo *</Label>
            <Select
              value={form.role}
              onValueChange={(value) => onFieldChange('role', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corretor">Corretor</SelectItem>
                {(isManager || isAdmin) && (
                  <SelectItem value="gestor">Gestor</SelectItem>
                )}
                {isAdmin && <SelectItem value="admin">Administrador</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-phone">Telefone</Label>
            <Input
              id="create-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => onFieldChange('phone', e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
