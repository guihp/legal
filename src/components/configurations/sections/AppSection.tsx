import { PersonalAppSettings } from '../PersonalAppSettings';

/**
 * Configurações → Aplicativo (instalação PWA + push pessoal).
 * Acessível a todos os roles; salva direto (não usa o Salvar da toolbar).
 */
export function AppSection() {
  return <PersonalAppSettings />;
}
