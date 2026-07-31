import { AlertTriangle, Edit } from 'lucide-react';
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

export type EditUserForm = {
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  form: EditUserForm | null;
  onFormChange: (next: EditUserForm) => void;
  isAdmin: boolean;
  error: string | null;
  onSave: () => void;
};

export function EditUserDialog({
  open,
  onOpenChange,
  userName,
  form,
  onFormChange,
  isAdmin,
  error,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize os dados de {userName || 'usuário'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="edit-full-name">Nome Completo</Label>
            <Input
              id="edit-full-name"
              value={form?.full_name || ''}
              onChange={(e) =>
                form && onFormChange({ ...form, full_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={form?.email || ''}
              onChange={(e) =>
                form && onFormChange({ ...form, email: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Este email recebe alertas de visitas agendadas.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Telefone</Label>
            <Input
              id="edit-phone"
              value={form?.phone || ''}
              onChange={(e) =>
                form && onFormChange({ ...form, phone: e.target.value })
              }
            />
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <Label>Hierarquia</Label>
              <Select
                value={form?.role || 'corretor'}
                onValueChange={(value: UserRole) =>
                  form && onFormChange({ ...form, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretor">Corretor</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave}>
            <Edit className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
