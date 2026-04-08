const fs = require('fs');
const file = '/Volumes/HD/CODE/legal/src/components/ConversasViewPremium.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetBlock = `  // Determinar restrição de API Oficial (24 horas)
  const isApiOficialUser = profile?.email?.toLowerCase().includes('jastelo') || profile?.email?.toLowerCase().includes('iafeoficial.com') || profile?.email?.toLowerCase().includes('iafeofocial.com');
  const activeMessages = selectedLead ? leadMessages : messages;
  const lastHumanMessage = activeMessages.slice().reverse().find((m: any) => m.message?.type === 'human');
    
  const lastHumanDate = lastHumanMessage ? new Date(lastHumanMessage.data) : null;
  const isPast24Hours = lastHumanDate ? (Date.now() - lastHumanDate.getTime()) > 24 * 60 * 60 * 1000 : false;
  const disableFreeText = Boolean(isApiOficialUser && isPast24Hours);`;

content = content.replace(targetBlock, '');

const insertTarget = `  const { messages, loading: loadingMessages, error: errorMessages, openSession, refetch: refetchMessages, setMyInstance } = useConversaMessages();`;

content = content.replace(insertTarget, insertTarget + "\n\n" + targetBlock);

fs.writeFileSync(file, content);
console.log('Update Complete v3 TDZ');
