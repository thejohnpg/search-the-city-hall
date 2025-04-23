import axios from "axios"
import * as cheerio from "cheerio"
import https from "https"
import type { Contact, SearchParams } from "../types"
import { extractContactInfo, normalizePosition, inferDepartmentFromPosition } from "../utils/contact-extractor"

/**
 * Função para buscar contatos em Diários Oficiais
 *
 * Esta função faz scraping em Diários Oficiais para encontrar
 * nomeações, exonerações e outras informações sobre funcionários públicos.
 */
export async function scrapeDiarioOficial(params: SearchParams): Promise<Contact[]> {
  console.log("Buscando em Diários Oficiais:", params)
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

    // Atualizar a lista de URLs de diários oficiais para buscar
    const diarioUrls = [
      "https://www.imprensaoficial.com.br", // São Paulo
      "https://www.ioerj.com.br", // Rio de Janeiro
      "https://www.iof.mg.gov.br", // Minas Gerais
      "https://www.in.gov.br", // Diário Oficial da União
      "https://dosp.com.br", // Diário Oficial de São Paulo
      "https://dom.sc.gov.br", // Diário Oficial de Santa Catarina
    ]

    // Filtrar por estado se especificado
    if (params.state !== "todos") {
      // Mapear estado para URL específica do diário oficial
      const stateMap: Record<string, string[]> = {
        SP: ["https://www.imprensaoficial.com.br", "https://dosp.com.br"],
        RJ: ["https://www.ioerj.com.br"],
        MG: ["https://www.iof.mg.gov.br"],
        SC: ["https://dom.sc.gov.br"],
      }

      if (stateMap[params.state]) {
        diarioUrls.length = 0 // Limpar array
        diarioUrls.push(...stateMap[params.state])
      }
    }

    // Construir termos de busca
    let searchTerms = []

    if (params.query) {
      searchTerms.push(params.query)
    }

    if (params.position !== "todos") {
      searchTerms.push(mapPositionToDiarioOficial(params.position))
    }

    // Se não tiver termos específicos, usar termos genéricos
    if (searchTerms.length === 0) {
      searchTerms = ["secretário", "nomeação", "designação"]
    }

    // Buscar em cada diário oficial
    for (const url of diarioUrls) {
      try {
        // Fazer a requisição HTTP
        const response = await instance.get(url, {
          params: {
            q: searchTerms.join(" "),
            pagina: 1,
          },
        })

        // Verificar se a requisição foi bem-sucedida
        if (response.status !== 200) {
          console.error(`Erro ao acessar o Diário Oficial ${url}:`, response.status)
          continue
        }

        // Usar Cheerio para fazer o parsing do HTML
        const $ = cheerio.load(response.data)

        // Extrair informações das publicações
        // Nota: Cada diário oficial tem uma estrutura diferente, então isso é uma simplificação
        $("div.resultado, div.publicacao, div.materia, div.item, article").each((index, element) => {
          try {
            // Extrair texto da publicação
            const publicationText = $(element).text()

            // Verificar se o texto contém termos relevantes
            const hasRelevantTerms = searchTerms.some((term) =>
              publicationText.toLowerCase().includes(term.toLowerCase()),
            )

            if (!hasRelevantTerms) {
              return // Pular para o próximo elemento
            }

            // Extrair informações de contato do texto
            const contactInfo = extractContactInfo(publicationText)

            // Extrair possível cargo
            let position = ""
            const positionRegex =
              /secret[aá]rio\s+(?:municipal\s+)?de\s+\w+|diretor\s+(?:de\s+)?(?:ti|tecnologia|compras)/gi
            const positionMatch = publicationText.match(positionRegex)
            if (positionMatch && positionMatch.length > 0) {
              position = positionMatch[0]
            }

            // Extrair possível cidade/estado
            const city = ""
            let state = ""

            // Tentar extrair do URL ou do texto
            if (url.includes("imprensaoficial.com.br") || url.includes("dosp.com.br")) {
              state = "SP"
            } else if (url.includes("ioerj.com.br")) {
              state = "RJ"
            } else if (url.includes("iof.mg.gov.br")) {
              state = "MG"
            } else if (url.includes("dom.sc.gov.br")) {
              state = "SC"
            }

            // Extrair data da publicação
            const dateRegex = /\d{2}\/\d{2}\/\d{4}/
            const dateMatch = publicationText.match(dateRegex)
            const publicationDate = dateMatch ? dateMatch[0] : new Date().toISOString().split("T")[0]

            // Extrair link para detalhes
            const detailsLink = $(element).find("a").attr("href") || ""
            const detailsUrl = detailsLink.startsWith("http") ? detailsLink : `${url}${detailsLink}`

            // Para cada possível nome encontrado, criar um contato
            contactInfo.possibleNames.forEach((name, nameIndex) => {
              // Verificar se o nome não é "Não identificado"
              if (name === "Não identificado") return

              // Gerar ID único
              const id = `do-${index}-${nameIndex}-${state}-${name.replace(/\s/g, "-").toLowerCase()}`

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
                lastUpdated: publicationDate,
                source: `Diário Oficial de ${state}`,
                sourceUrl: detailsUrl || url,
                metadata: {
                  publicationDate,
                  actType: "Nomeação",
                },
              })
            })
          } catch (error) {
            console.error("Erro ao processar publicação:", error)
          }
        })
      } catch (error) {
        console.error(`Erro ao buscar no Diário Oficial ${url}:`, error)
      }
    }

    // Remover a chamada para generateSimulatedResults
    if (results.length === 0) {
      console.log("Nenhum resultado encontrado nos Diários Oficiais")
    }

    return results
  } catch (error) {
    console.error("Erro ao buscar em Diários Oficiais:", error)
    return []
  }
}

// Função auxiliar para mapear cargos para o formato do Diário Oficial
function mapPositionToDiarioOficial(position: string): string {
  const mapping: Record<string, string> = {
    secretario_educacao: "Secretário Municipal de Educação",
    secretario_trabalho: "Secretário Municipal de Trabalho",
    diretor_ti: "Diretor de Tecnologia da Informação",
    compras: "Diretor de Compras",
  }

  return mapping[position] || position
}
