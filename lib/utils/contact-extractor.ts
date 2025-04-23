/**
 * Utilitário para extrair informações de contato de textos
 *
 * Esta função utiliza expressões regulares para identificar padrões
 * de emails, telefones e outros dados de contato em textos.
 */
/**
 * Extrai telefones de um texto
 */
export function extractPhones(text: string): string[] {
  if (!text) return []

  // Padrões comuns de telefones brasileiros
  const patterns = [
    /$$\d{2}$$\s*\d{4,5}[-\s]?\d{4}/g, // (11) 9999-9999 ou (11) 99999-9999
    /\d{2}\s*\d{4,5}[-\s]?\d{4}/g, // 11 9999-9999 ou 11 99999-9999
    /\d{4,5}[-\s]?\d{4}/g, // 9999-9999 ou 99999-9999
  ]

  let phones: string[] = []

  // Aplicar cada padrão e coletar resultados
  patterns.forEach((pattern) => {
    const matches = text.match(pattern)
    if (matches) {
      phones = [...phones, ...matches]
    }
  })

  // Remover duplicatas e filtrar telefones válidos
  return [...new Set(phones)].filter((phone) => isValidBrazilianPhone(phone))
}

// Atualizar a função extractContactInfo para usar a nova função extractPhones
export function extractContactInfo(text: string) {
  if (!text) return { emails: [], phones: [], possibleNames: [] }

  // Extrair emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = text.match(emailRegex) || []

  // Extrair telefones usando a nova função
  const phones = extractPhones(text)

  // Extrair possíveis nomes (palavras capitalizadas em sequência)
  const nameRegex = /([A-Z][a-zÀ-ÖØ-öø-ÿ]+\s){1,}([A-Z][a-zÀ-ÖØ-öø-ÿ]+)/g
  const names = text.match(nameRegex) || []

  return {
    emails,
    phones,
    possibleNames: names.length > 0 ? names : ["Não identificado"],
  }
}

/**
 * Verifica se uma string é um número de telefone brasileiro válido
 */
export function isValidBrazilianPhone(phone: string): boolean {
  // Remover todos os caracteres não numéricos
  const digitsOnly = phone.replace(/\D/g, "")

  // Verificar se tem entre 8 e 11 dígitos (telefone fixo ou celular, com ou sem DDD)
  if (digitsOnly.length < 8 || digitsOnly.length > 11) {
    return false
  }

  // Verificar se não é uma sequência de dígitos repetidos (ex: 11111111)
  if (/^(\d)\1+$/.test(digitsOnly)) {
    return false
  }

  // Verificar se o DDD é válido (quando presente)
  if (digitsOnly.length >= 10) {
    const ddd = Number.parseInt(digitsOnly.substring(0, 2))
    // DDDs válidos no Brasil vão de 11 a 99, com algumas exceções
    if (ddd < 11 || ddd > 99) {
      return false
    }
  }

  // Verificar se o formato é válido para exibição
  const formattedPhone = formatPhone(digitsOnly)
  return /^($$\d{2}$$\s?)?\d{4,5}[-\s]?\d{4}$/.test(formattedPhone)
}

/**
 * Formata um número de telefone para exibição
 */
export function formatPhone(phone: string): string {
  // Remover todos os caracteres não numéricos
  const digitsOnly = phone.replace(/\D/g, "")

  // Formatar com DDD
  if (digitsOnly.length >= 10) {
    const ddd = digitsOnly.substring(0, 2)
    const firstPart = digitsOnly.length === 11 ? digitsOnly.substring(2, 7) : digitsOnly.substring(2, 6)
    const secondPart = digitsOnly.length === 11 ? digitsOnly.substring(7) : digitsOnly.substring(6)
    return `(${ddd}) ${firstPart}-${secondPart}`
  }

  // Formatar sem DDD
  if (digitsOnly.length === 9) {
    return `${digitsOnly.substring(0, 5)}-${digitsOnly.substring(5)}`
  }

  if (digitsOnly.length === 8) {
    return `${digitsOnly.substring(0, 4)}-${digitsOnly.substring(4)}`
  }

  // Se não conseguir formatar, retorna o original
  return phone
}

/**
 * Utilitário para normalizar nomes de cargos
 *
 * Esta função padroniza diferentes variações de nomes de cargos
 * para facilitar a comparação e filtragem.
 */
