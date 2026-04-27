// Lista canônica de "features" / amenidades de imóvel.
//
// IMPORTANTE: o `value` é o termo em INGLÊS gravado em `imoveisvivareal.features`
// (coluna `text[]`). O agente n8n (tool `buscar_por_features`) faz
//   ILIKE '%<feature>%' em features::text
// usando o termo em inglês — então qualquer alteração aqui precisa estar
// alinhada com a description daquela tool. O `label` é só o texto PT exibido
// no UI.
//
// Mapeamento atual PT → EN (mantenha sincronizado com a description da tool
// `buscar_por_features` no n8n):
//   piscina=Pool, churrasqueira=BBQ, academia=Gym, playground=Playground,
//   salão de festas=Party Room, elevador=Elevator, área gourmet=Gourmet Area,
//   varanda/sacada=Balcony, garagem coberta=Parking Garage,
//   quarto de empregada=Maid's Quarters, mobiliado=Furnished,
//   ar condicionado=Air Conditioning, sauna=Sauna, quadra esportiva=Sports Court,
//   espaço pet=Pet Area, salão de jogos=Game Room, sala de cinema=Cinema Room,
//   portaria 24h=24h Concierge, câmeras de segurança=Security Cameras,
//   vista para o mar=Sea View, hidromassagem=Jacuzzi, lareira=Fireplace,
//   closet=Closet, lavabo=Half Bath, home office=Home Office,
//   energia solar=Solar Energy, cobertura=Penthouse,
//   bicicletário=Bike Rack, aceita pets=Pets Allowed
export const FEATURE_OPTIONS = [
  // Áreas comuns / lazer
  { value: 'Pool',             label: 'Piscina' },
  { value: 'BBQ',              label: 'Churrasqueira' },
  { value: 'Gym',              label: 'Academia' },
  { value: 'Sauna',            label: 'Sauna' },
  { value: 'Playground',       label: 'Playground' },
  { value: 'Party Room',       label: 'Salão de festas' },
  { value: 'Game Room',        label: 'Salão de jogos' },
  { value: 'Cinema Room',      label: 'Sala de cinema' },
  { value: 'Sports Court',     label: 'Quadra esportiva' },
  { value: 'Gourmet Area',     label: 'Área gourmet' },
  { value: 'Pet Area',         label: 'Espaço pet' },

  // Estrutura do imóvel
  { value: 'Elevator',         label: 'Elevador' },
  { value: 'Balcony',          label: 'Varanda / Sacada' },
  { value: 'Parking Garage',   label: 'Garagem coberta' },
  { value: 'Bike Rack',        label: 'Bicicletário' },
  { value: 'Closet',           label: 'Closet' },
  { value: 'Half Bath',        label: 'Lavabo' },
  { value: 'Home Office',      label: 'Home office' },
  { value: "Maid's Quarters",  label: 'Quarto de empregada' },
  { value: 'Penthouse',        label: 'Cobertura' },
  { value: 'Fireplace',        label: 'Lareira' },
  { value: 'Jacuzzi',          label: 'Hidromassagem' },

  // Conforto / sustentabilidade / regras
  { value: 'Furnished',        label: 'Mobiliado' },
  { value: 'Air Conditioning', label: 'Ar condicionado' },
  { value: 'Solar Energy',     label: 'Energia solar' },
  { value: 'Pets Allowed',     label: 'Aceita pets' },

  // Segurança / vista
  { value: '24h Concierge',    label: 'Portaria 24h' },
  { value: 'Security Cameras', label: 'Câmeras de segurança' },
  { value: 'Sea View',         label: 'Vista para o mar' },
] as const;

export type ImovelFeatureValue = typeof FEATURE_OPTIONS[number]['value'];

/** Retorna o label PT a partir do value EN; se não casar, devolve o próprio value. */
export function featureLabel(value: string): string {
  return FEATURE_OPTIONS.find((f) => f.value === value)?.label ?? value;
}
