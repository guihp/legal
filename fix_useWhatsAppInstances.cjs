const fs = require('fs');
const file = '/Volumes/HD/CODE/legal/src/hooks/useWhatsAppInstances.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `      if (!profile) return;

      // Buscar instâncias do endpoint externo`;

const replacement = `      if (!profile) return;

      const isOfficialApi = profile?.email?.toLowerCase().includes('jastelo') || profile?.email?.toLowerCase().includes('iafeoficial.com') || profile?.email?.toLowerCase().includes('iafeofocial.com');
      if (isOfficialApi) {
        setInstances([]);
        setLoading(false);
        return;
      }

      // Buscar instâncias do endpoint externo`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log('Update Complete hook bypass Evo API.');
