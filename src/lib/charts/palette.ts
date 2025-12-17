export const chartPalette = {
	// Tons base em oklch para boa performance no dark
	primary: '#60a5fa',      // blue-400
	primaryAlt: '#3b82f6',   // blue-500
	secondary: '#a855f7',    // purple-500
	tertiary: '#06b6d4',     // cyan-500
	accent: '#34d399',       // emerald-400
	accentAlt: '#10b981',    // emerald-500
	warn: '#f59e0b',         // amber-500
	danger: '#f43f5e',       // rose-500
	muted: '#64748b',        // slate-500
	grid: 'rgba(148, 163, 184, 0.12)',
	axis: 'rgba(226, 232, 240, 0.25)',
	// Cores de texto
	textPrimary: '#f1f5f9',  // slate-100
	textSecondary: '#94a3b8', // slate-400
	// Background
	background: '#1e293b',   // slate-800
};

// Paleta diversificada para gráfico de pizza com maior contraste
export const pieChartColors = [
	'#3b82f6',  // blue-500 (azul forte)
	'#f59e0b',  // amber-500 (amarelo/laranja)
	'#10b981',  // emerald-500 (verde)
	'#f43f5e',  // rose-500 (vermelho/rosa)
	'#8b5cf6',  // violet-500 (roxo)
	'#06b6d4',  // cyan-500 (ciano)
	'#84cc16',  // lime-500 (verde limão)
	'#f97316',  // orange-500 (laranja)
	'#ec4899',  // pink-500 (rosa forte)
	'#6366f1',  // indigo-500 (índigo)
];

export const availabilityColors = {
	disponivel: '#22c55e',
	indisponivel: '#ef4444',
	reforma: '#eab308',
};

export const gradientStops = {
	vgv: [
		{ offset: 0, color: 'rgba(96, 165, 250, 0.25)' },
		{ offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
	],
	bar: [
		{ offset: 0, color: 'rgba(52, 211, 153, 0.85)' },
		{ offset: 1, color: 'rgba(16, 185, 129, 0.55)' },
	],
};


