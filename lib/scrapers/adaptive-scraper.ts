import axios from "axios"
import * as cheerio from "cheerio"
import https from "https"
import type { Contact } from "../types"
import { extractContactInfo, normalizePosition, inferDepartmentFromPosition } from "../utils/contact-extractor"

// Configuração do axios com opções para evitar erros comuns
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 10000, // Reduzido para 10 segundos para evitar bloqueios longos
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  },
  maxRedirects: 5,
})

/**
 * Função para extrair URLs relevantes de um site e depois fazer scraping de contatos
 */
export async function scrapeWithAdaptiveUrls(
  baseUrl: string,
  query: string,
  position: string,
  providedUrls?: string[],
): Promise<{ urls: string[]; contacts: Contact[]; error?: string }> {
  try {
    // Se não foram fornecidas URLs, extrair URLs relevantes do site
    let urls: string[] = providedUrls || []

    if (!providedUrls) {
      // Fase 1: Extrair URLs relevantes
      urls = await extractRelevantUrls(baseUrl, query, position)
      return { urls, contacts: [] }
    } else {
      // Fase 2: Extrair contatos das URLs fornecidas
      const contacts = await extractContactsFromUrls(baseUrl, urls, query, position)
      return { urls, contacts }
    }
  } catch (error) {
    console.error(`Erro no scraper adaptativo para ${baseUrl}:`, error)
    return {
      urls: [],
      contacts: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Extrai URLs relevantes de um site com base na consulta
 */
async function extractRelevantUrls(baseUrl: string, query: string, position: string): Promise<string[]> {
  try {
    // Termos de busca para encontrar páginas relevantes
    const searchTerms = [
      "secretaria",
      "secretário",
      "contato",
      "equipe",
      "estrutura",
      "governo",
      "gestão",
      "organograma",
      "transparência",
    ]

    // Adicionar termos específicos com base na posição
    if (position === "secretario_educacao") {
      searchTerms.push("educação", "ensino", "escolar")
    } else if (position === "secretario_trabalho") {
      searchTerms.push("trabalho", "emprego", "renda")
    } else if (position === "diretor_ti") {
      searchTerms.push("tecnologia", "informação", "ti", "informática")
    } else if (position === "compras") {
      searchTerms.push("compras", "licitação", "pregão", "contratação")
    }

    // Adicionar termos da consulta
    if (query) {
      searchTerms.push(...query.toLowerCase().split(" "))
    }

    try {
      // Acessar a página inicial com timeout reduzido
      const response = await axiosInstance.get(baseUrl, { timeout: 8000 })
      const $ = cheerio.load(response.data)

      // Coletar todos os links da página
      const links = new Set<string>()

      $("a").each((_, element) => {
        const href = $(element).attr("href")
        if (href) {
          // Normalizar URL
          let url = href
          if (url.startsWith("/")) {
            url = `${baseUrl}${url}`
          } else if (!url.startsWith("http")) {
            url = `${baseUrl}/${url}`
          }

          // Verificar se é do mesmo domínio
          try {
            const urlHostname = new URL(url).hostname
            const baseHostname = new URL(baseUrl).hostname

            if (urlHostname.includes(baseHostname) || baseHostname.includes(urlHostname)) {
              links.add(url)
            }
          } catch (e) {
            // Ignorar URLs inválidas
          }
        }
      })

      // Filtrar links relevantes com base nos termos de busca
      const relevantLinks = Array.from(links).filter((link) => {
        const lowerLink = link.toLowerCase()
        return searchTerms.some((term) => lowerLink.includes(term))
      })

      // Limitar o número de links para não sobrecarregar
      return relevantLinks.slice(0, 10)
    } catch (error) {
      console.error(`Erro ao acessar ${baseUrl}:`, error)
      // Tentar acessar URLs comuns se a página inicial falhar
      return [
        `${baseUrl}/contato`,
        `${baseUrl}/secretarias`,
        `${baseUrl}/governo`,
        `${baseUrl}/estrutura`,
        `${baseUrl}/equipe`,
      ]
    }
  } catch (error) {
    console.error(`Erro ao extrair URLs de ${baseUrl}:`, error)
    return []
  }
}

/**
 * Extrai contatos das URLs fornecidas
 */
async function extractContactsFromUrls(
  baseUrl: string,
  urls: string[],
  query: string,
  position: string,
): Promise<Contact[]> {
  const contacts: Contact[] = []
  const processedUrls = new Set<string>()

  // Extrair o estado do baseUrl
  let state = ""
  if (baseUrl.includes("sp.gov") || baseUrl.includes("capital.sp")) {
    state = "SP"
  } else if (baseUrl.includes("rj.gov") || baseUrl.includes("rio.rj")) {
    state = "RJ"
  } else if (baseUrl.includes("mg.gov") || baseUrl.includes("pbh.gov")) {
    state = "MG"
  }

  // Extrair a cidade do baseUrl
  let city = ""
  if (baseUrl.includes("capital.sp") || baseUrl.includes("prefeitura.sp")) {
    city = "São Paulo"
  } else if (baseUrl.includes("rio.rj") || baseUrl.includes("prefeitura.rio")) {
    city = "Rio de Janeiro"
  } else if (baseUrl.includes("pbh.gov")) {
    city = "Belo Horizonte"
  }

  // Processar cada URL com um timeout mais curto e tratamento de erros melhorado
  for (const url of urls) {
    // Evitar processar a mesma URL duas vezes
    if (processedUrls.has(url)) continue
    processedUrls.add(url)

    try {
      // Usar um timeout mais curto para cada URL individual
      const response = await axiosInstance.get(url, { timeout: 5000 })
      const $ = cheerio.load(response.data)

      // Buscar por elementos que possam conter informações de contato
      $("div, section, article").each((_, element) => {
        const $element = $(element)
        const elementHtml = $element.html() || ""
        const elementText = $element.text()

        // Verificar se o elemento contém informações relevantes
        const hasNamePattern = /([A-Z][a-zÀ-ÖØ-öø-ÿ]+\s){1,}([A-Z][a-zÀ-ÖØ-öø-ÿ]+)/g.test(elementText)
        const hasEmailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g.test(elementText)
        const hasPhonePattern = /(\d{2}[\s.-]?)?\d{4,5}[-\s.]?\d{4}/g.test(elementText)
        const hasPositionPattern = /secret[aá]rio|diretor|coordenador|gerente|chefe/i.test(elementText)

        // Se o elemento contém padrões relevantes, extrair informações
        if ((hasNamePattern && (hasEmailPattern || hasPhonePattern)) || (hasNamePattern && hasPositionPattern)) {
          const contactInfo = extractContactInfo(elementText)

          // Para cada possível nome encontrado, criar um contato
          contactInfo.possibleNames.forEach((name, nameIndex) => {
            // Ignorar "Não identificado"
            if (name === "Não identificado") return

            // Extrair possível cargo
            let extractedPosition = ""
            const positionRegex =
              /secret[aá]rio\s+(?:municipal\s+)?de\s+\w+|diretor\s+(?:de\s+)?(?:ti|tecnologia|compras)/gi
            const positionMatch = elementText.match(positionRegex)

            if (positionMatch && positionMatch.length > 0) {
              extractedPosition = positionMatch[0]
            } else if (position !== "todos") {
              // Usar a posição da busca se não encontrou no texto
              extractedPosition = mapPositionToText(position)
            }

            // Extrair departamento
            const department = inferDepartmentFromPosition(extractedPosition)
            // Verificar se tem pelo menos email ou telefone válido
            const hasValidEmail = contactInfo?.emails?.length > 0 && contactInfo?.emails[0]?.includes("@")
            const hasValidPhone = contactInfo?.phones?.length > 0 && isValidBrazilianPhone(contactInfo?.phones[0])

            if (!hasValidEmail && !hasValidPhone) {
              return // Pular contatos sem informações de contato válidas
            }

            // Formatar telefone se existir
            const phone = contactInfo.phones.length > 0 ? formatPhone(contactInfo.phones[0]) : undefined

            // Gerar ID único
            const id = `adaptive-${baseUrl.replace(/[^\w]/g, "-")}-${nameIndex}-${name.replace(/\s/g, "-").toLowerCase()}`

            // Adicionar ao array de resultados
            contacts.push({
              id,
              name,
              position: normalizePosition(extractedPosition),
              city,
              state,
              email: hasValidEmail ? contactInfo.emails[0] : undefined,
              phone: hasValidPhone ? phone : undefined,
              department,
              lastUpdated: new Date().toISOString().split("T")[0],
              source: `Site ${new URL(baseUrl).hostname}`,
              sourceUrl: url,
            })
          })
        }
      })

      // Buscar também em tabelas
      $("table").each((_, tableElement) => {
        $(tableElement)
          .find("tr")
          .each((rowIndex, rowElement) => {
            if (rowIndex === 0) return // Pular cabeçalho

            const columns = $(rowElement).find("td")
            if (columns.length < 2) return

            // Extrair informações das colunas
            const name = $(columns[0]).text().trim()
            const extractedPosition = $(columns[1])?.text().trim() || ""

            // Verificar se encontrou informações suficientes
            if (name && name.length > 5) {
              // Extrair email e telefone
              const rowText = $(rowElement).text()
              const contactInfo = extractContactInfo(rowText)
              // Verificar se tem pelo menos email ou telefone válido
              const hasValidEmail = contactInfo?.emails?.length > 0 && contactInfo?.emails[0]?.includes("@")
              const hasValidPhone = contactInfo?.phones?.length > 0 && isValidBrazilianPhone(contactInfo?.phones[0])

              if (!hasValidEmail && !hasValidPhone) {
                return // Pular contatos sem informações de contato válidas
              }

              // Formatar telefone se existir
              const phone = contactInfo.phones.length > 0 ? formatPhone(contactInfo.phones[0]) : undefined

              // Gerar ID único
              const id = `adaptive-table-${baseUrl.replace(/[^\w]/g, "-")}-${rowIndex}-${name.replace(/\s/g, "-").toLowerCase()}`

              // Adicionar ao array de resultados
              contacts.push({
                id,
                name,
                position: normalizePosition(extractedPosition),
                city,
                state,
                email: hasValidEmail ? contactInfo.emails[0] : undefined,
                phone: hasValidPhone ? phone : undefined,
                department: inferDepartmentFromPosition(extractedPosition),
                lastUpdated: new Date().toISOString().split("T")[0],
                source: `Site ${new URL(baseUrl).hostname}`,
                sourceUrl: url,
              })
            }
          })
      })
    } catch (error) {
      console.error(`Erro ao processar URL ${url}:`, error)
      continue
    }
  }

  return contacts
}

/**
 * Mapeia o código da posição para texto
 */
function mapPositionToText(position: string): string {
  const mapping: Record<string, string> = {
    secretario_educacao: "Secretário Municipal de Educação",
    secretario_trabalho: "Secretário Municipal de Trabalho",
    diretor_ti: "Diretor de Tecnologia da Informação",
    compras: "Diretor de Compras",
  }

  return mapping[position] || position
}

// Melhorar a extração de telefones no scraper adaptativo

// Melhorar a função isValidBrazilianPhone para garantir que o telefone tenha DDD
function isValidBrazilianPhone(phone: string): boolean {
  // Remove todos os caracteres não numéricos
  const cleanedPhone = phone.replace(/\D/g, "")

  // Verifica se tem o número mínimo de dígitos para um telefone com DDD (10 ou 11 dígitos)
  if (cleanedPhone.length < 10) {
    return false
  }

  // Valida o DDD (código de área) - Lista de DDDs válidos no Brasil
  const validDdds = [
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "21",
    "22",
    "24",
    "27",
    "28",
    "31",
    "32",
    "33",
    "34",
    "35",
    "37",
    "38",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "51",
    "53",
    "54",
    "55",
    "61",
    "62",
    "63",
    "64",
    "65",
    "66",
    "67",
    "68",
    "69",
    "71",
    "73",
    "74",
    "75",
    "77",
    "79",
    "81",
    "82",
    "83",
    "84",
    "85",
    "86",
    "87",
    "88",
    "89",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
  ]

  const ddd = cleanedPhone.substring(0, 2)
  if (!validDdds.includes(ddd)) {
    return false
  }

  // Se passou por todas as validações, é um número de telefone brasileiro válido
  return true
}

// Melhorar a função formatPhone para garantir formatação consistente
function formatPhone(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleanedPhone = phone.replace(/\D/g, "")

  // Se não tiver DDD, retornar vazio (não é um telefone válido para nosso caso)
  if (cleanedPhone.length < 8) {
    return ""
  }

  // Formatar o número no padrão brasileiro: (DDD) XXXX-XXXX ou (DDD) XXXXX-XXXX
  if (cleanedPhone.length >= 10) {
    const ddd = cleanedPhone.substring(0, 2)
    const firstPart = cleanedPhone.length >= 11 ? cleanedPhone.substring(2, 7) : cleanedPhone.substring(2, 6)
    const secondPart = cleanedPhone.length >= 11 ? cleanedPhone.substring(7) : cleanedPhone.substring(6)
    return `(${ddd}) ${firstPart}-${secondPart}`
  } else {
    // Se não tiver DDD, adicionar um DDD padrão (00)
    const firstPart = cleanedPhone.length === 9 ? cleanedPhone.substring(0, 5) : cleanedPhone.substring(0, 4)
    const secondPart = cleanedPhone.length === 9 ? cleanedPhone.substring(5) : cleanedPhone.substring(4)
    return `(00) ${firstPart}-${secondPart}`
  }
}
