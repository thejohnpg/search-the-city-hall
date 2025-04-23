"use server"

import { revalidatePath } from "next/cache"
import type { Contact, SearchHistoryItem, SearchParams, CreateAlertParams } from "./types"
import { scrapePortalTransparencia } from "./scrapers/portal-transparencia"
import { scrapeDiarioOficial } from "./scrapers/diario-oficial"
import { scrapePrefeituras } from "./scrapers/prefeituras"
import { scrapeComprasGovernamentais } from "./scrapers/compras-governamentais"
import { searchGoogle } from "./scrapers/google-search"
import { firestore } from "./db"

// Função principal de busca que agrega resultados de várias fontes
export async function searchContacts(params: SearchParams): Promise<Contact[]> {
  console.log("Iniciando busca com parâmetros:", params)

  try {
    // Iniciar buscas em paralelo em diferentes fontes
    const [transparenciaResults, diarioResults, prefeiturasResults, comprasResults, googleResults] =
      await Promise.allSettled([
        scrapePortalTransparencia(params),
        scrapeDiarioOficial(params),
        scrapePrefeituras(params),
        scrapeComprasGovernamentais(params),
        searchGoogle(params),
      ])

    // Processar resultados de cada fonte
    let allContacts: Contact[] = []

    if (transparenciaResults.status === "fulfilled") {
      allContacts = [...allContacts, ...transparenciaResults.value]
    }

    if (diarioResults.status === "fulfilled") {
      allContacts = [...allContacts, ...diarioResults.value]
    }

    if (prefeiturasResults.status === "fulfilled") {
      allContacts = [...allContacts, ...prefeiturasResults.value]
    }

    if (comprasResults.status === "fulfilled") {
      allContacts = [...allContacts, ...comprasResults.value]
    }

    if (googleResults.status === "fulfilled") {
      allContacts = [...allContacts, ...googleResults.value]
    }

    // Remover duplicatas baseado no ID
    const uniqueContacts = Array.from(new Map(allContacts.map((contact) => [contact.id, contact])).values())

    // Ordenar por estado e cidade
    uniqueContacts.sort((a, b) => {
      if (a.state !== b.state) {
        return a.state.localeCompare(b.state)
      }
      return a.city.localeCompare(b.city)
    })

    // Se não encontrou nenhum resultado, retornar array vazio
    if (uniqueContacts.length === 0) {
      console.log("Nenhum contato encontrado em nenhuma fonte")
      return []
    }

    // Salvar resultados no banco de dados para referência futura
    await firestore.saveSearchResults(uniqueContacts)

    return uniqueContacts
  } catch (error) {
    console.error("Erro ao buscar contatos:", error)
    throw new Error("Falha ao buscar contatos")
  }
}

// Função para salvar busca no histórico
export async function saveSearch(searchData: {
  query: string
  filters: {
    position: string
    state: string
  }
  results: number
}): Promise<{ success: boolean }> {
  try {
    await firestore.saveSearchHistory({
      query: searchData.query,
      timestamp: new Date().toISOString(),
      results: searchData.results,
      filters: searchData.filters,
    })

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Erro ao salvar busca:", error)
    return { success: false }
  }
}

// Função para obter histórico de buscas recentes
export async function getRecentSearches(): Promise<SearchHistoryItem[]> {
  try {
    const searches = await firestore.getSearchHistory(10) // Últimas 10 buscas
    return searches
  } catch (error) {
    console.error("Erro ao obter histórico de buscas:", error)
    return []
  }
}

// Função para limpar histórico de buscas
export async function clearSearchHistory(): Promise<{ success: boolean }> {
  try {
    await firestore.clearSearchHistory()
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Erro ao limpar histórico:", error)
    return { success: false }
  }
}

// Função para favoritar/desfavoritar contato
export async function toggleFavoriteContact(contactId: string): Promise<{ success: boolean }> {
  try {
    await firestore.toggleFavorite(contactId)
    return { success: true }
  } catch (error) {
    console.error("Erro ao favoritar contato:", error)
    return { success: false }
  }
}

// Função para obter favoritos
export async function getFavoriteContacts(): Promise<string[]> {
  try {
    return await firestore.getFavorites()
  } catch (error) {
    console.error("Erro ao obter favoritos:", error)
    return []
  }
}

// Função para exportar contatos para CSV
export async function exportContactsToCSV(contacts: Contact[]): Promise<{ success: boolean; csv: string }> {
  try {
    // Cabeçalho do CSV
    const headers = ["Nome", "Cargo", "Departamento", "Cidade", "Estado", "Email", "Telefone", "Fonte", "Atualizado em"]

    // Converter contatos para linhas CSV
    const rows = contacts.map((contact) => [
      contact.name,
      contact.position,
      contact.department,
      contact.city,
      contact.state,
      contact.email || "",
      contact.phone || "",
      contact.source,
      contact.lastUpdated,
    ])

    // Juntar cabeçalho e linhas
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    return { success: true, csv: csvContent }
  } catch (error) {
    console.error("Erro ao exportar contatos:", error)
    throw new Error("Falha ao exportar contatos")
  }
}

// Função para criar alerta de monitoramento
export async function createMonitoringAlert(params: CreateAlertParams): Promise<{ success: boolean; id: string }> {
  try {
    const id = await firestore.createMonitoringAlert({
      keyword: params.keyword,
      email: params.email,
      isActive: true,
      lastCheck: new Date().toISOString(),
    })

    return { success: true, id }
  } catch (error) {
    console.error("Erro ao criar alerta:", error)
    throw new Error("Falha ao criar alerta de monitoramento")
  }
}

// Função para obter alertas ativos
export async function getActiveMonitors(): Promise<any[]> {
  try {
    const monitors = await firestore.getActiveMonitoringAlerts()
    return monitors
  } catch (error) {
    console.error("Erro ao obter alertas:", error)
    return []
  }
}
