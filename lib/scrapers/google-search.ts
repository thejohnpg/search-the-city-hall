import axios from "axios"
import * as cheerio from "cheerio"
import https from "https"
import type { Contact, SearchParams } from "../types"
import { extractContactInfo, normalizePosition, inferDepartmentFromPosition } from "../utils/contact-extractor"

/**
 * Função para buscar contatos usando web scraping do Google
 *
 * Esta função utiliza web scraping para encontrar informações
 * sobre secretários e outros funcionários públicos em diversas fontes.
 */
export async function searchGoogle(params: SearchParams): Promise<Contact[]> {
  console.log("Buscando via Google Search:", params)
  const results: Contact[] = []

  try {
    // Criar instância do axios com configuração para ignorar erros de SSL
    const instance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    // Construir query de busca
    let searchQuery = ""

    if (params.position !== "todos") {
      const positionName = mapPositionToGoogleSearch(params.position)
      searchQuery += positionName + " "
    } else {
      searchQuery += "secretário municipal "
    }

    if (params.state !== "todos") {
      searchQuery += "prefeitura " + params.state + " "
    } else {
      searchQuery += "prefeitura "
    }

    if (params.query) {
      searchQuery += params.query + " "
    }

    searchQuery += "contato email telefone"

    console.log("Query de busca Google:", searchQuery)

    // URL para busca no Google
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`

    try {
      // Fazer a requisição HTTP
      const response = await instance.get(searchUrl)

      // Verificar se a requisição foi bem-sucedida
      if (response.status === 200) {
        // Usar Cheerio para fazer o parsing do HTML
        const $ = cheerio.load(response.data)

        // Extrair resultados da busca
        $("div.g").each((index, element) => {
          try {
            // Extrair título e URL
            const title = $(element).find("h3").text().trim()
            const url = $(element).find("a").attr("href") || ""

            // Extrair snippet
            const snippet = $(element).find(".VwiC3b, .yXK7lf, .st").text().trim()

            // Verificar se o resultado é relevante
            const isRelevant = checkRelevance(title, snippet, params)

            if (!isRelevant) {
              return // Pular para o próximo resultado
            }

            // Extrair informações de contato do snippet
            const contactInfo = extractContactInfo(snippet)

            // Extrair possível cargo
            let position = ""
            const positionRegex =
              /secret[aá]rio\s+(?:municipal\s+)?de\s+\w+|diretor\s+(?:de\s+)?(?:ti|tecnologia|compras)/gi
            const positionMatch = snippet.match(positionRegex)
            if (positionMatch && positionMatch.length > 0) {
              position = positionMatch[0]
            } else if (params.position !== "todos") {
              position = mapPositionToGoogleSearch(params.position)
            }

            // Extrair possível cidade/estado
            let city = ""
            const state = params.state !== "todos" ? params.state : ""

            // Tentar extrair cidade do título ou snippet
            const cityRegex = /prefeitura\s+(?:municipal\s+)?de\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)/i
            const cityMatch = (title + " " + snippet).match(cityRegex)
            if (cityMatch && cityMatch[1]) {
              city = cityMatch[1].trim()
            }

            // Para cada possível nome encontrado, criar um contato
            contactInfo.possibleNames.forEach((name, nameIndex) => {
              // Verificar se o nome não é "Não identificado"
              if (name === "Não identificado") return

              // Gerar ID único
              const id = `gs-${index}-${nameIndex}-${state}-${name.replace(/\s/g, "-").toLowerCase()}`

              // Adicionar ao array de resultados
              results.push({
                id,
                name,
                position: normalizePosition(position),
                city,
                state,
                email: contactInfo.emails[0] || undefined,
                phone: contactInfo.phones[0] || undefined,
                department: inferDepartmentFromPosition(position),
                lastUpdated: new Date().toISOString().split("T")[0],
                source: title,
                sourceUrl: url,
              })
            })
          } catch (error) {
            console.error("Erro ao processar resultado do Google:", error)
          }
        })
      }
    } catch (error) {
      console.error("Erro ao acessar o Google Search:", error)
    }

    // Se não conseguiu resultados, gerar alguns resultados simulados
    if (results.length === 0) {
      console.log("Nenhum resultado encontrado na busca do Google")
    }

    return results
  } catch (error) {
    console.error("Erro ao buscar via Google Search:", error)
    return results
  }
}

// Função auxiliar para mapear cargos para termos de busca no Google
function mapPositionToGoogleSearch(position: string): string {
  const mapping: Record<string, string> = {
    secretario_educacao: "secretário municipal de educação",
    secretario_trabalho: "secretário municipal de trabalho",
    diretor_ti: "diretor de tecnologia da informação prefeitura",
    compras: "diretor de compras prefeitura",
  }

  return mapping[position] || position
}

// Função para verificar se um resultado é relevante
function checkRelevance(title: string, snippet: string, params: SearchParams): boolean {
  const fullText = (title + " " + snippet).toLowerCase()

  // Verificar se contém termos relevantes
  const relevantTerms = ["prefeitura", "secretário", "secretaria", "municipal", "diretor"]
  const hasRelevantTerms = relevantTerms.some((term) => fullText.includes(term))

  if (!hasRelevantTerms) {
    return false
  }

  // Verificar se corresponde à posição buscada
  if (params.position !== "todos") {
    const positionName = mapPositionToGoogleSearch(params.position).toLowerCase()
    if (!fullText.includes(positionName)) {
      return false
    }
  }

  // Verificar se corresponde ao estado buscado
  if (params.state !== "todos") {
    if (!fullText.includes(params.state.toLowerCase())) {
      return false
    }
  }

  // Verificar se corresponde à query buscada
  if (params.query && params.query.trim() !== "") {
    const queryTerms = params.query.toLowerCase().split(" ")
    const hasQueryTerms = queryTerms.some((term) => fullText.includes(term))

    if (!hasQueryTerms) {
      return false
    }
  }

  return true
}
