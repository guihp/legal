## Sessão: Conjunto de Gráficos do Dashboard (MUI X Charts v8)

### Objetivo
Substituir os 2 gráficos atuais por uma sessão única com um conjunto de gráficos interativos e coesos (estilo showcase da MUI X Charts), logo abaixo dos KPIs do cabeçalho. Reorganizar as sessões conforme:
- 1ª sessão: Conjunto de gráficos
- 2ª sessão: Card Propriedades Recentes e Card Próximos Compromissos
- 3ª sessão: Atividades Recentes

Base técnica: `@mui/x-charts` v8 (Community). Avaliar Pro para export/zoom se necessário.

Referências principais: [MUI X Charts v8 – Overview](https://mui.com/x/react-charts/) e tópicos de composição, eixos, legenda, tooltip, gauge, heatmap e export.

---

### Layout proposto (dark)
- Container em `grid` 12 colunas (xl) com alturas coerentes usando SVG responsivo via `ChartContainer`.
- Blocos:
  1) "VGV mensal (12m) + Conversões": `ChartContainer` com Area/Line combinados; xAxis `time` / yAxis `linear`. Highlight por eixo (`axisHighlight={{ x: 'line' }}`). Tooltip `axis`.
  2) "Leads por canal (top 8)": `Bar` horizontal (categoria → valor). xAxis `linear`, yAxis `band`. Tooltip `item`.
  3) "Distribuição por tipo de imóvel": `Pie/Donut` (innerRadius) com legenda `direction='vertical'`.
  4) "Funil de estágio dos leads": `Bar` empilhado (stacking) por estágio ou `Funnel` (se usarmos Pro). Community: stacked bar.
  5) "Mapa de calor – horário x dia (aberturas/atividades)": `Heatmap` (Community possui) com cor contínua e legenda de cor.
  6) "Gauge – taxa de ocupação/atendimento do mês": `Gauge` com `valueMax` e `aria`.

Distribuição em grid (exemplo xl):
- Linha 1: (1) 8 col, (6) 4 col
- Linha 2: (2) 6 col, (3) 6 col
- Linha 3: (4) 6 col, (5) 6 col

Animações: respeitar `prefers-reduced-motion` via `skipAnimation` no plot quando necessário.

---

### Métricas e dados (Supabase)
Todas as queries consideram `company_id` do JWT claim (RLS). Serviços centralizados em `src/services/metrics.ts`.

1) VGV mensal (12 meses)
- Tabela: `contracts` (tipo='Venda')
- Campos: `valor (numeric)`, `data_assinatura (date)`
- Consulta: somar por mês dos últimos 12 meses; também série de conversões (contagem de contratos). Eixo x UTC.

2) Leads por canal (top 8)
- Tabela: `leads`
- Campo: `source`
- Consulta: agrupar e ordenar desc; pegar top 8 e somar "Outros".

3) Distribuição por tipo de imóvel
- Tabela: `imoveisvivareal`
- Campo: `tipo_imovel`
- Normalização conforme util existente em `DashboardContent` (manter função central em `lib/charts/normalizers.ts`).

4) Funil de estágio dos leads
- Tabela: `leads`
- Campo: `stage` (ex.: Novo → Qualificado → Visita → Proposta → Fechado)
- Consulta: contagem por estágio; empilhado por origem (opcional) para pivot simples.

5) Heatmap horário x dia
- Fontes: `leads.created_at` OU `whatsapp_messages.created_at` (se disponível) para medir picos operacionais.
- Eixos: x=hora (0–23), y=dia (Seg–Dom). Valor: contagem.

6) Gauge – taxa de atendimento (SLA) ou ocupação
- Fontes possíveis:
  - SLA: % de leads respondidos em < N horas (requer `leads.first_response_at`).
  - Ocupação: % de imóveis marcados como indisponíveis vs total.
- Inicial: usar Ocupação = (total - disponíveis)/total.

---

### Escolhas de gráficos e API (v8)
- Composição com `ChartContainer` (substitui `ResponsiveChartContainer`).
- Eixos via `xAxis`/`yAxis` com `position` no container (v8). Legenda via `ChartsLegend` (HTML). Tooltip unificado por `slotProps.tooltip` ou componente na composição.
- Heatmap e Gauge: componentes dedicados (`@mui/x-charts/Heatmap`, `@mui/x-charts/Gauge`).
- Direção de legendas: `horizontal | vertical`.
- Export (se precisarmos): Pro + `rasterizehtml`.

A11y:
- `aria-labelledby` e `aria-valuetext` no `Gauge`.
- Cores com contraste e paleta do tema.
- `skipAnimation` quando `prefers-reduced-motion`.

i18n:
- `ThemeProvider` com locale (quando pt-BR estiver disponível) ou `ChartsLocalizationProvider` com `localeText` custom.

Performance:
- Evitar recriar arrays de eixos e séries (memo).
- `disableAxisListener` quando tooltip/highlight não forem usados.
- `clipPath` em Area/Bar/Line conforme docs.

---

### Estrutura de código
```
src/
├─ lib/
│  └─ charts/
│     ├─ formatters.ts      # moeda, percentuais, datas, valueFormatters
│     ├─ normalizers.ts     # normalização de tipos de imóveis
│     └─ palette.ts         # paleta de cores do tema dark
├─ services/
│  └─ metrics.ts            # funções Supabase p/ séries e agregações
├─ components/
│  └─ DashboardCharts.tsx   # sessão principal (conjunto de gráficos)
```

`DashboardCharts.tsx` (resumo de composição):
- Importar `ChartContainer`, `ChartsLegend`, `ChartsAxis`, `ChartsTooltip`, `BarPlot`, `LinePlot`, `AreaPlot`, `PieChart`/`PiePlot`, `Heatmap`, `Gauge`.
- Receber `data` das funções de serviço via props ou hooks internos com `useEffect` + `supabase`.
- Aplicar `axisHighlight`, `slotProps={{ tooltip: { trigger: 'axis'|'item' } }}` e `hideLegend` quando necessário.

---

### Reorganização do Dashboard
- Inserir `DashboardCharts` como primeira sessão após os KPIs.
- Empurrar `Propriedades Recentes` para a segunda linha junto com `Próximos Compromissos`.
- Remover o card atual de "Distribuição por Tipo" (ele passa a existir dentro do `DashboardCharts`).

Impacto em `src/components/DashboardContent.tsx`:
- Adicionar `<DashboardCharts />` após os KPIs.
- Remover o bloco Pie/Dupla Lista e o card "Distribuição por Tipo".

---

### Roadmap de entrega
1) Instalação e setup de pacotes
2) Services `metrics.ts` (consultas)
3) Utilitários (`formatters`, `normalizers`)
4) `DashboardCharts` com dados mock
5) Integração com dados reais Supabase
6) A11y/i18n/tema
7) Ajustes visuais e responsividade
8) Lint/tests/documentação

---

### Decisões principais
- Community edition atende o escopo inicial (sem export/zoom). Caso o dono precise imprimir/baixar imagens, ativar Pro + `rasterizehtml`.
- Composição `ChartContainer` v8 para maior controle e consistência com a documentação mais recente.

---

### Referências
- Documentação MUI X Charts v8: `https://mui.com/x/react-charts/`
- Composição/Axis/Legend/Tooltip/Heatmap/Gauge/Export/Migração v7→v8 (seções consultadas).
