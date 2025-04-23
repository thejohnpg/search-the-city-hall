"use client"

import { useState, useEffect } from "react"
import { Search, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import ContactTable from "@/components/contact-table"
import SearchHistory from "@/components/search-history"
import MonitoringPanel from "@/components/monitoring-panel"
import SearchProgress, { type SearchLog } from "@/components/search-progress"
import { getRecentSearches, saveSearch } from "@/lib/actions"
import type { Contact, SearchHistoryItem } from "@/lib/types"
import { brazilianStates } from "@/lib/utils/contact-extractor"

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("")
  const [position, setPosition] = useState("todos")
  const [state, setState] = useState("todos")
  const [isLoading, setIsLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [activeTab, setActiveTab] = useState("contatos")
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([])
  const [searchProgress, setSearchProgress] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const history = await getRecentSearches()
        setSearchHistory(history)
      } catch (error) {
        console.error("Erro ao carregar histórico:", error)
      }
    }

    loadSearchHistory()
  }, [])

  // Função para adicionar logs de busca
  const addSearchLog = (source: string, message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    setSearchLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        source,
        message,
        type,
        timestamp: new Date(),
      },
    ])
  }

  const handleSearch = async () => {
    if (!searchTerm.trim() && position === "todos" && state === "todos") {
      toast({
        title: "Critérios de busca vazios",
        description: "Por favor, informe pelo menos um critério de busca.",
        variant: "destructive",
      })
      return
    }

    // Limpar logs anteriores
    setSearchLogs([])
    setIsLoading(true)
    setContacts([]) // Limpar resultados anteriores
    setSearchProgress(0) // Resetar progresso

    // Log inicial
    addSearchLog("Sistema", "Iniciando busca...", "info")

    try {
      // Configurar evento para receber logs do servidor
      const eventSource = new EventSource(
        `/api/search-events?query=${encodeURIComponent(searchTerm)}&position=${position}&state=${state}`,
      )

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === "log") {
            addSearchLog(data.source, data.message, data.logType)
          } else if (data.type === "progress") {
            // Atualizar o progresso da barra
            setSearchProgress(data.value)

            // Disparar um evento personalizado para o componente SearchProgress
            const progressEvent = new CustomEvent("search-progress", {
              detail: { value: data.value },
            })
            window.dispatchEvent(progressEvent)
          } else if (data.type === "complete") {
            eventSource.close()

            // Verificar se há resultados
            if (data.results && Array.isArray(data.results)) {
              // Filtrar contatos que não têm email nem telefone válido
              const validContacts = data.results.filter((contact) => {
                const hasValidEmail = contact.email && contact.email.includes("@")
                const hasValidPhone = contact.phone && /^($$\d{2}$$\s?)?\d{4,5}[-\s]?\d{4}$/.test(contact.phone)
                return hasValidEmail || hasValidPhone
              })

              setContacts(validContacts)

              // Log final
              addSearchLog(
                "Sistema",
                `Busca concluída. Encontrados ${validContacts.length} contatos válidos.`,
                "success",
              )

              // Salvar busca no histórico
              if (validContacts.length > 0) {
                const searchData = {
                  query: searchTerm || "Todos",
                  filters: {
                    position: position !== "todos" ? position : "Todos",
                    state: state !== "todos" ? state : "Todos",
                  },
                  results: validContacts.length,
                }

                saveSearch(searchData).then(async () => {
                  // Atualizar histórico local
                  const updatedHistory = await getRecentSearches()
                  setSearchHistory(updatedHistory)
                })
              }
            } else {
              addSearchLog("Sistema", "Nenhum resultado encontrado.", "warning")
            }

            setIsLoading(false)
            setSearchProgress(100) // Garantir que o progresso chegue a 100% ao finalizar

            toast({
              title: "Busca concluída",
              description: `Encontrados ${data.results ? data.results.length : 0} contatos.`,
            })
          }
        } catch (error) {
          console.error("Erro ao processar mensagem do servidor:", error)
          addSearchLog("Sistema", "Erro ao processar resposta do servidor", "error")
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        addSearchLog("Sistema", "Erro na conexão com o servidor", "error")
        setIsLoading(false)

        toast({
          title: "Erro na busca",
          description: "Ocorreu um erro ao buscar contatos. Tente novamente.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Erro na busca:", error)
      addSearchLog("Sistema", "Erro ao iniciar a busca", "error")
      setIsLoading(false)

      toast({
        title: "Erro na busca",
        description: "Ocorreu um erro ao buscar contatos. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 bg-gray-50">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-2">PrefeituraFinder</h1>
        <p className="text-gray-600 mb-8">Encontre secretários municipais e tomadores de decisão em prefeituras</p>

        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle>Busca de Contatos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nome, cargo ou palavra-chave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar por cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os cargos</SelectItem>
                  <SelectItem value="secretario_educacao">Secretário de Educação</SelectItem>
                  <SelectItem value="secretario_trabalho">Secretário de Trabalho</SelectItem>
                  <SelectItem value="diretor_ti">Diretor de TI</SelectItem>
                  <SelectItem value="compras">Setor de Compras</SelectItem>
                </SelectContent>
              </Select>

              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os estados</SelectItem>
                  {brazilianStates.map((state) => (
                    <SelectItem key={state.abbr} value={state.abbr}>
                      {state.name} ({state.abbr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setSearchTerm("Secretário de Educação")}
              >
                Secretário de Educação
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setSearchTerm("Secretário de Trabalho")}
              >
                Secretário de Trabalho
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setSearchTerm("Licitação Software")}
              >
                Licitação Software
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setSearchTerm("Análise de Dados")}
              >
                Análise de Dados
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => setSearchTerm("Compras Públicas")}
              >
                Compras Públicas
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Componente de progresso da busca */}
        <SearchProgress isSearching={isLoading} logs={searchLogs} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList>
            <TabsTrigger value="contatos">Contatos</TabsTrigger>
            <TabsTrigger value="historico">Histórico de Buscas</TabsTrigger>
            <TabsTrigger value="monitoramento">Monitoramento</TabsTrigger>
          </TabsList>
          <TabsContent value="contatos">
            <ContactTable contacts={contacts} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="historico">
            <SearchHistory
              history={searchHistory}
              onRepeatSearch={async (item) => {
                setSearchTerm(item.query === "Todos" ? "" : item.query)
                setPosition(item.filters.position === "Todos" ? "todos" : item.filters.position)
                setState(item.filters.state === "Todos" ? "todos" : item.filters.state)
                setActiveTab("contatos")
                setTimeout(() => handleSearch(), 100)
              }}
            />
          </TabsContent>
          <TabsContent value="monitoramento">
            <MonitoringPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
