export interface DashboardKPIData {
  label: string
  value: string | number
  subValue?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  sparklineData?: { value: number }[]
  status?: 'default' | 'success' | 'warning' | 'danger'
}

export interface DashboardChartData {
  date: string
  shipments: number
  cost?: number
}

export interface StockHealthItem {
  sku: string
  stock: number
  avgConsumption90d: number
  daysRemaining: number
  consumption30d: number
  isBundle: boolean
}

export interface DashboardAlert {
  id: string
  type: 'stock_critique' | 'tarif_manquant' | 'items_manquants' | 'sync_echec'
  title: string
  description: string
  count: number
  actionLabel?: string
  actionLink?: string
}

export interface BillingSummary {
  status: 'pending' | 'generated' | 'exported'
  totalCost: number
  missingPricingCount: number
  totalIndemnity: number
}

export interface DashboardData {
  currentMonth: string
  kpis: {
    shipments: DashboardKPIData
    cost: DashboardKPIData
    missingPricing: DashboardKPIData
    indemnity: DashboardKPIData
    criticalStock: DashboardKPIData
    shipmentsWithoutItems: DashboardKPIData
  }
  chartData: DashboardChartData[]
  stockHealth: StockHealthItem[]
  alerts: DashboardAlert[]
  billing: BillingSummary
  lastSync: {
    date: string | null
    status: 'ok' | 'warning' | 'failed'
  }
}

