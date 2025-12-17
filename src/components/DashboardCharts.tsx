import React from "react";
import { ChartContainer } from '@mui/x-charts/ChartContainer';
import { ChartsLegend, ChartsAxis, ChartsTooltip, ChartsGrid, ChartsAxisHighlight } from '@mui/x-charts';
import { BarChart, BarPlot } from '@mui/x-charts/BarChart';
import { LinePlot, AreaPlot } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrencyCompact, monthLabel } from '@/lib/charts/formatters';
import { chartPalette, pieChartColors } from '@/lib/charts/palette';
import { gridStyle, tooltipSlotProps, vgvTooltipSlotProps, currencyValueFormatter, numberValueFormatter } from '@/lib/charts/config';
import { supabase } from '@/integrations/supabase/client';
import { 
  fetchDistribuicaoPorTipo, 
  fetchFunilLeads, 
  fetchHeatmapConversas, 
  fetchCorretoresComConversas, 
  fetchHeatmapConversasPorCorretor, 
  fetchLeadsPorCanalTop8, 
  fetchLeadsPorCorretor, 
  fetchLeadsCorretorEstagio, 
  fetchLeadsPorTempo, 
  fetchLeadsSemCorretor, 
  fetchTaxaOcupacao, 
  fetchImoveisMaisProcurados, 
  fetchVgvByPeriod,
  generateTemporalFallback,
  type VgvPeriod, 
  type TimeRange 
} from '@/services/dashboardAdapter';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  ChartEmpty, 
  ChartError, 
  ChartSkeleton,
  ChartEmptyVariants,
  ChartErrorVariants,
  ChartSkeletonVariants
} from '@/components/chart';
import { useRealtimeDashboard } from '@/hooks/useRealtimeMetrics';