export function normalizePosition(position: string): string {
  if (!position) return "Não especificado"

  position = position.toLowerCase().trim()

  // Mapeamento de variações comuns
  const mappings: Record<string, string> = {
    // Secretário de Educação
    "secretário de educação": "Secretário Municipal de Educação",
    "secretária de educação": "Secretário Municipal de Educação",
    "secretário municipal de educação": "Secretário Municipal de Educação",
    "secretária municipal de educação": "Secretário Municipal de Educação",
    "sec. de educação": "Secretário Municipal de Educação",
    "sec. municipal de educação": "Secretário Municipal de Educação",

    // Secretário de Trabalho
    "secretário de trabalho": "Secretário Municipal de Trabalho",
    "secretária de trabalho": "Secretário Municipal de Trabalho",
    "secretário municipal de trabalho": "Secretário Municipal de Trabalho",
    "secretária municipal de trabalho": "Secretário Municipal de Trabalho",
    "sec. de trabalho": "Secretário Municipal de Trabalho",
    "sec. municipal de trabalho": "Secretário Municipal de Trabalho",
    "secretário de trabalho e renda": "Secretário Municipal de Trabalho",
    "secretário municipal de trabalho e renda": "Secretário Municipal de Trabalho",

    // Diretor de TI
    "diretor de ti": "Diretor de Tecnologia da Informação",
    "diretora de ti": "Diretor de Tecnologia da Informação",
    "diretor de tecnologia": "Diretor de Tecnologia da Informação",
    "diretora de tecnologia": "Diretor de Tecnologia da Informação",
    "diretor de tecnologia da informação": "Diretor de Tecnologia da Informação",
    "diretora de tecnologia da informação": "Diretor de Tecnologia da Informação",
    "gerente de ti": "Diretor de Tecnologia da Informação",
    "coordenador de ti": "Diretor de Tecnologia da Informação",

    // Diretor de Compras
    "diretor de compras": "Diretor de Compras",
    "diretora de compras": "Diretor de Compras",
    "diretor de licitações": "Diretor de Compras",
    "diretora de licitações": "Diretor de Compras",
    "diretor de compras e licitações": "Diretor de Compras",
    "diretora de compras e licitações": "Diretor de Compras",
    "coordenador de compras": "Diretor de Compras",
    "coordenadora de compras": "Diretor de Compras",
    "responsável por compras": "Diretor de Compras",
  }

  return mappings[position] || position.charAt(0).toUpperCase() + position.slice(1)
}

/**
 * Utilitário para extrair informações de departamento
 *
 * Esta função identifica o departamento com base no cargo
 * quando essa informação não está explícita.
 */
export function inferDepartmentFromPosition(position: string): string {
  if (!position) return "Prefeitura Municipal"

  position = position.toLowerCase().trim()

  if (position.includes("educação")) {
    return "Secretaria Municipal de Educação"
  }

  if (position.includes("trabalho")) {
    return "Secretaria Municipal de Trabalho"
  }

  if (position.includes("tecnologia") || position.includes("ti")) {
    return "Secretaria Municipal de Administração"
  }

  if (position.includes("compras") || position.includes("licitações")) {
    return "Secretaria Municipal de Administração"
  }

  return "Prefeitura Municipal"
}

/**
 * Lista de estados brasileiros com suas siglas
 */
export const brazilianStates = [
  { name: "Acre", abbr: "AC" },
  { name: "Alagoas", abbr: "AL" },
  { name: "Amapá", abbr: "AP" },
  { name: "Amazonas", abbr: "AM" },
  { name: "Bahia", abbr: "BA" },
  { name: "Ceará", abbr: "CE" },
  { name: "Distrito Federal", abbr: "DF" },
  { name: "Espírito Santo", abbr: "ES" },
  { name: "Goiás", abbr: "GO" },
  { name: "Maranhão", abbr: "MA" },
  { name: "Mato Grosso", abbr: "MT" },
  { name: "Mato Grosso do Sul", abbr: "MS" },
  { name: "Minas Gerais", abbr: "MG" },
  { name: "Pará", abbr: "PA" },
  { name: "Paraíba", abbr: "PB" },
  { name: "Paraná", abbr: "PR" },
  { name: "Pernambuco", abbr: "PE" },
  { name: "Piauí", abbr: "PI" },
  { name: "Rio de Janeiro", abbr: "RJ" },
  { name: "Rio Grande do Norte", abbr: "RN" },
  { name: "Rio Grande do Sul", abbr: "RS" },
  { name: "Rondônia", abbr: "RO" },
  { name: "Roraima", abbr: "RR" },
  { name: "Santa Catarina", abbr: "SC" },
  { name: "São Paulo", abbr: "SP" },
  { name: "Sergipe", abbr: "SE" },
  { name: "Tocantins", abbr: "TO" },
]
