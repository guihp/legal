const fs = require('fs');
const file = '/Volumes/HD/CODE/legal/src/components/ConversasViewPremium.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Checkbox import
content = content.replace(
`import { Textarea } from '@/components/ui/textarea';`,
`import { Textarea } from '@/components/ui/textarea';\nimport { Checkbox } from '@/components/ui/checkbox';`
);

// 2. Move condition up
const conditionsTarget = `  // Determinar restrição de API Oficial (24 horas)
  const isApiOficialUser = profile?.email?.toLowerCase().includes('jastelo') || profile?.email?.toLowerCase().includes('iafeoficial.com') || profile?.email?.toLowerCase().includes('iafeofocial.com');
  const activeMessages = selectedLead ? leadMessages : messages;
  const lastHumanMessage = activeMessages.slice().reverse().find((m: any) => m.message?.type === 'human');
    
  const lastHumanDate = lastHumanMessage ? new Date(lastHumanMessage.data) : null;
  const isPast24Hours = lastHumanDate ? (Date.now() - lastHumanDate.getTime()) > 24 * 60 * 60 * 1000 : false;
  const disableFreeText = Boolean(isApiOficialUser && isPast24Hours);`;

content = content.replace(conditionsTarget, '');

content = content.replace(
`  // Han`,
`  // Determinar restrição de API Oficial (24 horas)
  const isApiOficialUser = profile?.email?.toLowerCase().includes('jastelo') || profile?.email?.toLowerCase().includes('iafeoficial.com') || profile?.email?.toLowerCase().includes('iafeofocial.com');
  const activeMessages = selectedLead ? leadMessages : messages;
  const lastHumanMessage = activeMessages.slice().reverse().find((m: any) => m.message?.type === 'human');
    
  const lastHumanDate = lastHumanMessage ? new Date(lastHumanMessage.data) : null;
  const isPast24Hours = lastHumanDate ? (Date.now() - lastHumanDate.getTime()) > 24 * 60 * 60 * 1000 : false;
  const disableFreeText = Boolean(isApiOficialUser && isPast24Hours);

  // Han`
);

// 3. Filter templates in handleInputChange
const filterTarget = `const filtered = templates.filter(t => t.shortcut.toLowerCase().includes(query) || t.shortcut === '/');`;
const filterReplacement = `let validTemplates = templates;
        if (disableFreeText) {
          validTemplates = templates.filter(t => t.is_official_api);
        }
        const filtered = validTemplates.filter(t => t.shortcut.toLowerCase().includes(query) || t.shortcut === '/');`;
content = content.replace(filterTarget, filterReplacement);

// 4. Update the sendText validation to ensure they actually picked an official API template when required
const sendTextTarget = `    if (disableFreeText) {
      if (!messageInput.trim().startsWith('/')) {`;
const sendTextReplacement = `    if (disableFreeText) {
      // Find if message matches a template marked as is_official_api
      const usedTemplate = templates.find(t => t.is_official_api && typeof t.message === 'string' && messageInput.trim().includes(t.message));
      
      if (!usedTemplate) {`;
content = content.replace(sendTextTarget, sendTextReplacement);

// 5. Add state for modal
content = content.replace(
`  const [showManageTemplatesModal, setShowManageTemplatesModal] = useState(false);`,
`  const [showManageTemplatesModal, setShowManageTemplatesModal] = useState(false);
  const [isOfficialApiNew, setIsOfficialApiNew] = useState(false);`
);

// 6. Update the Modal UI to include Checkbox for new template
const modalAddTarget = `<div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Input id="newShortcut" placeholder="Atalho (ex: /ola)" className="w-1/3 bg-[var(--cv-input-bg)] border-[var(--cv-border)] text-[var(--cv-input-text)]" />
                    <Input id="newMessage" placeholder="Mensagem completa..." className="flex-1 bg-[var(--cv-input-bg)] border-[var(--cv-border)] text-[var(--cv-input-text)]" />
                    <Button 
                      onClick={() => {
                        const shortcut = (document.getElementById('newShortcut') as HTMLInputElement).value;
                        const msg = (document.getElementById('newMessage') as HTMLInputElement).value;
                        if (shortcut && msg) {
                          addTemplate(shortcut, msg);
                          (document.getElementById('newShortcut') as HTMLInputElement).value = '';
                          (document.getElementById('newMessage') as HTMLInputElement).value = '';
                        }
                      }}`;
const modalAddReplacement = `<div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Input id="newShortcut" placeholder="Atalho (ex: /ola)" className="w-1/3 bg-[var(--cv-input-bg)] border-[var(--cv-border)] text-[var(--cv-input-text)]" />
                    <Input id="newMessage" placeholder="Mensagem completa..." className="flex-1 bg-[var(--cv-input-bg)] border-[var(--cv-border)] text-[var(--cv-input-text)]" />
                    <Button 
                      onClick={() => {
                        const shortcut = (document.getElementById('newShortcut') as HTMLInputElement).value;
                        const msg = (document.getElementById('newMessage') as HTMLInputElement).value;
                        if (shortcut && msg) {
                          addTemplate(shortcut, msg, isOfficialApiNew);
                          // Reset state
                          (document.getElementById('newShortcut') as HTMLInputElement).value = '';
                          (document.getElementById('newMessage') as HTMLInputElement).value = '';
                          setIsOfficialApiNew(false);
                        }
                      }}`;
content = content.replace(modalAddTarget, modalAddReplacement);

const badgeInfoTarget = `<p className="text-xs text-[var(--cv-text-muted)]"><AlertCircle className="w-3 h-3 inline mr-1"/> O atalho deve começar com '/'</p>`;
const badgeInfoReplacement = `<div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-[var(--cv-text-muted)]"><AlertCircle className="w-3 h-3 inline mr-1"/> O atalho deve começar com '/'</p>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="isOfficialApi" checked={isOfficialApiNew} onCheckedChange={(checked) => setIsOfficialApiNew(checked as boolean)} />
                      <label htmlFor="isOfficialApi" className="text-xs font-medium leading-none text-[#1b4332] dark:text-[#a0c49d] bg-[#d8f3dc] dark:bg-[#2d6a4f] px-2 py-0.5 rounded cursor-pointer">
                        Validado na API Oficial
                      </label>
                    </div>
                  </div>`;
content = content.replace(badgeInfoTarget, badgeInfoReplacement);

// 7. Render a badge in the templates list
const loopBadgeTarget = `<Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{t.shortcut}</Badge>`;
const loopBadgeReplacement = `<Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{t.shortcut}</Badge>
                        {t.is_official_api && <Badge variant="outline" className="text-[10px] bg-[#d8f3dc] text-[#1b4332] border-[#74c69d] dark:bg-[#1b4332] dark:text-[#d8f3dc]">API Oficial</Badge>}`;
content = content.replace(loopBadgeTarget, loopBadgeReplacement);

// 8. Render badge in autocomplete menu
const autocompleteBadgeTarget = `<Badge variant="outline" className="text-xs bg-[var(--cv-accent)] text-white border-none">{t.shortcut}</Badge>`;
const autocompleteBadgeReplacement = `<Badge variant="outline" className="text-xs bg-[var(--cv-accent)] text-white border-none shrink-0">{t.shortcut}</Badge>
                          {t.is_official_api && <Badge variant="outline" className="text-[9px] bg-[#d8f3dc] text-[#1b4332] border-none ml-1 shrink-0 px-1 py-0 h-4">API Oficial</Badge>}`;
content = content.replace(autocompleteBadgeTarget, autocompleteBadgeReplacement);

fs.writeFileSync(file, content);
console.log('Update Complete');