export const DashboardCharts: React.FC = () => {
	const [vgv, setVgv] = React.useState<{ month: string; vgv: number; qtd: number }[]>([]);
	const [canal, setCanal] = React.useState<{ name: string; value: number }[]>([]);
	const [tipos, setTipos] = React.useState<{ name: string; value: number }[]>([]);
	const [funil, setFunil] = React.useState<{ name: string; value: number }[]>([]);
	const [heat, setHeat] = React.useState<number[][]>([]);
	const [leadsTempo, setLeadsTempo] = React.useState<{ month: string; count: number }[]>([]);
	const [brokers, setBrokers] = React.useState<{ name: string; value: number }[]>([]);
	const [brokersStages, setBrokersStages] = React.useState<Map<string, Record<string, number>>>(new Map());
	const [selectedBrokers, setSelectedBrokers] = React.useState<Set<string>>(new Set());
	const [showBrokerSelection, setShowBrokerSelection] = React.useState(false);
	const [unassignedLeads, setUnassignedLeads] = React.useState<number>(0);
	const [gauge, setGauge] = React.useState<{
		ocupacao: number;
		total: number;
		disponiveis: number;
		reforma?: number;
		indisponiveis?: number;
		breakdown?: { status: string; total: number; percent: number }[]
	} | null>(null);

	// Estados para filtros e opções VGV
	const [vgvPeriod, setVgvPeriod] = React.useState<VgvPeriod>('mensal');
	const [vgvChartType, setVgvChartType] = React.useState<'area' | 'line' | 'bar' | 'combined'>('combined');
	
	// Estados para filtro de corretor no heatmap
	const [selectedBrokerForHeat, setSelectedBrokerForHeat] = React.useState<string>('');
	const [availableBrokers, setAvailableBrokers] = React.useState<{id: string, name: string}[]>([]);

	// Estados para filtro de tempo no gráfico temporal
	const [timeRange, setTimeRange] = React.useState<TimeRange>('total');

	// Estados para gráfico de disponibilidade/imóveis procurados
	const [showAvailabilityChart, setShowAvailabilityChart] = React.useState<boolean>(true);
	const [imoveisProcurados, setImoveisProcurados] = React.useState<{ id: string; name: string; value: number }[]>([]);

	// Estados para hover card de propriedade
	const [hoveredProperty, setHoveredProperty] = React.useState<any>(null);
	const [hoverPosition, setHoverPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

	// Estados de loading e error
	const [isLoading, setIsLoading] = React.useState(false);
	const [errors, setErrors] = React.useState<Record<string, Error | null>>({});

	// Função para buscar dados do heatmap com filtro de corretor
	const refetchHeatmapData = React.useCallback(() => {
		fetchHeatmapConversasPorCorretor(selectedBrokerForHeat || undefined)
			.then(setHeat)
			.catch(() => setHeat([]));
	}, [selectedBrokerForHeat]);

	// Função centralizada para recarregar todos os dados
	const refetchAllData = React.useCallback(async () => {
		setIsLoading(true);
		setErrors({});

		try {
			const fetchTasks = [
				{ key: 'vgv', task: () => fetchVgvByPeriod(vgvPeriod).then(setVgv) },
				{ key: 'canal', task: () => fetchLeadsPorCanalTop8().then(setCanal) },
				{ key: 'tipos', task: () => fetchDistribuicaoPorTipo().then(setTipos) },
				{ key: 'funil', task: () => fetchFunilLeads().then(setFunil) },
				{ key: 'brokers', task: () => fetchLeadsPorCorretor().then(setBrokers) },
				{ key: 'brokersStages', task: () => fetchLeadsCorretorEstagio().then(setBrokersStages) },
				{ key: 'unassigned', task: () => fetchLeadsSemCorretor().then(setUnassignedLeads) },
				{ key: 'leadsTempo', task: () => {
					console.log('🎯 [DashboardCharts] Executando fetchLeadsPorTempo para timeRange:', timeRange);
					return fetchLeadsPorTempo(timeRange).then((result) => {
						console.log('🎯 [DashboardCharts] setLeadsTempo recebeu:', result);
						setLeadsTempo(result);
					});
				}},
				{ key: 'gauge', task: () => fetchTaxaOcupacao().then(setGauge) },
				{ key: 'imoveis', task: () => fetchImoveisMaisProcurados().then(setImoveisProcurados) },
				{ key: 'availableBrokers', task: () => fetchCorretoresComConversas().then(setAvailableBrokers) }
			];

			const results = await Promise.allSettled(
				fetchTasks.map(({ task }) => task())
			);

			// Capturar erros específicos
			const newErrors: Record<string, Error | null> = {};
			results.forEach((result, index) => {
				if (result.status === 'rejected') {
					const { key } = fetchTasks[index];
					newErrors[key] = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
					
					// Definir valores padrão em caso de erro
					switch (key) {
						case 'vgv': setVgv([]); break;
						case 'canal': setCanal([]); break;
						case 'tipos': setTipos([]); break;
						case 'funil': setFunil([]); break;
						case 'brokers': setBrokers([]); break;
						case 'brokersStages': setBrokersStages(new Map()); break;
						case 'unassigned': setUnassignedLeads(0); break;
						case 'leadsTempo': setLeadsTempo([]); break;
						case 'gauge': setGauge({ ocupacao: 0, total: 0, disponiveis: 0 } as any); break;
						case 'imoveis': setImoveisProcurados([]); break;
						case 'availableBrokers': setAvailableBrokers([]); break;
					}
				}
			});

			setErrors(newErrors);
			
			// Buscar dados do heatmap separadamente
			try {
				await refetchHeatmapData();
			} catch (error) {
				setErrors(prev => ({ ...prev, heatmap: error instanceof Error ? error : new Error(String(error)) }));
			}

		} catch (error) {
			console.error('Erro geral ao carregar dados:', error);
			setErrors({ general: error instanceof Error ? error : new Error('Erro desconhecido') });
		} finally {
			setIsLoading(false);
		}
	}, [vgvPeriod, timeRange, refetchHeatmapData]);

	// Hook de realtime para atualizações automáticas
	const { isConnected: isRealtimeConnected, lastUpdate, updateCount } = useRealtimeDashboard(refetchAllData);

	// Effect para atualizar VGV quando período muda
	React.useEffect(() => {
		fetchVgvByPeriod(vgvPeriod).then(setVgv).catch(() => setVgv([]));
	}, [vgvPeriod]);

	// Dados temporais agora são carregados via refetchAllData

	// Função para buscar informações básicas do imóvel no hover
	const handlePropertyHover = async (imovelId: string, event: React.MouseEvent) => {
		try {
			const rect = event.currentTarget.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const cardWidth = 320; // Largura aproximada do card
			
			// Se não houver espaço à direita, mostrar à esquerda
			const x = rect.right + 10 + cardWidth > viewportWidth 
				? rect.left - cardWidth - 10 
				: rect.right + 10;
				
			setHoverPosition({
				x: Math.max(10, x), // Garantir que não saia da tela pela esquerda
				y: rect.top
			});

			// Buscar informações básicas do imóvel pelo listing_id
			const { data: property, error } = await supabase
				.from('imoveisvivareal')
				.select('id, listing_id, tipo_imovel, descricao, preco, tamanho_m2, quartos, banheiros, garagem, endereco, cidade, bairro')
				.eq('listing_id', imovelId) // O imovel_interesse contém o listing_id
				.single();
			
			if (error) {
				console.error('Erro ao buscar informações do imóvel:', error);
				return;
			}

			if (property) {
				setHoveredProperty(property);
			}
		} catch (error) {
			console.error('Erro ao buscar informações do imóvel:', error);
		}
	};

	// Função para limpar hover
	const handlePropertyHoverExit = () => {
		setHoveredProperty(null);
	};

	// Effect inicial para carregar dados
	React.useEffect(() => {
		refetchAllData();
	}, [refetchAllData]);

	const months = React.useMemo(() => {
		console.log('🎯 [DashboardCharts] months useMemo - vgv:', vgv);
		const result = vgv.map(v => {
			console.log('🎯 [DashboardCharts] Processando período:', v.month, 'para filtro:', vgvPeriod);
			
			// Formatação baseada no tipo de período
			switch (vgvPeriod) {
				case 'anual':
					return v.month; // "2025" -> "2025"
				case 'mensal':
					try {
						return monthLabel(v.month); // "2025-08" -> "ago/25"
					} catch {
						return v.month;
					}
				case 'semanal':
					// "2025-W8-18" -> "Sem 8/25"
					if (v.month.includes('-W')) {
						const parts = v.month.split('-');
						return `Sem ${parts[2]}/${parts[0].slice(-2)}`;
					}
					return v.month;
				case 'diario':
					// "2025-08-24" -> "24/08"
					try {
						const date = new Date(v.month);
						return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
					} catch {
						return v.month;
					}
				default:
					return v.month;
			}
		});
		console.log('🎯 [DashboardCharts] months result:', result);
		return result;
	}, [vgv, vgvPeriod]);
	
	// Dados de fallback para o gráfico temporal se não houver dados
	const tempoData = React.useMemo(() => {
		console.log('🎨 [DashboardCharts] tempoData useMemo - leadsTempo:', leadsTempo);
		if (leadsTempo.length > 0) {
			console.log('🎨 [DashboardCharts] Usando dados reais, count:', leadsTempo.length);
			return leadsTempo;
		}
		// Usar helper function para gerar fallback
		console.log('🎨 [DashboardCharts] Usando fallback temporal');
		return generateTemporalFallback(6);
	}, [leadsTempo]);

	// Processar dados dos corretores para gráfico de barras
	const brokersChartData = React.useMemo(() => {
		if (selectedBrokers.size === 0) {
			// Modo agrupado: agrupar por número de leads e mostrar quantidade de corretores
			const groupedData = new Map<number, string[]>();
			
			// Agrupar APENAS corretores reais (filtrar "Sem corretor" se houver)
			brokers
				.filter(broker => broker.name !== 'Sem corretor' && broker.name !== 'Nenhum corretor')
				.forEach(broker => {
					const leadsCount = broker.value;
					if (!groupedData.has(leadsCount)) {
						groupedData.set(leadsCount, []);
					}
					groupedData.get(leadsCount)!.push(broker.name);
				});
			
			const chartData = [];
			
			// Adicionar leads sem corretor se houver (primeira barra)
			if (unassignedLeads > 0) {
				chartData.push({
					name: 'Nenhum corretor',
					value: unassignedLeads,
					tooltip: `${unassignedLeads} lead${unassignedLeads !== 1 ? 's' : ''} não atribuído${unassignedLeads !== 1 ? 's' : ''}`,
					isUnassigned: true
				});
			}
			
			// Adicionar barras de corretores agrupados por quantidade de leads
			Array.from(groupedData.entries())
				.sort(([a], [b]) => a - b) // Ordenar por número de leads (menor primeiro)
				.forEach(([leadsCount, brokerNames]) => {
					chartData.push({
						name: `${brokerNames.length} corretor${brokerNames.length !== 1 ? 'es' : ''}`,
						value: leadsCount,
						tooltip: `${brokerNames.join(', ')} (${leadsCount} lead${leadsCount !== 1 ? 's' : ''} cada)`,
						isUnassigned: false
					});
				});
			
			return chartData;
		} else {
			// Modo comparativo: mostrar corretores selecionados com suas quantidades de leads
			return brokers
				.filter(broker => selectedBrokers.has(broker.name))
				.map(broker => ({
					name: broker.name.length > 12 ? broker.name.substring(0, 12) + '...' : broker.name,
					value: broker.value,
					tooltip: `${broker.name}: ${broker.value} lead${broker.value !== 1 ? 's' : ''}`,
					isUnassigned: false
				}));
		}
	}, [brokers, selectedBrokers, unassignedLeads]);

	const vgvSeriesConfig = React.useMemo(() => {
		console.log('🎯 [DashboardCharts] vgv data:', vgv);
		const vgvData = vgv.map(v => v.vgv);
		const qtdData = vgv.map(v => v.qtd);
		console.log('🎯 [DashboardCharts] vgvData:', vgvData);
		console.log('🎯 [DashboardCharts] qtdData:', qtdData);

		// Definição de gradientes
		const vgvGradient = `url(#vgv-gradient)`;
		const barGradient = `url(#bar-gradient)`;

		switch (vgvChartType) {
			case 'line':
				return {
					vgvSeries: [{ 
						type: 'line' as const, 
						id: 'vgv', 
						label: 'VGV', 
						data: vgvData, 
						color: chartPalette.primaryAlt, 
						showMark: true, 
						curve: 'monotoneX' as any, 
						lineWidth: 3 as any 
					}],
					convSeries: [] as any[]
				};
			case 'area':
				return {
					vgvSeries: [{ 
						type: 'line' as const, 
						id: 'vgv', 
						label: 'VGV', 
						data: vgvData, 
						color: vgvGradient, 
						area: true as any, 
						showMark: false as any, 
						curve: 'monotoneX' as any, 
						lineWidth: 2 as any 
					}],
					convSeries: [] as any[]
				};
			case 'bar':
				return {
					vgvSeries: [{ 
						type: 'bar' as const, 
						id: 'vgv', 
						label: 'VGV', 
						data: vgvData, 
						color: barGradient, 
						borderRadius: 6 as any 
					}],
					convSeries: [] as any[]
				};
			default: // combined
				return {
					vgvSeries: [{ 
						type: 'line' as const, 
						id: 'vgv', 
						label: 'VGV', 
						data: vgvData, 
						color: vgvGradient, 
						area: true as any, 
						showMark: false as any, 
						curve: 'monotoneX' as any, 
						lineWidth: 2 as any 
					}],
					convSeries: [{ 
						type: 'bar' as const, 
						id: 'conv', 
						label: 'Imóveis', 
						data: qtdData, 
						color: barGradient, 
						borderRadius: 4 as any 
					}]
				};
		}
	}, [vgv, vgvChartType]);

	// Helper para renderizar gráfico com estados de loading/error/empty
	const renderChartWithStates = (
		chartKey: string,
		data: any[],
		renderChart: () => React.ReactNode,
		emptyVariant: (height?: number) => React.ReactNode,
		height: number = 320
	) => {
		// Loading
		if (isLoading) {
			return ChartSkeletonVariants[chartKey as keyof typeof ChartSkeletonVariants]?.(height) || 
				   <ChartSkeleton height={height} />;
		}
		
		// Error
		if (errors[chartKey]) {
			return (
				<ChartError 
					height={height}
					error={errors[chartKey]}
					onRetry={() => {
						// Implementar retry específico aqui se necessário
						window.location.reload();
					}}
				/>
			);
		}
		
		// Empty
		if (!data || data.length === 0) {
			return emptyVariant(height);
		}
		
		// Render normal
		return renderChart();
	};

	const xAxisMonths = React.useMemo(() => [{ scaleType: 'band' as const, data: months, position: 'bottom' as const, valueFormatter: (v: string) => v }], [months]);
	const yAxisCurrency = React.useMemo(() => [{ 
		scaleType: 'linear' as const, 
		position: 'left' as const, 
		valueFormatter: (value: number) => {
			// Formato ultra compacto para evitar cortes
			if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(0)}B`;
			if (value >= 1_000_000) {
				const millions = value / 1_000_000;
				// Se for número redondo, não mostrar decimal
				return millions % 1 === 0 
					? `${millions.toFixed(0)}M`
					: `${millions.toFixed(1)}M`;
			}
			if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
			return value === 0 ? '0' : `${value.toFixed(0)}`;
		},
		tickLabelStyle: { 
			fill: chartPalette.textSecondary, 
			fontSize: 10, // Reduzido para 10px
			fontWeight: 500, // Reduzido para 500
			fontFamily: 'Inter, system-ui, sans-serif'
		},
		tickNumber: 5,
		nice: true
	}], []);



	// Matriz heatmap (7 x 24): 0=Seg ... 6=Dom (já normalizado em fetch)
	const heatMax = React.useMemo(() => {
		let m = 0;
		let total = 0;
		for (const row of heat) {
			for (const v of row) {
				m = Math.max(m, v || 0);
				total += (v || 0);
			}
		}
		// Heatmap com filtro por corretor implementado
		return m || 1;
	}, [heat]);

	return (
		<div className="grid grid-cols-1 xl:grid-cols-12 gap-6 p-6">  {/* Adicionar padding consistente */}
			<Card className="bg-gray-800/50 border-gray-700/50 xl:col-span-8">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<CardTitle className="text-white text-lg font-semibold">VGV e Imóveis</CardTitle>
							{/* Indicador de status realtime */}
							<div className="flex items-center gap-2">
								<div 
									className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}
									title={isRealtimeConnected ? 'Conectado - atualizações em tempo real' : 'Desconectado'}
								/>
								<span className="text-xs text-gray-400">
									{isRealtimeConnected ? 'Tempo real' : 'Offline'}
								</span>
								{updateCount > 0 && (
									<span className="text-xs text-green-400">
										{updateCount} atualizações
									</span>
								)}
							</div>
						</div>
						<div className="flex items-center gap-2">
							{/* Filtro de período */}
							<ToggleGroup 
								type="single" 
								value={vgvPeriod} 
								onValueChange={(value) => value && setVgvPeriod(value as VgvPeriod)}
								className="h-8"
							>
								<ToggleGroupItem value="anual" className="h-8 text-xs px-2 text-white data-[state=on]:bg-blue-600 data-[state=on]:text-white">Anual</ToggleGroupItem>
								<ToggleGroupItem value="mensal" className="h-8 text-xs px-2 text-white data-[state=on]:bg-blue-600 data-[state=on]:text-white">Mensal</ToggleGroupItem>
								<ToggleGroupItem value="semanal" className="h-8 text-xs px-2 text-white data-[state=on]:bg-blue-600 data-[state=on]:text-white">Semanal</ToggleGroupItem>
								<ToggleGroupItem value="diario" className="h-8 text-xs px-2 text-white data-[state=on]:bg-blue-600 data-[state=on]:text-white">Diário</ToggleGroupItem>
							</ToggleGroup>
							
							{/* Tipo de gráfico */}
							<ToggleGroup 
								type="single" 
								value={vgvChartType} 
								onValueChange={(value) => value && setVgvChartType(value as any)}
								className="h-8"
							>
								<ToggleGroupItem value="combined" className="h-8 text-xs px-2 text-white data-[state=on]:bg-emerald-600 data-[state=on]:text-white">Combo</ToggleGroupItem>
								<ToggleGroupItem value="area" className="h-8 text-xs px-2 text-white data-[state=on]:bg-emerald-600 data-[state=on]:text-white">Área</ToggleGroupItem>
								<ToggleGroupItem value="line" className="h-8 text-xs px-2 text-white data-[state=on]:bg-emerald-600 data-[state=on]:text-white">Linha</ToggleGroupItem>
								<ToggleGroupItem value="bar" className="h-8 text-xs px-2 text-white data-[state=on]:bg-emerald-600 data-[state=on]:text-white">Barra</ToggleGroupItem>
							</ToggleGroup>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="h-80 flex justify-center items-center" style={{ overflow: 'visible' }}>
						{renderChartWithStates(
							'vgv',
							vgv,
							() => (
								<ChartContainer
							xAxis={xAxisMonths}
							yAxis={[{ 
								...yAxisCurrency[0],
								width: 60  // Reduzido para dar mais espaço ao gráfico
							}]}
							series={[...vgvSeriesConfig.vgvSeries, ...(vgvSeriesConfig.convSeries.length > 0 ? [{ ...vgvSeriesConfig.convSeries[0], axisId: 'y2' as any }] : [])]}
							width={undefined as any}
							height={320}
							margin={{ 
								left: 80,   // Reduzido para centralizar melhor
								right: 40,  // Aumentado para equilibrar
								top: 20,    // Reduzido
								bottom: 50  // Aumentado para rótulos do eixo X
							}}
							style={{ width: '100%', maxWidth: '100%' }}
						>
							{/* Gradientes SVG */}
							<defs>
								<linearGradient id="vgv-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
									<stop offset="0%" stopColor={chartPalette.primaryAlt} stopOpacity={0.8} />
									<stop offset="50%" stopColor={chartPalette.primaryAlt} stopOpacity={0.4} />
									<stop offset="100%" stopColor={chartPalette.primaryAlt} stopOpacity={0.1} />
								</linearGradient>
								<linearGradient id="bar-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
									<stop offset="0%" stopColor={chartPalette.accent} stopOpacity={1} />
									<stop offset="100%" stopColor={chartPalette.accent} stopOpacity={0.7} />
								</linearGradient>
							</defs>
							
							<ChartsGrid vertical style={gridStyle} />
							{(vgvChartType === 'area' || vgvChartType === 'combined') && <AreaPlot />}
							{(vgvChartType === 'line' || vgvChartType === 'combined') && <LinePlot />}
							{(vgvChartType === 'bar' || vgvChartType === 'combined') && <BarPlot />}
							<ChartsAxis />
							<ChartsAxisHighlight x="line" />
							<ChartsLegend direction="horizontal" />
							<ChartsTooltip />
						</ChartContainer>
							),
							() => ChartEmptyVariants.vgv(320),
							320
						)}
					</div>
				</CardContent>
			</Card>

			<Card className="bg-gray-800/50 border-gray-700/50 xl:col-span-4">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-white">
						{showAvailabilityChart ? 'Taxa de Disponibilidade' : (
							<>
								Imóveis mais Procurados<br />
								(por ID)
							</>
						)}
					</CardTitle>
					<div className="flex items-center gap-2">
						<Button
							variant={showAvailabilityChart ? "default" : "outline"}
							size="sm"
							onClick={() => setShowAvailabilityChart(true)}
							className="text-xs"
						>
							Taxa
						</Button>
						<Button
							variant={!showAvailabilityChart ? "default" : "outline"}
							size="sm"
							onClick={() => setShowAvailabilityChart(false)}
							className="text-xs"
						>
							Procurados
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="h-72 relative">
						{showAvailabilityChart ? (
							renderChartWithStates(
								'gauge',
								gauge?.breakdown || [],
								() => (
									<PieChart
								series={[{ 
									data: (gauge?.breakdown || []).map((item, i) => ({ 
										id: item.status, 
										label: `${item.status} (${item.total})`,  // Incluir número na legenda
										value: item.total,
										color: pieChartColors[i % pieChartColors.length]  // Usar paleta diferenciada
									})),
									innerRadius: 65,    // Ajustado conforme diretrizes
									outerRadius: 110,   // Ajustado conforme diretrizes
									paddingAngle: 3,    // Mantido conforme especificado
									cornerRadius: 10    // Bordas mais suaves
								}]}
								margin={{ top: 40, bottom: 40, left: 80, right: 80 }}  // Margem para acomodar legenda
							/>
								),
								() => ChartEmptyVariants.occupancy(288),
								288
							)
						) : (
							renderChartWithStates(
								'imoveis',
								imoveisProcurados,
								() => (
							<div className="flex flex-col h-full">
								{/* Gráfico de barras horizontais */}
								<div className="flex-1">
									<ChartContainer
										xAxis={[{ 
											scaleType: 'linear', 
											position: 'bottom', 
											valueFormatter: (v: number) => `${Number(v||0)} leads`,
											tickLabelStyle: { fill: chartPalette.textSecondary, fontSize: '0.7rem' }
										}]}
										yAxis={[{ 
											scaleType: 'band', 
											position: 'left', 
											data: imoveisProcurados.map(i => i.id),
											tickLabelStyle: { 
												fill: chartPalette.textPrimary, 
												fontSize: '0.75rem', 
												fontWeight: 500,
												fontFamily: 'Inter, system-ui, sans-serif'
											}
										}]}
										series={imoveisProcurados.map((imovel, i) => {
											const colors = [
												'#60a5fa', '#fbbf24', '#34d399', '#fb7185', '#a78bfa', '#22d3ee'
											];
											return {
												type: 'bar' as const,
												data: imoveisProcurados.map(im => im.id === imovel.id ? imovel.value : 0),
												label: imovel.name,
												color: colors[i % colors.length],
												layout: 'horizontal' as const
											};
										})}
										height={180}
										margin={{
											left: 80,
											right: 40,
											top: 10,
											bottom: 20
										}}
									>
										<BarPlot />
										<ChartsAxis />
										<ChartsTooltip />
									</ChartContainer>
								</div>
								
								{/* Legenda clicável */}
								<div className="mt-4 flex flex-wrap gap-2 justify-center">
									{imoveisProcurados.map((imovel, i) => {
										const colors = [
											'#60a5fa', '#fbbf24', '#34d399', '#fb7185', '#a78bfa', '#22d3ee'
										];
										return (
											<div
												key={imovel.id}
												onMouseEnter={(e) => handlePropertyHover(imovel.id, e)}
												onMouseLeave={handlePropertyHoverExit}
												className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-xs cursor-pointer"
											>
												<div 
													className="w-3 h-3 rounded-full"
													style={{ backgroundColor: colors[i % colors.length] }}
												></div>
												<span className="text-gray-200">{imovel.id}</span>
											</div>
										);
									})}
								</div>
							</div>
								),
								() => ChartEmptyVariants.searchedProperties(288),
								288
							)
						)}
						
						{/* Hover card com informações do imóvel */}
						{hoveredProperty && (
							<div 
								className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-4 max-w-xs"
								style={{ 
									left: hoverPosition.x, 
									top: hoverPosition.y,
									transform: 'translateY(-50%)'
								}}
							>
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<h4 className="text-white font-semibold text-sm">ID: {hoveredProperty.listing_id}</h4>
										<span className="text-xs text-gray-400">{hoveredProperty.tipo_imovel || 'N/A'}</span>
									</div>
									
									{hoveredProperty.preco && (
										<div className="text-green-400 font-semibold text-sm">
											R$ {Number(hoveredProperty.preco).toLocaleString('pt-BR')}
										</div>
									)}
									
									<div className="grid grid-cols-3 gap-2 text-xs text-gray-300">
										{hoveredProperty.tamanho_m2 && (
											<div className="flex items-center gap-1">
												<span className="text-gray-400">Área:</span>
												<span>{hoveredProperty.tamanho_m2}m²</span>
											</div>
										)}
										{hoveredProperty.quartos && (
											<div className="flex items-center gap-1">
												<span className="text-gray-400">Qtos:</span>
												<span>{hoveredProperty.quartos}</span>
											</div>
										)}
										{hoveredProperty.banheiros && (
											<div className="flex items-center gap-1">
												<span className="text-gray-400">Banh:</span>
												<span>{hoveredProperty.banheiros}</span>
											</div>
										)}
									</div>
									
									{(hoveredProperty.endereco || hoveredProperty.bairro || hoveredProperty.cidade) && (
										<div className="text-xs text-gray-400 truncate">
											📍 {[hoveredProperty.endereco, hoveredProperty.bairro, hoveredProperty.cidade]
												.filter(Boolean).join(', ')}
										</div>
									)}
									
									{hoveredProperty.descricao && (
										<div className="text-xs text-gray-300 max-h-16 overflow-hidden">
											{hoveredProperty.descricao.substring(0, 120)}
											{hoveredProperty.descricao.length > 120 && '...'}
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<Card className="bg-gray-800/50 border-gray-700/50 xl:col-span-8">
				<CardHeader>
					<CardTitle className="text-white text-lg font-semibold">Entrada de Leads</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-8 h-72">
						{/* Gráfico de barras por canal */}
						<div className="flex flex-col">
							<h4 className="text-base font-semibold text-gray-300 mb-4 text-center">Por Canal</h4>
							<div className="flex-1 flex items-center justify-center" style={{ overflow: 'visible' }}>
								{renderChartWithStates(
									'canal',
									canal,
									() => (
										<ChartContainer
									xAxis={[{ 
										scaleType: 'linear', 
										position: 'bottom', 
										valueFormatter: (v: number) => `${Number(v||0).toLocaleString('pt-BR')}`,
										tickLabelStyle: { fill: chartPalette.textSecondary, fontSize: '0.7rem' }
									}]}
									yAxis={[{ 
										scaleType: 'band', 
										position: 'left', 
										data: canal.map(c => c.name),
										tickLabelStyle: { 
											fill: chartPalette.textPrimary, 
											fontSize: '0.75rem', 
											fontWeight: 500,
											fontFamily: 'Inter, system-ui, sans-serif'
										},
										width: 120  // Aumentar largura para mostrar labels completas
									}]}
									series={canal.map((c, i) => {
										const colors = [
											'#60a5fa', '#fbbf24', '#34d399', '#fb7185', '#a78bfa', 
											'#22d3ee', '#a3e635', '#fb923c', '#f472b6', '#818cf8'
										];
										return {
											type: 'bar' as const,
											data: canal.map(ch => ch.name === c.name ? c.value : 0),
											label: c.name,
											color: colors[i % colors.length],
											layout: 'horizontal' as const
										};
									})}
									height={240}
									margin={{
										left: 120,  // Mantido conforme diretrizes
										right: 40,
										top: 20,
										bottom: 30
									}}
								>
									<BarPlot />
									<ChartsAxis />
									<ChartsTooltip />
								</ChartContainer>
									),
									() => ChartEmptyVariants.leads(240),
									240
								)}
							</div>
						</div>

						{/* Gráfico temporal de leads */}
						<div className="flex flex-col">
							<div className="flex items-center justify-between mb-4">
								<h4 className="text-base font-semibold text-gray-300">Por Tempo</h4>
								<div className="flex items-center gap-2 text-xs">
									<select
										value={timeRange}
										onChange={(e) => setTimeRange(e.target.value as any)}
										className="bg-gray-900/60 border border-gray-700 text-gray-200 rounded px-2 py-1"
									>
										<option value="total">Total</option>
										<option value="year">Ano</option>
										<option value="month">Mês</option>
										<option value="week">Semanas</option>
										<option value="day">Dias</option>
									</select>
								</div>
							</div>
							<div className="flex-1 flex items-center justify-center" style={{ overflow: 'visible' }}>
								{renderChartWithStates(
									'leadsTempo',
									tempoData,
									() => (
										<ChartContainer
									xAxis={[{ 
										scaleType: 'band', 
										position: 'bottom', 
										data: tempoData.map(l => l.month),
										tickLabelStyle: { 
											fill: chartPalette.textSecondary, 
											fontSize: '0.7rem',
											fontFamily: 'Inter, system-ui, sans-serif'
										}
									}]}
									yAxis={[{ 
										scaleType: 'linear', 
										position: 'left',
										valueFormatter: (v: number) => `${Number(v||0)}`,
										tickLabelStyle: { fill: chartPalette.textSecondary, fontSize: '0.7rem' },
										min: 0
									}]}
									series={[{ 
										type: 'line', 
										id: 'tempo', 
										data: tempoData.map(l => l.count),
										color: chartPalette.accent,
										showMark: true,
										curve: 'monotoneX' as any,
										area: true as any
									}]}
									height={240}
									margin={{
										left: 35,
										right: 10,
										top: 10,
										bottom: 30
									}}
								>
									{/* Gradiente para área */}
									<defs>
										<linearGradient id="tempo-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
											<stop offset="0%" stopColor={chartPalette.accent} stopOpacity={0.6} />
											<stop offset="100%" stopColor={chartPalette.accent} stopOpacity={0.1} />
										</linearGradient>
									</defs>
									
									<ChartsGrid vertical style={gridStyle} />
									<LinePlot />
									<AreaPlot />
									<ChartsAxis />
									<ChartsTooltip />
								</ChartContainer>
									),
									() => ChartEmptyVariants.temporal(240),
									240
								)}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="bg-gray-800/50 border-gray-700/50 xl:col-span-4">
				<CardHeader>
					<CardTitle className="text-white text-lg font-semibold">Distribuição por tipo</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="h-72">
						{renderChartWithStates(
							'tipos',
							tipos,
							() => (
								<PieChart
							series={[{ 
								data: tipos.map((t, i) => ({ 
									id: t.name, 
									label: `${t.name} (${t.value})`,  // Incluir número na legenda
									value: t.value,
									color: pieChartColors[i % pieChartColors.length]  // Usar paleta diferenciada
								})),
								innerRadius: 65,    // Ajustado conforme diretrizes
								outerRadius: 110,   // Ajustado conforme diretrizes
								paddingAngle: 3,     // Mantido conforme especificado
								cornerRadius: 10     // Bordas mais suaves
							}]}
							margin={{ top: 40, bottom: 40, left: 80, right: 80 }}  // Margem para acomodar legenda
						/>
							),
							() => ChartEmptyVariants.properties(288),
							288
						)}
					</div>
				</CardContent>
			</Card>

			<Card className="bg-gray-800/50 border-gray-700/50 xl:col-span-6">
				<CardHeader>
					<CardTitle className="text-white text-lg font-semibold">Funis e Corretores</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="h-[48rem] flex flex-col">
						{/* Gráfico de curvas vertical do funil */}
						<div className="h-80 mb-8">
							<h4 className="text-lg font-semibold text-gray-300 mb-4">Funil de Estágios</h4>
							{renderChartWithStates(
								'funil',
								funil,
								() => (
									<ChartContainer
							xAxis={[{
								scaleType: 'band',
								position: 'bottom',
								data: funil.map(f => f.name),
								tickLabelStyle: {
									fill: '#ffffff',
									fontSize: 12,
									fontWeight: 600,
									fontFamily: 'Inter, system-ui, sans-serif',
									textAnchor: 'middle'
								}
							}]}
							yAxis={[{ 
								scaleType: 'linear', 
								position: 'left',
									label: 'Qtd. Leads',
								valueFormatter: numberValueFormatter,
									tickLabelStyle: { 
										fill: chartPalette.textSecondary, 
										fontSize: '0.8rem' 
									},
									min: 0
							}]}
							series={[{ 
									type: 'line', 
									id: 'funil-line', 
								data: funil.map(f => f.value),
									color: chartPalette.accent,
									showMark: true,
									curve: 'catmullRom' as any,
									area: true as any
								}]}
								height={320}
								margin={{
									left: 60,
									right: 40,
									top: 30,
									bottom: 100
								}}
							>
								{/* Gradiente suavizado para área do funil */}
							<defs>
									<linearGradient id="funil-area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
										<stop offset="0%" stopColor={chartPalette.accent} stopOpacity={0.8} />
										<stop offset="50%" stopColor={chartPalette.accent} stopOpacity={0.4} />
										<stop offset="100%" stopColor={chartPalette.accent} stopOpacity={0.05} />
								</linearGradient>
							</defs>
							
							<ChartsGrid vertical style={gridStyle} />
								<LinePlot />
								<AreaPlot />
							<ChartsAxis position="bottom" />
							<ChartsAxis position="left" />
								<ChartsTooltip />
									</ChartContainer>
								),
								() => ChartEmptyVariants.funnel(320),
								320
							)}
						</div>
						
						{/* Gráfico de corretores por leads */}
						<div className="flex-1 flex flex-col">
							<div className="flex items-center justify-between mb-3">
								<h4 className="text-lg font-semibold text-gray-300">Corretores por Leads</h4>
								<button 
									onClick={() => setShowBrokerSelection(!showBrokerSelection)}
									className="text-sm text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded hover:bg-blue-900/20"
								>
									{showBrokerSelection ? '✕' : '⚙️'} {showBrokerSelection ? 'Fechar' : 'Filtrar'}
								</button>
							</div>
							
							<div className="flex-1 flex">
								{/* Painel de seleção lateral (quando ativo) */}
								{showBrokerSelection && (
									<div className="w-48 mr-4 p-3 bg-gray-800/60 rounded border border-gray-600/30 flex flex-col">
										<div className="text-sm text-gray-400 mb-3 font-medium">Corretores:</div>
										<div className="flex-1 overflow-y-auto space-y-2">
											{brokers.map(broker => (
												<label key={broker.name} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-gray-700/40 p-2 rounded transition-colors">
													<input
														type="checkbox"
														checked={selectedBrokers.has(broker.name)}
														onChange={(e) => {
															const newSelected = new Set(selectedBrokers);
															if (e.target.checked) {
																newSelected.add(broker.name);
															} else {
																newSelected.delete(broker.name);
															}
															setSelectedBrokers(newSelected);
														}}
														className="w-4 h-4 accent-blue-500"
													/>
													<span className="text-gray-300 truncate leading-tight" title={broker.name}>
														{broker.name.length > 15 ? broker.name.substring(0, 15) + '...' : broker.name}
														<span className="text-gray-500 ml-2">({broker.value})</span>
													</span>
												</label>
											))}
										</div>
										{selectedBrokers.size > 0 && (
											<button 
												onClick={() => setSelectedBrokers(new Set())}
												className="mt-3 text-sm text-red-400 hover:text-red-300 transition-colors py-2 text-center"
											>
												Limpar ({selectedBrokers.size})
											</button>
										)}
									</div>
								)}
								
								{/* Gráfico de barras verticais */}
								<div className="flex-1">
									{renderChartWithStates(
										'brokers',
										brokersChartData,
										() => (
											<ChartContainer
												xAxis={[{ 
													scaleType: 'band', 
													position: 'bottom', 
													data: brokersChartData.map(d => d.name),
													tickLabelStyle: { 
														fill: chartPalette.textPrimary, 
														fontSize: '0.8rem', 
														fontWeight: 500 
													}
												}]}
												yAxis={[{ 
													scaleType: 'linear', 
													position: 'left',
													label: 'Qtd. Leads',
													valueFormatter: numberValueFormatter,
													tickLabelStyle: { 
														fill: chartPalette.textSecondary, 
														fontSize: '0.8rem' 
													},
													min: 0
												}]}
												series={brokersChartData.map((item, index) => ({
													type: 'bar' as const,
													id: `bar-${index}`,
													data: brokersChartData.map((_, i) => i === index ? item.value : 0),
													color: item.isUnassigned ? '#ef4444' : chartPalette.secondary,
													label: item.tooltip // Usar tooltip como label da série
												}))}
												height={showBrokerSelection ? 280 : 320}
												margin={{
													left: 60,
													right: 30,
													top: 30,
													bottom: 60
												}}
											>
												<ChartsGrid horizontal style={gridStyle} />
												<BarPlot />
												<ChartsAxis />
												<ChartsTooltip />
											</ChartContainer>
										),
										() => ChartEmptyVariants.brokers(showBrokerSelection ? 280 : 320),
										showBrokerSelection ? 280 : 320
									)}
									
									{/* Legenda explicativa */}
									<div className="mt-3 pt-3 border-t border-gray-700/50">
										<div className="text-center text-sm text-gray-400">
											{selectedBrokers.size === 0 
												? `Eixo X: Quantidade de corretores • Eixo Y: Leads por grupo • Vermelho: Não atribuídos`
												: `Comparativo: ${selectedBrokers.size} corretor${selectedBrokers.size !== 1 ? 'es' : ''} selecionado${selectedBrokers.size !== 1 ? 's' : ''}`
											}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="bg-gray-800/50 border-gray-700/50 xl:col-span-6">
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="text-white font-semibold">Conversas dos corretores por hora × dia</CardTitle>
						{/* Filtro por corretor */}
						<div className="flex items-center gap-2">
							<span className="text-sm text-gray-400">Corretor:</span>
							<select
								value={selectedBrokerForHeat}
								onChange={(e) => setSelectedBrokerForHeat(e.target.value)}
								className="bg-gray-700 text-white text-sm border border-gray-600 rounded px-3 py-1.5 min-w-[140px]"
							>
								<option value="">Todas as conversas</option>
								{availableBrokers.map(broker => (
									<option key={broker.id} value={broker.id}>
										{broker.name}
									</option>
								))}
							</select>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="h-[48rem] flex flex-col">
						{/* Header com dias e horas mais detalhado */}
						<div className="flex mb-4">
							<div className="w-16"></div> {/* Espaço para labels de hora */}
							<div className="grid grid-cols-7 gap-2 flex-1">
							{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => (
									<div key={i} className="text-center text-sm font-semibold text-gray-300 py-2">
									{day}
								</div>
							))}
							</div>
						</div>
						
						{/* Heatmap grid com labels de hora */}
						<div className="flex-1 overflow-y-auto">
							{Array.from({ length: 24 }, (_, hour) => (
								<div key={hour} className="flex items-center mb-2">
									{/* Label da hora */}
									<div className="w-16 text-sm text-gray-400 text-right pr-3">
										{String(hour).padStart(2, '0')}h
									</div>
									
									{/* Células do heatmap para cada dia nesta hora */}
						<div className="grid grid-cols-7 gap-2 flex-1">
										{heat.map((dayData, dayIndex) => {
											const value = dayData[hour] || 0;
											const intensity = heatMax > 0 ? value / heatMax : 0;
											
											let bgColor;
											if (value === 0) {
												bgColor = 'rgba(55, 65, 81, 0.3)'; // gray-700 para vazio
											} else {
												// Esquema de cores: azul (frio) → vermelho (quente)
												if (intensity <= 0.2) {
													// Azul claro - baixa atividade
													bgColor = `rgba(59, 130, 246, ${Math.max(0.4, intensity * 2)})`;
												} else if (intensity <= 0.4) {
													// Azul → Ciano
													bgColor = `rgba(6, 182, 212, ${Math.max(0.5, intensity * 1.5)})`;
												} else if (intensity <= 0.6) {
													// Verde/Amarelo - atividade média
													bgColor = `rgba(34, 197, 94, ${Math.max(0.6, intensity * 1.2)})`;
												} else if (intensity <= 0.8) {
													// Laranja - alta atividade
													bgColor = `rgba(251, 146, 60, ${Math.max(0.7, intensity)})`;
												} else {
													// Vermelho - máxima atividade
													bgColor = `rgba(239, 68, 68, ${Math.max(0.8, intensity)})`;
												}
											}
											
										return (
											<div 
													key={`${dayIndex}-${hour}`}
													title={`${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayIndex]} às ${String(hour).padStart(2, '0')}h: ${value} conversa${value !== 1 ? 's' : ''}`}
													className="h-6 w-full rounded-md transition-all duration-300 hover:scale-125 hover:shadow-lg cursor-pointer border"
													style={{ 
														backgroundColor: bgColor,
														borderColor: value > 0 ? 'rgba(255,255,255,0.1)' : 'rgba(107,114,128,0.2)'
													}}
											/>
										);
									})}
									</div>
								</div>
							))}
						</div>
						
						{/* Legenda e estatísticas */}
						<div className="mt-4 pt-4 border-t border-gray-700">
							<div className="flex items-center justify-between">
								{/* Legenda de cores com índice */}
								<div className="flex items-center gap-3 text-sm text-gray-400">
									<span>Intensidade:</span>
							<div className="flex items-center gap-2">
										<div className="w-4 h-4 rounded-md bg-gray-700" title="0 conversas" />
										<div className="w-4 h-4 rounded-md" style={{ backgroundColor: 'rgba(59, 130, 246, 0.6)' }} title="Baixa (1-20%)" />
										<div className="w-4 h-4 rounded-md" style={{ backgroundColor: 'rgba(6, 182, 212, 0.7)' }} title="Moderada (21-40%)" />
										<div className="w-4 h-4 rounded-md" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }} title="Média (41-60%)" />
										<div className="w-4 h-4 rounded-md" style={{ backgroundColor: 'rgba(251, 146, 60, 0.8)' }} title="Alta (61-80%)" />
										<div className="w-4 h-4 rounded-md" style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)' }} title="Máxima (81-100%)" />
									</div>
								</div>
								
								{/* Estatísticas */}
								<div className="text-sm text-gray-400">
									Pico: {heatMax} conversa{heatMax !== 1 ? 's' : ''}
									{selectedBrokerForHeat && (
										<div className="mt-2">
											Filtro: {availableBrokers.find(b => b.id === selectedBrokerForHeat)?.name || 'Corretor'}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
