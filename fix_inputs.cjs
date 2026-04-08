const fs = require('fs');
const file = '/Volumes/HD/CODE/legal/src/components/ConversasViewPremium.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Zap and Clock to imports
content = content.replace('AlertCircle\n} from \'lucide-react\';', 'AlertCircle,\n  Zap,\n  Clock\n} from \'lucide-react\';');

// 2. Add CountdownTimer component
const countdownCode = `
function CountdownTimer({ date }: { date: Date | null }) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setTimeLeft(null);
      return;
    }

    const calculate = () => {
      const now = Date.now();
      const diff = now - date.getTime();
      const limit = 24 * 60 * 60 * 1000;
      
      if (diff >= limit) {
        setTimeLeft(null);
      } else {
        const remaining = limit - diff;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeLeft(\`\${String(hours).padStart(2, '0')}:\${String(minutes).padStart(2, '0')}:\${String(seconds).padStart(2, '0')}\`);
      }
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [date]);

  if (!timeLeft) return <span className="text-[10px] text-red-500 font-semibold px-2 py-0.5 border border-red-500/20 rounded-xl bg-red-500/10 ml-2 whitespace-nowrap">Expirado</span>;

  return (
    <span className="text-[11px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-xl flex items-center gap-1 shadow-sm border border-blue-500/20 ml-2 whitespace-nowrap">
      <Clock className="w-3 h-3" /> {timeLeft}
    </span>
  );
}

// Variants de animação exatas`;

content = content.replace('// Variants de animação exatas', countdownCode);

// 3. Update the header
const headerTarget = `<span className="text-[var(--cv-text)] font-normal text-base truncate cursor-pointer hover:underline">
                    {currentConversation?.displayName || selectedLead?.name || selectedLead?.phone}
                  </span>`;
const headerReplacement = `<div className="flex items-center overflow-hidden">
                    <span className="text-[var(--cv-text)] font-normal text-base truncate cursor-pointer hover:underline">
                      {currentConversation?.displayName || selectedLead?.name || selectedLead?.phone}
                    </span>
                    {isApiOficialUser && <CountdownTimer date={lastHumanDate} />}
                  </div>`;
content = content.replace(headerTarget, headerReplacement);

// 4. Update the input area placeholder and style
const inputTarget = `<textarea
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={onTextareaKeyDown}
                  placeholder="Mensagem"
                  className="w-full bg-transparent border-none outline-none text-[var(--cv-input-text)] placeholder:text-[var(--cv-text-muted)] text-sm resize-none custom-scrollbar max-h-[100px]"
                  rows={1}
                  style={{ minHeight: '24px' }}
                />`;

const inputReplacement = `<textarea
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={onTextareaKeyDown}
                  placeholder={disableFreeText ? "Sessão expirada (24h). Digite '/' para templates" : "Mensagem"}
                  className={\`w-full bg-transparent border-none outline-none text-[var(--cv-input-text)] text-sm resize-none custom-scrollbar max-h-[100px] \${disableFreeText ? 'placeholder:text-red-400/80' : 'placeholder:text-[var(--cv-text-muted)]'}\`}
                  rows={1}
                  style={{ minHeight: '24px' }}
                />`;
content = content.replace(inputTarget, inputReplacement);

// 5. Add Zap button next to paperclip
const paperclipTarget = `<Button variant="ghost" size="icon" className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1" onClick={() => imgInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
              </Button>`;

const paperclipReplacement = `<Button variant="ghost" size="icon" className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1" onClick={() => imgInputRef.current?.click()} title="Anexar arquivo">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-[var(--cv-text-muted)] hover:bg-transparent rounded-full mb-1" onClick={() => setShowManageTemplatesModal(true)} title="Gerenciar Templates e Atalhos">
                <Zap className="h-5 w-5" />
              </Button>`;
content = content.replace(paperclipTarget, paperclipReplacement);

fs.writeFileSync(file, content);
console.log('Script ran successfully');
