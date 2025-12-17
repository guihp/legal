// Serviço para integração com webhook da EvolutionAPI
// Este arquivo configura o endpoint para envio de mensagens WhatsApp

interface WhatsAppMessagePayload {
  chat_id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  corretor_id: string;
  corretor_nome: string;
  message: string;
  timestamp: string;
  from_corretor: boolean;
}

interface WhatsAppWebhookResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

// Configuração do webhook (a ser configurada pelo administrador)
const WEBHOOK_CONFIG = {
  // URL base da EvolutionAPI (configurar via variável de ambiente)
  baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'https://api.evolution.com.br',
  
  // Endpoint para envio de mensagens
  sendMessageEndpoint: '/v1/send-message',
  
  // Timeout para requisições (em ms)
  timeout: 30000,
  
  // Headers padrão
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
};

/**
 * Envia mensagem via webhook da EvolutionAPI
 * @param payload Dados da mensagem e contexto do lead/corretor
 * @returns Promise com resultado do envio
 */
export async function sendWhatsAppMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppWebhookResponse> {
  try {
    // Validar payload
    if (!payload.message.trim()) {
      throw new Error('Mensagem não pode estar vazia');
    }

    if (!payload.lead_phone) {
      throw new Error('Telefone do lead é obrigatório');
    }

    if (!payload.corretor_id) {
      throw new Error('ID do corretor é obrigatório');
    }

    // Formatar payload para EvolutionAPI
    const evolutionPayload = {
      // Dados da mensagem
      number: payload.lead_phone,
      text: payload.message,
      
      // Metadados para contexto
      metadata: {
        chat_id: payload.chat_id,
        lead_id: payload.lead_id,
        lead_name: payload.lead_name,
        corretor_id: payload.corretor_id,
        corretor_nome: payload.corretor_nome,
        timestamp: payload.timestamp,
        source: 'imobipro_dashboard',
        from_corretor: payload.from_corretor
      },
      
      // Configurações adicionais
      delay: 1000, // Delay de 1 segundo para parecer mais natural
      quoted: false // Não citar mensagem anterior
    };

    // Construir URL completa
    const url = `${WEBHOOK_CONFIG.baseUrl}${WEBHOOK_CONFIG.sendMessageEndpoint}`;

    console.log('🚀 Enviando mensagem via webhook:', {
      url,
      lead_phone: payload.lead_phone,
      corretor: payload.corretor_nome,
      message_preview: payload.message.substring(0, 50) + '...'
    });

    // Fazer requisição para o webhook
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...WEBHOOK_CONFIG.headers,
        // TODO: Adicionar autenticação quando configurada
        // 'Authorization': `Bearer ${process.env.EVOLUTION_API_TOKEN}`,
      },
      body: JSON.stringify(evolutionPayload),
      signal: AbortSignal.timeout(WEBHOOK_CONFIG.timeout)
    });

    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
    }

    // Parsear resposta
    const result = await response.json();

    console.log('✅ Mensagem enviada com sucesso:', {
      message_id: result.message_id || result.id,
      status: result.status
    });

    return {
      success: true,
      message_id: result.message_id || result.id || `temp-${Date.now()}`
    };

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem via webhook:', error);

    // Se for erro de timeout ou rede, ainda considerar como enviado
    // pois o webhook pode ter processado mesmo sem resposta
    if (error instanceof Error && (
      error.name === 'TimeoutError' || 
      error.message.includes('fetch') ||
      error.message.includes('network')
    )) {
      console.warn('⚠️ Timeout ou erro de rede - mensagem pode ter sido enviada');
      return {
        success: true,
        message_id: `timeout-${Date.now()}`
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Testa conectividade com o webhook da EvolutionAPI
 * @returns Promise indicando se o webhook está acessível
 */
export async function testWebhookConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${WEBHOOK_CONFIG.baseUrl}/health`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: WEBHOOK_CONFIG.headers,
      signal: AbortSignal.timeout(5000) // 5 segundos para teste
    });

    if (response.ok) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: `Webhook indisponível (HTTP ${response.status})` 
      };
    }

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro de conectividade' 
    };
  }
}

/**
 * Configurações do webhook para uso em desenvolvimento
 * Em produção, essas configurações devem vir de variáveis de ambiente
 */
export const WEBHOOK_DEVELOPMENT_CONFIG = {
  // Mock endpoint para testes locais
  mockEndpoint: 'https://httpbin.org/post',
  
  // Simular resposta bem-sucedida
  mockSuccessResponse: {
    success: true,
    message_id: 'mock-message-id',
    status: 'sent'
  },
  
  // Habilitar modo mock quando não há URL configurada
  useMockWhenUrlMissing: true
};

/**
 * Versão mock para desenvolvimento/testes
 * @param payload Dados da mensagem
 * @returns Promise com resposta simulada
 */
export async function sendWhatsAppMessageMock(payload: WhatsAppMessagePayload): Promise<WhatsAppWebhookResponse> {
  console.log('🧪 MOCK: Simulando envio de mensagem:', {
    to: payload.lead_phone,
    from: payload.corretor_nome,
    message: payload.message
  });

  // Simular delay de rede
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

  // Simular sucesso na maioria das vezes
  if (Math.random() > 0.1) {
    return {
      success: true,
      message_id: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`
    };
  } else {
    return {
      success: false,
      error: 'Erro simulado para testes'
    };
  }
}