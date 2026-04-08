const fs = require('fs');
const file = '/Volumes/HD/CODE/legal/src/hooks/useChatTemplates.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Update interface
content = content.replace(
`  message: string;
  created_at: string;`,
`  message: string;
  is_official_api: boolean;
  created_at: string;`
);

// 2. addTemplate
content = content.replace(
`  const addTemplate = async (shortcut: string, message: string) => {`,
`  const addTemplate = async (shortcut: string, message: string, isOfficialApi: boolean = false) => {`
);
content = content.replace(
`        .insert([{ company_id: profile.company_id, shortcut: formattedShortcut, message }])`,
`        .insert([{ company_id: profile.company_id, shortcut: formattedShortcut, message, is_official_api: isOfficialApi }])`
);

// 3. updateTemplate
content = content.replace(
`  const updateTemplate = async (id: string, shortcut: string, message: string) => {`,
`  const updateTemplate = async (id: string, shortcut: string, message: string, isOfficialApi: boolean = false) => {`
);
content = content.replace(
`        .update({ shortcut: formattedShortcut, message })`,
`        .update({ shortcut: formattedShortcut, message, is_official_api: isOfficialApi })`
);
content = content.replace(
`      setTemplates(prev => prev.map(t => t.id === id ? { ...t, shortcut: formattedShortcut, message } : t));`,
`      setTemplates(prev => prev.map(t => t.id === id ? { ...t, shortcut: formattedShortcut, message, is_official_api: isOfficialApi } : t));`
);

fs.writeFileSync(file, content);
console.log('Updated useChatTemplates.ts successfully');
