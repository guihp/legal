export function normalizePropertyType(labelRaw: string): string {
	const l = (labelRaw || '').toLowerCase().trim();
	
	// Apartamentos e Condomínios
	if (l.includes('apart') || l.includes('condo') || l.includes('condom')) return 'Apartamento';
	
	// Casas e Sobrados
	if (l.includes('home') || l.includes('casa') || l.includes('sobrado')) return 'Casa/Sobrado';
	
	// Studios e Lofts  
	if (l.includes('duplex') || l.includes('triplex') || l.includes('flat') || l.includes('studio') || l.includes('kit') || l.includes('loft')) return 'Studio/Loft';
	
	// Terrenos e Lotes
	if (l.includes('landlot') || l.includes('land lot') || l.includes('land') || l.includes('terreno') || l.includes('lote')) return 'Terreno';
	
	// Comercial e Escritórios
	if (l.includes('comerc') || l.includes('loja') || l.includes('sala') || l.includes('office')) return 'Comercial';
	
	// Prédios e Edifícios
	if (l.includes('prédio') || l.includes('predio') || l.includes('edifício') || l.includes('edificio') || l.includes('building')) return 'Edifício';
	
	// Industrial e Galpões
	if (l.includes('industrial') || l.includes('galp')) return 'Industrial';
	
	// Rural e Agrícola
	if (l.includes('agric') || l.includes('rural') || l.includes('chácara') || l.includes('chacara') || l.includes('sítio') || l.includes('sitio') || l.includes('fazenda')) return 'Rural';
	
	// Garagens
	if (l.includes('garagem') || l.includes('garage') || l.includes('vaga')) return 'Garagem';
	
	// Cobertura
	if (l.includes('cobertura')) return 'Cobertura';
	
	// Hotel e Pousada
	if (l.includes('hotel') || l.includes('pousada')) return 'Hotel/Pousada';
	
	// Casos vazios
	if (!l.length) return 'Não informado';
	
	// Outros casos
	return 'Outros';
}
