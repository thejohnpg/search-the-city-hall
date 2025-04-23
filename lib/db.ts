import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "./firebase"
import type { Contact, SearchHistoryItem, MonitoringAlert } from "./types"

// Interface para o banco de dados usando Firestore
class Database {
  // Método para salvar resultados de busca
  async saveSearchResults(contacts: Contact[]): Promise<void> {
    try {
      // Salvar cada contato no Firestore
      for (const contact of contacts) {
        // Verificar se o contato já existe
        const contactsRef = collection(db, "contacts")
        const q = query(contactsRef, where("id", "==", contact.id))
        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          // Adicionar novo contato
          await addDoc(collection(db, "contacts"), {
            ...contact,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        } else {
          // Atualizar contato existente
          const docRef = doc(db, "contacts", querySnapshot.docs[0].id)
          await updateDoc(docRef, {
            ...contact,
            updatedAt: serverTimestamp(),
          })
        }
      }
    } catch (error) {
      console.error("Erro ao salvar resultados no Firestore:", error)
      throw error
    }
  }

  // Método para salvar histórico de busca
  async saveSearchHistory(searchData: Omit<SearchHistoryItem, "id">): Promise<string> {
    try {
      // Adicionar nova busca ao histórico
      const docRef = await addDoc(collection(db, "searchHistory"), {
        ...searchData,
        timestamp: serverTimestamp(),
      })

      return docRef.id
    } catch (error) {
      console.error("Erro ao salvar histórico no Firestore:", error)
      throw error
    }
  }

  // Método para obter histórico de buscas
  async getSearchHistory(limitCount = 10): Promise<SearchHistoryItem[]> {
    try {
      const historyRef = collection(db, "searchHistory")
      const q = query(historyRef, orderBy("timestamp", "desc"), limit(limitCount))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          query: data.query,
          timestamp:
            data.timestamp instanceof Timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString(),
          results: data.results,
          filters: data.filters,
        }
      })
    } catch (error) {
      console.error("Erro ao obter histórico do Firestore:", error)
      return []
    }
  }

  // Método para limpar histórico de buscas
  async clearSearchHistory(): Promise<void> {
    try {
      const historyRef = collection(db, "searchHistory")
      const querySnapshot = await getDocs(historyRef)

      // Excluir cada documento
      const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref))
      await Promise.all(deletePromises)
    } catch (error) {
      console.error("Erro ao limpar histórico no Firestore:", error)
      throw error
    }
  }

  // Método para favoritar/desfavoritar contato
  async toggleFavorite(contactId: string): Promise<void> {
    try {
      // Verificar se o contato existe nos favoritos
      const favoritesRef = collection(db, "favorites")
      const q = query(favoritesRef, where("userId", "==", "anonymous"), where("contactId", "==", contactId))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        // Adicionar aos favoritos
        await addDoc(collection(db, "favorites"), {
          userId: "anonymous", // Em um sistema real, seria o ID do usuário logado
          contactId: contactId,
          createdAt: serverTimestamp(),
        })
      } else {
        // Remover dos favoritos
        await deleteDoc(querySnapshot.docs[0].ref)
      }
    } catch (error) {
      console.error("Erro ao alternar favorito no Firestore:", error)
      throw error
    }
  }

  // Método para verificar se um contato é favorito
  async getFavorites(): Promise<string[]> {
    try {
      const favoritesRef = collection(db, "favorites")
      const q = query(favoritesRef, where("userId", "==", "anonymous"))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map((doc) => doc.data().contactId)
    } catch (error) {
      console.error("Erro ao obter favoritos do Firestore:", error)
      return []
    }
  }

  // Método para criar alerta de monitoramento
  async createMonitoringAlert(alertData: Omit<MonitoringAlert, "id">): Promise<string> {
    try {
      // Adicionar novo alerta
      const docRef = await addDoc(collection(db, "monitoringAlerts"), {
        ...alertData,
        createdAt: serverTimestamp(),
      })

      return docRef.id
    } catch (error) {
      console.error("Erro ao criar alerta no Firestore:", error)
      throw error
    }
  }

  // Método para obter alertas ativos
  async getActiveMonitoringAlerts(): Promise<MonitoringAlert[]> {
    try {
      const alertsRef = collection(db, "monitoringAlerts")
      const q = query(alertsRef, where("isActive", "==", true))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          keyword: data.keyword,
          email: data.email,
          isActive: data.isActive,
          lastCheck: data.lastCheck || new Date().toISOString(),
        }
      })
    } catch (error) {
      console.error("Erro ao obter alertas do Firestore:", error)
      return []
    }
  }

  // Método para atualizar a data da última verificação de um alerta
  async updateAlertLastCheck(alertId: string, lastCheck: string): Promise<void> {
    try {
      const alertRef = doc(db, "monitoringAlerts", alertId)
      await updateDoc(alertRef, { lastCheck })
    } catch (error) {
      console.error("Erro ao atualizar alerta no Firestore:", error)
      throw error
    }
  }
}

// Exportar instância do banco de dados
export const firestore = new Database()
