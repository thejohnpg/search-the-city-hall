// Tipos para contatos
export interface Contact {
  id: string
  name: string
  position: string
  city: string
  state: string
  email?: string
  phone?: string
  department: string
  lastUpdated: string
  source: string
  sourceUrl?: string
  metadata?: Record<string, any>
}

// Tipos para histórico de busca
export interface SearchHistoryItem {
  id: string
  query: string
  timestamp: string
  results: number
  filters: {
    position: string
    state: string
  }
}

// Tipos para alertas de monitoramento
export interface MonitoringAlert {
  id: string
  keyword: string
  email: string
  isActive: boolean
  lastCheck: string
}

// Tipos para resultados de busca
export interface SearchResult {
  success: boolean
  message?: string
  data?: any
}

// Tipos para parâmetros de busca
export interface SearchParams {
  query: string
  position: string
  state: string
  page?: number
  limit?: number
}

// Tipos para criação de alertas
export interface CreateAlertParams {
  keyword: string
  email: string
}
