"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Plus, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { createMonitoringAlert, getActiveMonitors } from "@/lib/actions"

export default function MonitoringPanel() {
  const [isCreating, setIsCreating] = useState(false)
  const [newKeyword, setNewKeyword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [monitors, setMonitors] = useState<any[]>([])
  const { toast } = useToast()

  // Carregar alertas ativos ao montar o componente
  useEffect(() => {
    const loadMonitors = async () => {
      try {
        const activeMonitors = await getActiveMonitors()
        setMonitors(activeMonitors)
      } catch (error) {
        console.error("Erro ao carregar alertas:", error)
      }
    }

    loadMonitors()
  }, [])

  const handleCreateMonitor = async () => {
    if (!newKeyword.trim() || !newEmail.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a palavra-chave e o email para criar o alerta.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const result = await createMonitoringAlert({
        keyword: newKeyword,
        email: newEmail,
      })

      if (result.success) {
        setMonitors([
          ...monitors,
          {
            id: result.id,
            keyword: newKeyword,
            isActive: true,
            lastCheck: new Date().toISOString(),
            email: newEmail,
          },
        ])

        setNewKeyword("")
        setNewEmail("")
        setIsCreating(false)

        toast({
          title: "Alerta criado",
          description: "Seu alerta de monitoramento foi criado com sucesso.",
        })
      }
    } catch (error) {
      console.error("Erro ao criar alerta:", error)
      toast({
        title: "Erro",
        description: "Não foi possível criar o alerta de monitoramento.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Monitoramento de Atualizações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-6">
            Configure alertas para receber notificações quando novos contatos relevantes forem encontrados. Você
            receberá um email sempre que encontrarmos novos contatos que correspondam aos seus critérios.
          </p>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Alertas Ativos</h3>
              <Button variant="outline" size="sm" onClick={() => setIsCreating(true)} disabled={isCreating}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Alerta
              </Button>
            </div>

            {isCreating && (
              <Card className="border-dashed border-2 p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="keyword">Palavra-chave ou termo de busca</Label>
                    <Input
                      id="keyword"
                      placeholder="Ex: Secretário de Educação, Licitação Software..."
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email para notificações</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIsCreating(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateMonitor} disabled={isLoading}>
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {monitors.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum alerta configurado.</p>
            ) : (
              <div className="space-y-4">
                {monitors.map((monitor) => (
                  <Card key={monitor.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{monitor.keyword}</div>
                          <div className="text-sm text-gray-500 mt-1">Notificações para: {monitor.email}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            Última verificação: {new Date(monitor.lastCheck).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center space-x-2">
                            <Switch id={`active-${monitor.id}`} checked={monitor.isActive} />
                            <Label htmlFor={`active-${monitor.id}`}>Ativo</Label>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frequência de Verificação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Nosso sistema verifica automaticamente novas informações nas seguintes fontes:
          </p>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Diários Oficiais</div>
                <div className="text-sm text-gray-500">Verificação diária</div>
              </div>
              <Badge>Diário</Badge>
            </div>
            <Separator />

            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Portais de Transparência</div>
                <div className="text-sm text-gray-500">Verificação semanal</div>
              </div>
              <Badge>Semanal</Badge>
            </div>
            <Separator />

            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Sites de Prefeituras</div>
                <div className="text-sm text-gray-500">Verificação semanal</div>
              </div>
              <Badge>Semanal</Badge>
            </div>
            <Separator />

            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Portal de Compras Governamentais</div>
                <div className="text-sm text-gray-500">Verificação diária</div>
              </div>
              <Badge>Diário</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
