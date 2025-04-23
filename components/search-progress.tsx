"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface SearchProgressProps {
  isSearching: boolean
  logs: SearchLog[]
}

export interface SearchLog {
  id: string
  source: string
  message: string
  type: "info" | "success" | "error" | "warning"
  timestamp: Date
}

export default function SearchProgress({ isSearching, logs }: SearchProgressProps) {
  const [progress, setProgress] = useState(0)

  // Atualizar o progresso quando receber eventos do servidor
  useEffect(() => {
    // Escutar eventos de progresso do servidor
    const handleProgressEvent = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.value === "number") {
        setProgress(event.detail.value)
      }
    }

    // Registrar o ouvinte de eventos
    window.addEventListener("search-progress", handleProgressEvent as EventListener)

    // Limpar o ouvinte quando o componente for desmontado
    return () => {
      window.removeEventListener("search-progress", handleProgressEvent as EventListener)
    }
  }, [])

  // Resetar o progresso quando a busca terminar
  useEffect(() => {
    if (!isSearching && logs.length > 0) {
      // Busca concluída
      setProgress(100)
    } else if (!isSearching && logs.length === 0) {
      // Nenhuma busca em andamento ou concluída
      setProgress(0)
    }
  }, [isSearching, logs.length])

  if (!isSearching && logs.length === 0) {
    return null
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Progresso da Busca</span>
          {isSearching ? (
            <Badge variant="outline" className="bg-blue-50">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Buscando...
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-50">
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
              Concluído
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={progress} className="mb-4" />

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start text-sm">
              <div className="mr-2 mt-0.5">
                {log.type === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                {log.type === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                {log.type === "warning" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                {log.type === "info" && <Loader2 className="h-4 w-4 text-blue-500" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="font-medium">{log.source}</span>
                  <span className="text-xs text-gray-400">
                    {log.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <p className="text-gray-600">{log.message}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
