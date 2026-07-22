/**
 * Short, readable labels for `leads.imovel_interesse`.
 * Values are often full "FICHA TÉCNICA" dumps — never dump that into chart tooltips/legends.
 */

function extractField(text: string, fieldPattern: string): string | null {
	const re = new RegExp(`${fieldPattern}:\\s*([^\\n]+)`, 'i');
	const match = text.match(re);
	if (!match?.[1]) return null;
	return match[1].replace(/\s+/g, ' ').trim() || null;
}

function truncateLabel(label: string, maxLen: number): string {
	const cleaned = label.replace(/\s+/g, ' ').trim();
	if (cleaned.length <= maxLen) return cleaned;
	return `${cleaned.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

/** Build a concise property label (tipo + bairro/cidade or área/quartos). Max ~72 chars. */
export function formatImovelInteresseLabel(raw: string, maxLen = 72): string {
	const text = (raw || '').trim();
	if (!text) return 'Imóvel';

	const looksLikeFicha =
		/ficha\s*t[eé]cnica/i.test(text) ||
		text.includes('\n') ||
		text.length > 80;

	if (!looksLikeFicha) {
		return truncateLabel(text, maxLen);
	}

	const tipo = extractField(text, 'Tipo de Im[oó]vel');
	const bairro = extractField(text, 'Bairro');
	const cidade = extractField(text, 'Cidade');
	const area = extractField(text, '[ÁA]rea Constru[ií]da');
	const quartos = extractField(text, 'Total de Quartos');

	const parts: string[] = [];
	if (tipo) parts.push(tipo);
	if (bairro) parts.push(bairro);
	else if (cidade) parts.push(cidade);
	if (area) parts.push(area);
	else if (quartos) parts.push(`${quartos} qtos`);

	if (parts.length > 0) {
		return truncateLabel(parts.join(' · '), maxLen);
	}

	return truncateLabel(text, maxLen);
}
