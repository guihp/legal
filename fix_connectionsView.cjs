const fs = require('fs');
const file = '/Volumes/HD/CODE/legal/src/components/ConnectionsViewSimplified.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update isOfficialApi check
const checkTarget = `  const isOfficialApi = profile?.email === 'jastelo@iafeoficial.com';`;
const checkReplacement = `  const isOfficialApi = profile?.email?.toLowerCase().includes('jastelo') || profile?.email?.toLowerCase().includes('iafeoficial.com') || profile?.email?.toLowerCase().includes('iafeofocial.com');`;
content = content.replace(checkTarget, checkReplacement);

// 2. Import OfficialApiConnectionsView
const importTarget = `import { Textarea } from "./ui/textarea";`;
const importReplacement = `import { Textarea } from "./ui/textarea";\nimport { OfficialApiConnectionsView } from "./OfficialApiConnectionsView";`;
content = content.replace(importTarget, importReplacement);

// 3. Early return OfficialApiConnectionsView if isOfficialApi
const renderTarget = `  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block">
          <Smartphone className="h-8 w-8 text-blue-400" />
        </div>
        <p className="ml-3 text-gray-400">Carregando conexões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-0 bg-background text-foreground">`;

const renderReplacement = `  if (isOfficialApi) {
    return <OfficialApiConnectionsView />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block">
          <Smartphone className="h-8 w-8 text-blue-400" />
        </div>
        <p className="ml-3 text-gray-400">Carregando conexões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-0 bg-background text-foreground">`;
    
content = content.replace(renderTarget, renderReplacement);

fs.writeFileSync(file, content);
console.log('Update Complete Conenctions View');
