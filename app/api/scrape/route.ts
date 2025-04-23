import { NextResponse } from "next/server"
import { scrapePortalTransparencia } from "@/lib/scrapers/portal-transparencia"
import { scrapeDiarioOficial } from "@/lib/scrapers/diario-oficial"
import { scrapePrefeituras } from "@/lib/scrapers/prefeituras"
import { scrapeComprasGovernamentais } from "@/lib/scrapers/compras-governamentais"
import { searchGoogle } from "@/lib/scrapers/google-search"
import type { Contact } from "@/lib/types"

/**
 * API para iniciar o processo de scraping
 *
 * Esta rota permite iniciar o processo de scraping em todas as fontes
 * e retorna os resultados combinados.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query") || ""
  const position = searchParams.get("position") || "todos"
  const state = searchParams.get("state") || "todos"

  console.log("Iniciando scraping para:", { query, position, state })

  try {
    // Iniciar buscas em paralelo em diferentes fontes
    const [transparenciaResults, diarioResults, prefeiturasResults, comprasResults, googleResults] =
      await Promise.allSettled([
        scrapePortalTransparencia({ query, position, state }),
        scrapeDiarioOficial({ query, position, state }),
        scrapePrefeituras({ query, position, state }),
        scrapeComprasGovernamentais({ query, position, state }),
        searchGoogle({ query, position, state }),
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

    return NextResponse.json({ results: uniqueContacts })
  } catch (error) {
    console.error("Erro no processo de scraping:", error)
    return NextResponse.json({ error: "Falha no processo de scraping" }, { status: 500 })
  }
}
