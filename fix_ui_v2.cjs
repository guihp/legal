const fs = require('fs');
const file = '/Volumes/HD/CODE/legal/src/components/ConversasViewPremium.tsx';
let content = fs.readFileSync(file, 'utf8');

const sendTextTarget = `  const sendText = async () => {
    const val = messageInput.trim();
    if (!val) return;
    if (!selectedConversation && !selectedLead) return;`;

const sendTextReplacement = `  const sendText = async () => {
    const val = messageInput.trim();
    if (!val) return;
    if (!selectedConversation && !selectedLead) return;

    if (disableFreeText) {
      // Find if message matches a template marked as is_official_api
      // It must be an exact match (or practically exact)
      const usedTemplate = templates.find(t => t.is_official_api && typeof t.message === 'string' && val.includes(t.message.trim()));
      
      if (!usedTemplate) {
        toast({
          title: "Operação Bloqueada",
          description: "Sessão expirada. Apenas templates aprovados na API Oficial podem ser enviados.",
          variant: "destructive"
        });
        return;
      }
    }`;

content = content.replace(sendTextTarget, sendTextReplacement);

const onKeyDownTarget = `    if ((e.key === "Enter" && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
      e.preventDefault();
      if (!busy) {
        if (disableFreeText && !messageInput.startsWith('/')) {
          toast({
            title: "Operação Bloqueada",
            description: "Você só pode enviar templates configurados (use /) pois a última mensagem tem mais de 24h.",
            variant: "destructive"
          });
          return;
        }
        sendText();
      }
    }`;

const onKeyDownReplacement = `    if ((e.key === "Enter" && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
      e.preventDefault();
      if (!busy) {
        sendText();
      }
    }`;

content = content.replace(onKeyDownTarget, onKeyDownReplacement);

fs.writeFileSync(file, content);
console.log('Update Complete v2');
