import axios from "axios"
import * as cheerio from "cheerio"
import https from "https"
import type { Contact, SearchParams } from "../types"
import { normalizePosition, inferDepartmentFromPosition } from "../utils/contact-extractor"

/**
 * Função para buscar contatos no Portal da Transparência
 *
 * Esta função faz scraping no Portal da Transparência para encontrar
 * informações sobre secretários e outros funcionários públicos.
 */
export async function scrapePortalTransparencia(params: SearchParams): Promise<Contact[]> {
  console.log("Buscando no Portal da Transparência:", params)
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

    // URLs alternativas para busca
    const urls = [
      "https://portaldatransparencia.gov.br/servidores",
      "https://www.portaltransparencia.gov.br/servidores",
      "https://transparencia.gov.br/servidores",
    ]

    // Mapear parâmetros para a busca
    const searchTerm = params.query ? encodeURIComponent(params.query) : ""
    const position = params.position !== "todos" ? mapPositionToPortalTransparencia(params.position) : ""
    const state = params.state !== "todos" ? params.state : ""

    // Tentar cada URL até conseguir
    for (const baseUrl of urls) {
      try {
        // Fazer a requisição HTTP
        const response = await instance.get(`${baseUrl}`, {
          params: {
            q: searchTerm,
            cargo: position,
            uf: state,
            pagina: 1,
          },
        })

        // Verificar se a requisição foi bem-sucedida
        if (response.status === 200) {
          // Usar Cheerio para fazer o parsing do HTML
          const $ = cheerio.load(response.data)

          // Extrair informações dos servidores
          $(".resultado-busca, .servidor, .funcionario").each((index, element) => {
            try {
              const name = $(element).find(".nome-servidor, .nome, h3").text().trim()
              const position = $(element).find(".cargo, .funcao").text().trim()
              const department =
                $(element).find(".orgao, .departamento").text().trim() || inferDepartmentFromPosition(position)

              // Extrair cidade e estado
              const locationText = $(element).find(".lotacao, .local").text().trim()
              const locationParts = locationText.split("/")
              const city = locationParts[0]?.trim() || ""
              const state = locationParts[1]?.trim() || ""

              // Extrair link para detalhes
              const detailsLink = $(element).find("a").attr("href") || ""
              const detailsUrl = detailsLink.startsWith("http") ? detailsLink : `${baseUrl}${detailsLink}`

              // Verificar se encontrou informações suficientes
              if (name && position) {
                // Gerar ID único
                const id = `pt-${index}-${state}-${name.replace(/\s/g, "-").toLowerCase()}`

                // Adicionar ao array de resultados
                results.push({
                  id,
                  name,
                  position: normalizePosition(position),
                  city,
                  state,
                  department,
                  lastUpdated: new Date().toISOString().split("T")[0],
                  source: "Portal da Transparência",
                  sourceUrl: detailsUrl || baseUrl,
                })
              }
            } catch (error) {
              console.error("Erro ao processar servidor:", error)
            }
          })

          // Se encontrou resultados, sair do loop
          if (results.length > 0) {
            break
          }
        }
      } catch (error) {
        console.error(`Erro ao acessar ${baseUrl}:`, error)
        // Continuar para a próxima URL
      }
    }

    // Se não conseguiu resultados de nenhuma URL, gerar alguns resultados simulados
    // para não deixar o usuário sem resposta
    if (results.length === 0) {
      console.log("Nenhum resultado encontrado no Portal da Transparência")
    }

    return results
  } catch (error) {
    console.error("Erro ao buscar no Portal da Transparência:", error)

    // Retornar alguns resultados simulados em caso de erro
    return results
  }
}

// Função auxiliar para mapear cargos para o formato do Portal da Transparência
function mapPositionToPortalTransparencia(position: string): string {
  const mapping: Record<string, string> = {
    secretario_educacao: "SECRETÁRIO MUNICIPAL DE EDUCAÇÃO",
    secretario_trabalho: "SECRETÁRIO MUNICIPAL DE TRABALHO",
    diretor_ti: "DIRETOR DE TECNOLOGIA DA INFORMAÇÃO",
    compras: "DIRETOR DE COMPRAS",
  }

  return mapping[position] || position
}
