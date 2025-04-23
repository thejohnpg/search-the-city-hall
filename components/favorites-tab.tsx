"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Phone, MapPin, Building, Download, Star, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Contact } from "@/lib/types"
import { toggleFavoriteContact, getFavoriteContacts, exportContactsToCSV } from "@/lib/actions"
import { useToast } from "@/components/ui/use-toast"

export default function FavoritesTab() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [favoriteContacts, setFavoriteContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Carregar favoritos ao montar o componente
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setIsLoading(true)
        const favs = await getFavoriteContacts()
        setFavorites(favs)

        // Carregar os contatos favoritos do localStorage
        const storedContacts = localStorage.getItem("favoriteContacts")
        if (storedContacts) {
          const contacts = JSON.parse(storedContacts) as Contact[]
          // Filtrar apenas os contatos que estão na lista de favoritos
          const filteredContacts = contacts.filter((contact) => favs.includes(contact.id))
          setFavoriteContacts(filteredContacts)
        }

        setIsLoading(false)
      } catch (error) {
        console.error("Erro ao carregar favoritos:", error)
        setIsLoading(false)
      }
    }

    loadFavorites()
  }, [])

  const handleToggleFavorite = async (id: string) => {
    try {
      const result = await toggleFavoriteContact(id)
      if (result.success) {
        // Remover o contato da lista de favoritos
        setFavoriteContacts(favoriteContacts.filter((contact) => contact.id !== id))
        setFavorites(favorites.filter((favId) => favId !== id))

        // Atualizar o localStorage
        const storedContacts = localStorage.getItem("favoriteContacts")
        if (storedContacts) {
          const contacts = JSON.parse(storedContacts) as Contact[]
          const updatedContacts = contacts.filter((contact) => contact.id !== id)
          localStorage.setItem("favoriteContacts", JSON.stringify(updatedContacts))
        }
      }
    } catch (error) {
      console.error("Erro ao desfavoritar contato:", error)
    }
  }

  const handleExportCSV = async () => {
    try {
      const result = await exportContactsToCSV(favoriteContacts)
      if (result.success) {
        // Criar um link para download
        const url = window.URL.createObjectURL(new Blob([result.csv], { type: "text/csv" }))
        const link = document.createElement("a")
        link.href = url
        link.setAttribute("download", `contatos-favoritos-${new Date().toISOString().split("T")[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()

        toast({
          title: "Exportação concluída",
          description: "Os contatos favoritos foram exportados com sucesso.",
        })
      }
    } catch (error) {
      console.error("Erro ao exportar contatos:", error)
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os contatos favoritos.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-32 mb-4" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-56" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-52" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (favoriteContacts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum contato favorito</h3>
          <p className="text-gray-500 mb-4">
            Você ainda não adicionou nenhum contato aos favoritos. Clique no ícone de estrela em um contato para
            adicioná-lo aqui.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{favoriteContacts.length} contatos favoritos</p>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {favoriteContacts.map((contact) => (
        <Card key={contact.id} className="overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-0">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{contact.name}</h3>
                  <p className="text-gray-600 mb-3">{contact.position}</p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <Building className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{contact.department}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      <span>
                        {contact.city}, {contact.state}
                      </span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        <a href={`tel:${contact.phone.replace(/\D/g, "")}`} className="text-blue-600 hover:underline">
                          {contact.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center text-xs text-gray-500">
                    <span>Atualizado em: {contact.lastUpdated}</span>
                    <span className="mx-2">•</span>
                    <span>Fonte: {contact.source}</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleFavorite(contact.id)}
                  className="text-yellow-400"
                >
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </Button>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-3 flex justify-between items-center">
              <div className="flex gap-2">
                <Badge variant="outline">{contact.position}</Badge>
                <Badge variant="outline">{contact.city}</Badge>
              </div>
              <div className="flex gap-2">
                {contact.email && (
                  <Button size="sm" variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Contatar
                  </Button>
                )}
                {contact.sourceUrl && (
                  <Button size="sm" variant="default" onClick={() => window.open(contact.sourceUrl, "_blank")}>
                    Ver Fonte
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
