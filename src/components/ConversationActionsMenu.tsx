import React from 'react';
import { MoreVertical, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ConversationActionsMenuProps {
  conversation: any;
  onGenerateSummary: (conversation: any) => void;
  onFollowUp: (conversation: any) => void;
}

export function ConversationActionsMenu({ 
  conversation, 
  onGenerateSummary, 
  onFollowUp 
}: ConversationActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem 
          onClick={() => onGenerateSummary(conversation)}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" />
          Gerar resumo
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onFollowUp(conversation)}
          className="cursor-pointer"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Fazer follow up
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
