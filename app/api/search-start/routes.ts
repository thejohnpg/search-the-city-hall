import { NextResponse } from "next/server"

// Rota para iniciar o processo de busca
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query") || ""
  const position = searchParams.get("position") || "todos"
  const state = searchParams.get("state") || "todos"

  // Esta rota apenas confirma que a busca foi iniciada
  // O processamento real acontece em search-events
  return NextResponse.json({
    success: true,
    message: "Busca iniciada com sucesso",
    params: { query, position, state },
  })
}
