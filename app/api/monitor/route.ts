import { NextResponse } from "next/server"
import { firestore } from "@/lib/db"
import { scrapePortalTransparencia } from "@/lib/scrapers/portal-transparencia"
import { scrapeDiarioOficial } from "@/lib/scrapers/diario-oficial"
import { scrapePrefeituras } from "@/lib/scrapers/prefeituras"
import { scrapeComprasGovernamentais } from "@/lib/scrapers/compras-governamentais"
import { searchGoogle } from "@/lib/scrapers/google-search"
import type { Contact } from "@/lib/types"

/**
 * API para executar monitoramento de alertas
 *
 * Esta rota é chamada periodicamente para verificar novos contatos
 * que correspondam aos alertas configurados.
 */
export async function GET() {
  try {
    // Obter todos os alertas ativos
    const alerts = await firestore.getActiveMonitoringAlerts()

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ message: "Nenhum alerta ativo encontrado" })
    }

    // Resultados do monitoramento
    const monitoringResults = []

    // Processar cada alerta
    for (const alert of alerts) {
      // Configurar parâmetros de busca com base na palavra-chave do alerta
      const params = {
        query: alert.keyword,
        position: "todos",
        state: "todos",
      }

      // Executar buscas em todas as fontes
      const [transparenciaResults, diarioResults, prefeiturasResults, comprasResults, googleResults] =
        await Promise.allSettled([
          scrapePortalTransparencia(params),
          scrapeDiarioOficial(params),
          scrapePrefeituras(params),
          scrapeComprasGovernamentais(params),
          searchGoogle(params),
        ])

      // Combinar resultados
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

      // Remover duplicatas
      const uniqueContacts = Array.from(new Map(allContacts.map((contact) => [contact.id, contact])).values())

      // Atualizar o timestamp da última verificação
      await firestore.updateAlertLastCheck(alert.id, new Date().toISOString())

      // Adicionar aos resultados
      monitoringResults.push({
        alertId: alert.id,
        keyword: alert.keyword,
        email: alert.email,
        contactsFound: uniqueContacts.length,
        contacts: uniqueContacts,
      })

      // Em um sistema real, aqui enviaríamos um email com os resultados
      // para o endereço configurado no alerta
      console.log(`Enviando email para ${alert.email} com ${uniqueContacts.length} contatos encontrados`)
    }

    return NextResponse.json({
      success: true,
      monitored: alerts.length,
      results: monitoringResults,
    })
  } catch (error) {
    console.error("Erro ao executar monitoramento:", error)
    return NextResponse.json({ error: "Falha ao executar monitoramento" }, { status: 500 })
  }
}
