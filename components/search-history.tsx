"use client"

import { Badge } from "@/components/ui/badge"

import { Clock, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { SearchHistoryItem } from "@/lib/types"
import { clearSearchHistory } from "@/lib/actions"
import { useToast } from "@/components/ui/use-toast"

interface SearchHistoryProps {
  history: SearchHistoryItem[]
  onRepeatSearch: (item: SearchHistoryItem) => void
}

export default function SearchHistory({ history, onRepeatSearch }: SearchHistoryProps) {
  const { toast } = useToast()

  const handleClearHistory = async () => {
    try {
      await clearSearchHistory()
      toast({
        title: "Histórico limpo",
        description: "Seu histórico de buscas foi limpo com sucesso.",
      })
      // Recarregar a página para atualizar o histórico
      window.location.reload()
    } catch (error) {
      console.error("Erro ao limpar histórico:", error)
      toast({
        title: "Erro",
        description: "Não foi possível limpar o histórico de buscas.",
        variant: "destructive",
      })
    }
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Nenhuma busca realizada ainda.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Buscas Recentes</h3>
        <Button variant="ghost" size="sm" className="text-gray-500" onClick={handleClearHistory}>
          <Trash2 className="h-4 w-4 mr-2" />
          Limpar histórico
        </Button>
      </div>

      {history.map((item) => (
        <Card key={item.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{item.query}</div>
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                  <span className="mx-2">•</span>
                  <span>{item.results} resultados</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.filters.position !== "Todos" && (
                    <Badge variant="outline" className="text-xs">
                      {item.filters.position}
                    </Badge>
                  )}
                  {item.filters.state !== "Todos" && (
                    <Badge variant="outline" className="text-xs">
                      {item.filters.state}
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRepeatSearch(item)}>
                <Search className="h-4 w-4 mr-2" />
                Repetir
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
