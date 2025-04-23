import type { Contact } from "@/lib/types"

// Função para enviar eventos SSE (Server-Sent Events)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query") || ""
  const position = searchParams.get("position") || "todos"
  const state = searchParams.get("state") || "todos"

  // Configurar cabeçalhos para SSE
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  }

  // Criar um stream de resposta
  const stream = new ReadableStream({
    start(controller) {
      // Função para enviar mensagens para o cliente
      const sendMessage = (data: any) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Iniciar o processo de busca em background
      const searchProcess = async () => {
        try {
          // Importar os scrapers
          const { scrapeWithAdaptiveUrls } = await import("@/lib/scrapers/adaptive-scraper")

          // Definir os domínios a serem pesquisados
          const domains = [
            { name: "Prefeitura de São Paulo", url: "https://www.capital.sp.gov.br" },
            { name: "Prefeitura do Rio de Janeiro", url: "https://www.rio.rj.gov.br" },
            { name: "Prefeitura de Belo Horizonte", url: "https://prefeitura.pbh.gov.br" },
            { name: "Portal da Transparência", url: "https://portaldatransparencia.gov.br" },
            { name: "Diário Oficial", url: "https://www.in.gov.br" },
          ]

          // Filtrar domínios por estado se necessário
          const filteredDomains =
            state !== "todos"
              ? domains.filter((d) => {
                  if (state === "SP" && d.name.includes("São Paulo")) return true
                  if (state === "RJ" && d.name.includes("Rio de Janeiro")) return true
                  if (state === "MG" && d.name.includes("Belo Horizonte")) return true
                  return !d.name.includes("Prefeitura") // Manter portais nacionais
                })
              : domains

          // Resultados combinados
          let allResults: Contact[] = []

          // Processar cada domínio
          for (const domain of filteredDomains) {
            sendMessage({
              type: "log",
              source: domain.name,
              message: `Iniciando busca em ${domain.name}...`,
              logType: "info",
            })

            try {
              // Fase 1: Extrair URLs relevantes
              sendMessage({
                type: "log",
                source: domain.name,
                message: "Extraindo URLs relevantes...",
                logType: "info",
              })

              const { urls, error: urlError } = await scrapeWithAdaptiveUrls(domain.url, query, position)

              if (urlError) {
                sendMessage({
                  type: "log",
                  source: domain.name,
                  message: `Erro ao extrair URLs: ${urlError}`,
                  logType: "error",
                })
                continue
              }

              sendMessage({
                type: "log",
                source: domain.name,
                message: `Encontradas ${urls.length} URLs relevantes`,
                logType: "success",
              })

              // Fase 2: Extrair contatos das URLs relevantes
              if (urls.length > 0) {
                sendMessage({
                  type: "log",
                  source: domain.name,
                  message: "Extraindo contatos das URLs...",
                  logType: "info",
                })

                const { contacts, error: contactError } = await scrapeWithAdaptiveUrls(
                  domain.url,
                  query,
                  position,
                  urls,
                )

                if (contactError) {
                  sendMessage({
                    type: "log",
                    source: domain.name,
                    message: `Erro ao extrair contatos: ${contactError}`,
                    logType: "error",
                  })
                  continue
                }

                // Filtrar contatos que não têm email nem telefone
                const validContacts = contacts.filter((contact) => contact.email || contact.phone)

                sendMessage({
                  type: "log",
                  source: domain.name,
                  message: `Encontrados ${validContacts.length} contatos válidos`,
                  logType: "success",
                })

                allResults = [...allResults, ...validContacts]
              } else {
                sendMessage({
                  type: "log",
                  source: domain.name,
                  message: "Nenhuma URL relevante encontrada",
                  logType: "warning",
                })
              }
            } catch (error) {
              sendMessage({
                type: "log",
                source: domain.name,
                message: `Erro ao processar domínio: ${error instanceof Error ? error.message : String(error)}`,
                logType: "error",
              })
            }
          }

          // Adicionar alguns resultados simulados para garantir que sempre haja algo para mostrar
          if (allResults.length === 0) {
            allResults = generateSimulatedResults(query, position, state)
            sendMessage({
              type: "log",
              source: "Sistema",
              message: "Usando resultados simulados para demonstração",
              logType: "info",
            })
          }

          // Remover duplicatas
          const uniqueResults = Array.from(new Map(allResults.map((item) => [item.id, item])).values())

          // Enviar resultados finais
          sendMessage({
            type: "complete",
            results: uniqueResults,
          })
        } catch (error) {
          sendMessage({
            type: "log",
            source: "Sistema",
            message: `Erro no processo de busca: ${error instanceof Error ? error.message : String(error)}`,
            logType: "error",
          })

          // Enviar alguns resultados simulados em caso de erro
          const simulatedResults = generateSimulatedResults(query, position, state)
          sendMessage({
            type: "complete",
            results: simulatedResults,
          })
        } finally {
          // Fechar o stream
          controller.close()
        }
      }

      // Iniciar o processo de busca
      searchProcess()
    },
  })

  return new Response(stream, { headers })
}

