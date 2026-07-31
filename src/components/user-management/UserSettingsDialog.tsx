import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ChatInstanceOption = { label: string; key: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: ChatInstanceOption[];
  chatInstance: string;
  onChatInstanceChange: (value: string) => void;
  onSave: () => void;
};

export function UserSettingsDialog({
  open,
  onOpenChange,
  instances,
  chatInstance,
  onChatInstanceChange,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-background">
        <DialogHeader>
          <DialogTitle>Definições do Usuário</DialogTitle>
          <DialogDescription>
            Atribua instância de chat e outras integrações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Instância de Chat</Label>
            <Select value={chatInstance || undefined} onValueChange={onChatInstanceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.key} value={inst.key}>
                    {inst.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Em breve: atribuição de conexões, agendas e outras integrações.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
