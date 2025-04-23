/**
 * Utilitário para extrair informações de contato de textos
 *
 * Esta função utiliza expressões regulares para identificar padrões
 * de emails, telefones e outros dados de contato em textos.
 */
export function extractContactInfo(text: string) {
  if (!text) return { emails: [], phones: [], possibleNames: [] }

  // Extrair emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = text.match(emailRegex) || []
  // Extrair telefones (formatos comuns no Brasil)
  const phoneRegex = /(\d{2}[\s.-]?)?\d{4,5}[-\s.]?\d{4}/g
  const phones = text.match(phoneRegex) || []

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
