import { chartPalette } from './palette';

export const gridStyle = { stroke: chartPalette.grid } as const;

export const tooltipSlotProps = {
	popper: {
		modifiers: [
			{ name: 'offset', options: { offset: [0, 8] } },
		],
		sx: {
			'.MuiTooltip-tooltip': {
				backgroundColor: chartPalette.background,
				border: `1px solid ${chartPalette.grid}`,
				borderRadius: '12px',
				boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.25)',
				color: chartPalette.textPrimary,
				fontSize: '0.875rem',
				fontWeight: 500,
				padding: '12px 16px',
				maxWidth: '280px',
				'& .MuiTooltip-arrow': {
					color: chartPalette.background,
				},
			},
		},
	},
} as const;

// Tooltip personalizado para VGV
export const vgvTooltipSlotProps = {
	popper: {
		modifiers: [
			{ name: 'offset', options: { offset: [0, 8] } },
		],
		sx: {
			'.MuiTooltip-tooltip': {
				backgroundColor: chartPalette.background,
				border: `1px solid ${chartPalette.primaryAlt}`,
				borderRadius: '12px',
				boxShadow: '0px 12px 32px rgba(59, 130, 246, 0.15)',
				color: chartPalette.textPrimary,
				fontSize: '0.875rem',
				fontWeight: 500,
				padding: '16px 20px',
				maxWidth: '320px',
				'& .MuiTooltip-arrow': {
					color: chartPalette.background,
				},
				'&:before': {
					content: '""',
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					height: '3px',
					background: `linear-gradient(90deg, ${chartPalette.primaryAlt}, ${chartPalette.accent})`,
					borderRadius: '12px 12px 0 0',
				},
			},
		},
	},
} as const;

export const currencyValueFormatter = (v: number) => {
	if (!Number.isFinite(v)) return 'R$ 0';
	if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
	if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
	if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
	return `R$ ${v.toFixed(0)}`;
};

export const numberValueFormatter = (v: number) => `${Number(v || 0).toLocaleString('pt-BR')}`;