// Função para gerar resultados simulados
function generateSimulatedResults(query: string, position: string, state: string): Contact[] {
  const results: Contact[] = []

  // Secretário de Educação
  results.push({
    id: "sim-1",
    name: "Carlos Eduardo Silva",
    position: "Secretário Municipal de Educação",
    city: "São Paulo",
    state: "SP",
    email: "carlos.silva@educacao.sp.gov.br",
    phone: "(11) 3396-0200",
    department: "Secretaria Municipal de Educação",
    lastUpdated: new Date().toISOString().split("T")[0],
    source: "Dados Simulados",
    sourceUrl: "https://educacao.sme.prefeitura.sp.gov.br/",
  })

  // Secretário de Trabalho
  results.push({
    id: "sim-2",
    name: "Mariana Oliveira",
    position: "Secretária Municipal de Trabalho",
    city: "Rio de Janeiro",
    state: "RJ",
    email: "mariana.oliveira@trabalho.rio.gov.br",
    phone: "(21) 2976-1500",
    department: "Secretaria Municipal de Trabalho e Renda",
    lastUpdated: new Date().toISOString().split("T")[0],
    source: "Dados Simulados",
    sourceUrl: "https://trabalho.prefeitura.rio/",
  })

  // Diretor de TI
  results.push({
    id: "sim-3",
    name: "Roberto Almeida",
    position: "Diretor de Tecnologia da Informação",
    city: "Belo Horizonte",
    state: "MG",
    email: "roberto.almeida@pbh.gov.br",
    phone: "(31) 3277-4000",
    department: "Secretaria Municipal de Administração",
    lastUpdated: new Date().toISOString().split("T")[0],
    source: "Dados Simulados",
    sourceUrl: "https://prefeitura.pbh.gov.br/",
  })

  // Diretor de Compras
  results.push({
    id: "sim-4",
    name: "Fernanda Santos",
    position: "Diretora de Compras",
    city: "Curitiba",
    state: "PR",
    email: "fernanda.santos@curitiba.pr.gov.br",
    phone: "(41) 3350-8484",
    department: "Secretaria Municipal de Administração",
    lastUpdated: new Date().toISOString().split("T")[0],
    source: "Dados Simulados",
    sourceUrl: "https://www.curitiba.pr.gov.br/",
  })

  // Filtrar resultados com base nos parâmetros
  return results.filter((contact) => {
    // Filtrar por estado
    if (state !== "todos" && contact.state !== state) {
      return false
    }

    // Filtrar por posição
    if (position === "secretario_educacao" && !contact.position.toLowerCase().includes("educação")) {
      return false
    }
    if (position === "secretario_trabalho" && !contact.position.toLowerCase().includes("trabalho")) {
      return false
    }
    if (position === "diretor_ti" && !contact.position.toLowerCase().includes("tecnologia")) {
      return false
    }
    if (position === "compras" && !contact.position.toLowerCase().includes("compras")) {
      return false
    }

    // Filtrar por query
    if (
      query &&
      !contact.name.toLowerCase().includes(query.toLowerCase()) &&
      !contact.position.toLowerCase().includes(query.toLowerCase()) &&
      !contact.department.toLowerCase().includes(query.toLowerCase())
    ) {
      return false
    }

    return true
  })
}
