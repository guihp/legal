import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    User, Mail, Phone, FileText, MapPin,
    Building2, Star, DollarSign, Calendar, MessageSquare, Edit
} from "lucide-react"; // Icons
import { supabase } from '@/integrations/supabase/client';

interface LeadDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string | null;
}

export function LeadDetailsModal({ isOpen, onClose, leadId }: LeadDetailsModalProps) {
    const [lead, setLead] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && leadId) {
            fetchLeadDetails();
        } else {
            setLead(null);
        }
    }, [isOpen, leadId]);

    const fetchLeadDetails = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('leads')
                .select('*, corretor:id_corretor_responsavel(nome, role)')
                .eq('id', leadId)
                .single();

            if (error) throw error;
            setLead(data);
        } catch (err) {
            console.error('Erro ao buscar detalhes do lead:', err);
        } finally {
            setLoading(false);
        }
    };

    // Helpers de cor (mantendo consistência visual)
    const getStageColor = (stage: string) => {
        switch (stage) {
            case 'Fechado': return 'bg-green-100 text-green-800 border-green-300';
            case 'Em Atendimento': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'Reunião Agendada': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'Novo Lead': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'Perdido': return 'bg-red-100 text-red-800 border-red-300';
            case 'Desistiu': return 'bg-gray-100 text-gray-800 border-gray-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getSourceColor = (source: string) => {
        return 'bg-gray-100 text-gray-800 border-gray-300'; // Simplificado
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl bg-gray-900/95 border-gray-700/50 text-white">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                        {loading ? (
                            <span>Carregando...</span>
                        ) : (
                            <>
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                                    <span className="text-white font-semibold">
                                        {lead?.nome?.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                    </span>
                                </div>
                                {lead?.nome}
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {!loading && lead && (
                    <div className="space-y-6 py-4">
                        {/* Status e Badges */}
                        <div className="flex gap-3 flex-wrap">
                            <Badge variant="outline" className={getStageColor(lead.stage)}>
                                {lead.stage}
                            </Badge>
                            <Badge variant="outline" className={getSourceColor(lead.origem)}>
                                {lead.origem || 'Origem não informada'}
                            </Badge>
                        </div>

                        {/* Informações em Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Dados Pessoais */}
                            <Card className="bg-gray-800/50 border-gray-700/60">
                                <CardContent className="p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <User className="h-5 w-5 text-blue-400" />
                                        Dados Pessoais
                                    </h3>
                                    <div className="space-y-3">
                                        {lead.email && (
                                            <div className="flex items-center gap-3">
                                                <Mail className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-300">{lead.email}</span>
                                            </div>
                                        )}
                                        {lead.telefone && (
                                            <div className="flex items-center gap-3">
                                                <Phone className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-300">{lead.telefone}</span>
                                            </div>
                                        )}
                                        {lead.cpf && (
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-300">CPF: {lead.cpf}</span>
                                            </div>
                                        )}
                                        {lead.estado_civil && (
                                            <div className="flex items-center gap-3">
                                                <User className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-300">Estado Civil: {lead.estado_civil}</span>
                                            </div>
                                        )}
                                        {lead.endereco && (
                                            <div className="flex items-center gap-3">
                                                <MapPin className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-300">{lead.endereco}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Informações do Negócio */}
                            <Card className="bg-gray-800/50 border-gray-700/60">
                                <CardContent className="p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-green-400" />
                                        Informações do Negócio
                                    </h3>
                                    <div className="space-y-3">
                                        {lead.interesse && (
                                            <div className="flex items-center gap-3">
                                                <Star className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-300">Interesse: {lead.interesse}</span>
                                            </div>
                                        )}
                                        {(lead.valorEstimado || lead.valor) && (
                                            <div className="flex items-center gap-3">
                                                <DollarSign className="h-4 w-4 text-gray-400" />
                                                <span className="text-gray-300">
                                                    Valor Estimado: R$ {(lead.valorEstimado || lead.valor || 0).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-4 w-4 text-gray-400" />
                                            <span className="text-gray-300">
                                                Cadastro: {new Date(lead.created_at || lead.dataContato).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Observações */}
                        {lead.observacoes && (
                            <Card className="bg-gray-800/50 border-gray-700/60">
                                <CardContent className="p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5 text-purple-400" />
                                        Observações
                                    </h3>
                                    <p className="text-gray-300 leading-relaxed">{lead.observacoes}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Actions Footer */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="border-gray-600 text-red-400 hover:bg-gray-800 hover:text-red-300"
                            >
                                Fechar
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
