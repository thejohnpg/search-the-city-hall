"use client"

import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Mail,
  Phone,
  ExternalLink,
  Download,
  Search,
  Star,
  StarOff,
} from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { Contact } from "@/lib/types"
import { toggleFavoriteContact, exportContactsToCSV, getFavoriteContacts } from "@/lib/actions"
import { useToast } from "@/components/ui/use-toast"

interface ContactTableProps {
  contacts: Contact[]
  isLoading: boolean
}

export default function ContactTable({ contacts, isLoading }: ContactTableProps) {
  const [favorites, setFavorites] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchFilter, setSearchFilter] = useState("")
  const [stateFilter, setStateFilter] = useState<string>("todos")
  const [positionFilter, setPositionFilter] = useState<string>("todos")
  const { toast } = useToast()

  // Carregar favoritos ao montar o componente
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await getFavoriteContacts()
        setFavorites(favs)
      } catch (error) {
        console.error("Erro ao carregar favoritos:", error)
      }
    }

    loadFavorites()
  }, [])

  // Filtrar contatos com base nos critérios
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      // Filtrar apenas contatos que tenham pelo menos email ou telefone
      if (!contact.email && !contact.phone) return false

      // Filtrar por texto de busca
      if (searchFilter && !contactMatchesSearch(contact, searchFilter)) return false

      // Filtrar por estado
      if (stateFilter !== "todos" && contact.state !== stateFilter) return false

      // Filtrar por cargo
      if (positionFilter !== "todos") {
        const normalizedPosition = contact.position.toLowerCase()
        if (positionFilter === "secretario_educacao" && !normalizedPosition.includes("educação")) return false
        if (positionFilter === "secretario_trabalho" && !normalizedPosition.includes("trabalho")) return false
        if (
          positionFilter === "diretor_ti" &&
          !normalizedPosition.includes("tecnologia") &&
          !normalizedPosition.includes("ti")
        )
          return false
        if (positionFilter === "compras" && !normalizedPosition.includes("compras")) return false
      }

      return true
    })
  }, [contacts, searchFilter, stateFilter, positionFilter])

  // Calcular paginação
  const totalPages = Math.ceil(filteredContacts.length / pageSize)
  const paginatedContacts = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filteredContacts.slice(start, end)
  }, [filteredContacts, page, pageSize])

  // Extrair estados únicos para o filtro
  const uniqueStates = useMemo(() => {
    const states = new Set<string>()
    contacts.forEach((contact) => {
      if (contact.state) states.add(contact.state)
    })
    return Array.from(states).sort()
  }, [contacts])

  const handleToggleFavorite = async (id: string) => {
    try {
      const result = await toggleFavoriteContact(id)
      if (result.success) {
        if (favorites.includes(id)) {
          setFavorites(favorites.filter((favId) => favId !== id))
        } else {
          setFavorites([...favorites, id])
        }
      }
    } catch (error) {
      console.error("Erro ao favoritar contato:", error)
    }
  }

  const handleExportCSV = async () => {
    try {
      const result = await exportContactsToCSV(filteredContacts)
      if (result.success) {
        // Criar um link para download
        const url = window.URL.createObjectURL(new Blob([result.csv], { type: "text/csv" }))
        const link = document.createElement("a")
        link.href = url
        link.setAttribute("download", `contatos-prefeituras-${new Date().toISOString().split("T")[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()

        toast({
          title: "Exportação concluída",
          description: "Os contatos foram exportados com sucesso.",
        })
      }
    } catch (error) {
      console.error("Erro ao exportar contatos:", error)
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os contatos.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando contatos...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum contato encontrado</h3>
          <p className="text-gray-500 mb-4">
            Tente ajustar seus critérios de busca ou use termos mais gerais para encontrar resultados.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contatos Encontrados</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Filtrar por nome, cargo ou departamento..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value)
                setPage(1) // Voltar para a primeira página ao filtrar
              }}
              className="w-full"
            />
          </div>
          <Select
            value={stateFilter}
            onValueChange={(value) => {
              setStateFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              {uniqueStates.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={positionFilter}
            onValueChange={(value) => {
              setPositionFilter(value)
              setPage(1)
            }}
          >
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
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Nenhum contato corresponde aos filtros selecionados
                  </TableCell>
                </TableRow>
              ) : (
                paginatedContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleToggleFavorite(contact.id)}
                        >
                          {favorites.includes(contact.id) ? (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                        {contact.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{contact.position}</Badge>
                    </TableCell>
                    <TableCell>{contact.department}</TableCell>
                    <TableCell>
                      {contact.city && contact.state
                        ? `${contact.city}, ${contact.state}`
                        : contact.city || contact.state || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {contact.email && (
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline text-sm">
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-1 text-gray-400" />
                            <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline text-sm">
                              {contact.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {contact.sourceUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(contact.sourceUrl, "_blank")}
                          title="Ver fonte"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Mostrando {Math.min(filteredContacts.length, (page - 1) * pageSize + 1)}-
          {Math.min(page * pageSize, filteredContacts.length)} de {filteredContacts.length} contatos
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(page - 1)} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Página {page} de {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages || totalPages === 0}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(Number(value))
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder="10" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardFooter>
    </Card>
  )
}

// Função auxiliar para verificar se um contato corresponde à busca
function contactMatchesSearch(contact: Contact, search: string): boolean {
  const searchLower = search.toLowerCase()
  return Boolean(
    (contact.name && contact.name.toLowerCase().includes(searchLower)) ||
    (contact.position && contact.position.toLowerCase().includes(searchLower)) ||
    (contact.department && contact.department.toLowerCase().includes(searchLower)) ||
    (contact.city && contact.city.toLowerCase().includes(searchLower)) ||
    (contact.email && contact.email.toLowerCase().includes(searchLower))
  )
}
