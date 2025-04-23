import axios from "axios"
import * as cheerio from "cheerio"
import https from "https"
import type { Contact, SearchParams } from "../types"
import { extractContactInfo } from "../utils/contact-extractor"

/**
 * Função para buscar contatos no Portal de Compras Governamentais
 *
 * Esta função faz scraping no Portal de Compras Governamentais para encontrar
 * informações sobre responsáveis por licitações e compras públicas.
 */
export async function scrapeComprasGovernamentais(params: SearchParams): Promise<Contact[]> {
  console.log("Buscando no Portal de Compras Governamentais:", params)
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

    // URLs atualizadas para buscar
    const urls = [
      "https://www.gov.br/compras",
      "https://compras.gov.br",
      "https://www.comprasgovernamentais.gov.br",
      "https://comprasnet.gov.br",
    ]

    // Construir termos de busca
    let searchTerms = []

    if (params.query) {
      searchTerms.push(params.query)
    }

    if (params.position !== "todos") {
      searchTerms.push(mapPositionToComprasGov(params.position))
    }

    // Se não tiver termos específicos, usar termos genéricos
    if (searchTerms.length === 0) {
      searchTerms = ["licitação", "pregão", "compras", "edital"]
    }

    // Filtrar por estado se especificado
    const stateFilter = params.state !== "todos" ? params.state : null

    // Buscar em cada URL
    for (const url of urls) {
      try {
        // Fazer a requisição HTTP
        const response = await instance.get(url, {
          params: {
            q: searchTerms.join(" "),
            uf: stateFilter,
          },
        })

        // Verificar se a requisição foi bem-sucedida
        if (response.status !== 200) {
          console.error(`Erro ao acessar ${url}:`, response.status)
          continue
        }

        // Usar Cheerio para fazer o parsing do HTML
        const $ = cheerio.load(response.data)

        // Buscar por licitações e responsáveis
        $("div.licitacao, div.pregao, div.edital, div.compra, div.card, div.item, article").each((index, element) => {
          try {
            // Extrair informações da licitação
            const title = $(element).find("h2, h3, .titulo, .title").first().text().trim()
            const description = $(element).find(".descricao, .description, .content, p").first().text().trim()

            // Extrair informações de contato
            const contactText = $(element).find(".contato, .responsavel, .contact, .info").text()
            const contactInfo = extractContactInfo(contactText)

            // Extrair órgão responsável
            const department = $(element)
              .find(".orgao, .departamento, .department, .organization")
              .first()
              .text()
              .trim()

            // Extrair cidade e estado
            const locationText = $(element).find(".local, .location, .endereco").text().trim()
            const locationParts = locationText.split("/")
            const city = locationParts[0]?.trim() || ""
            const state = locationParts[1]?.trim() || stateFilter || ""

            // Extrair link para detalhes
            const detailsLink = $(element).find("a").attr("href") || ""
            const detailsUrl = detailsLink.startsWith("http") ? detailsLink : `${url}${detailsLink}`

            // Para cada possível nome encontrado, criar um contato
            contactInfo.possibleNames.forEach((name, nameIndex) => {
              // Verificar se o nome não é "Não identificado"
              if (name === "Não identificado") return

              // Gerar ID único
              const id = `cg-${index}-${nameIndex}-${state}-${name.replace(/\s/g, "-").toLowerCase()}`

              // Adicionar ao array de resultados
              results.push({
                id,
                name,
                position: "Responsável por Compras",
                city,
                state,
                email: contactInfo.emails[0] || undefined,
                phone: contactInfo.phones[0] || undefined,
                department: department || "Setor de Compras",
                lastUpdated: new Date().toISOString().split("T")[0],
                source: "Portal de Compras Governamentais",
                sourceUrl: detailsUrl || url,
                metadata: {
                  licitacao: title,
                  descricao: description,
                },
              })
            })
          } catch (error) {
            console.error("Erro ao processar licitação:", error)
          }
        })

        // Buscar também em tabelas de licitações
        $("table").each((tableIndex, tableElement) => {
          const tableHtml = $(tableElement).html()?.toLowerCase() || ""

          // Verificar se a tabela contém termos relevantes
          const hasRelevantTerms = searchTerms.some((term) => tableHtml.includes(term.toLowerCase()))

          if (!hasRelevantTerms) {
            return // Pular para a próxima tabela
          }

          // Processar linhas da tabela
          $(tableElement)
            .find("tr")
            .each((rowIndex, rowElement) => {
              if (rowIndex === 0) return // Pular cabeçalho

              try {
                const columns = $(rowElement).find("td")

                // Extrair informações das colunas
                const licitacao = $(columns[0]).text().trim()
                const orgao = $(columns[1])?.text().trim() || ""
                const responsavel = $(columns[2])?.text().trim() || ""
                const contato = $(columns[3])?.text().trim() || ""

                // Extrair email e telefone do contato
                const contactInfo = extractContactInfo(contato)

                // Extrair cidade e estado
                let city = ""
                let state = stateFilter || ""

                if (orgao) {
                  const locationMatch = orgao.match(/([A-Za-z\s]+)\/([A-Z]{2})/)
                  if (locationMatch) {
                    city = locationMatch[1].trim()
                    state = locationMatch[2]
                  }
                }

                // Verificar se encontrou informações suficientes
                if (responsavel && orgao) {
                  // Gerar ID único
                  const id = `cg-table-${tableIndex}-${rowIndex}-${state}-${responsavel.replace(/\s/g, "-").toLowerCase()}`

                  // Adicionar ao array de resultados
                  results.push({
                    id,
                    name: responsavel,
                    position: "Responsável por Compras",
                    city,
                    state,
                    email: contactInfo.emails[0] || undefined,
                    phone: contactInfo.phones[0] || undefined,
                    department: orgao,
                    lastUpdated: new Date().toISOString().split("T")[0],
                    source: "Portal de Compras Governamentais",
                    sourceUrl: url,
                    metadata: {
                      licitacao,
                    },
                  })
                }
              } catch (error) {
                console.error("Erro ao processar linha da tabela:", error)
              }
            })
        })
      } catch (error) {
        console.error(`Erro ao buscar em ${url}:`, error)
      }
    }

    // Se não conseguiu resultados, gerar alguns resultados simulados
    if (results.length === 0) {
      console.log("Nenhum resultado encontrado no Portal de Compras Governamentais")
    }

    return results
  } catch (error) {
    console.error("Erro ao buscar no Portal de Compras Governamentais:", error)
    return []
  }
}

// Função auxiliar para mapear cargos para o formato do Portal de Compras
function mapPositionToComprasGov(position: string): string {
  const mapping: Record<string, string> = {
    secretario_educacao: "Responsável por Educação",
    secretario_trabalho: "Responsável por Trabalho",
    diretor_ti: "Responsável por TI",
    compras: "Responsável por Compras",
  }

  return mapping[position] || position
}
