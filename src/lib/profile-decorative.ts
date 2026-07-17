// Requirement 12.4 — a previsão do tempo da "próxima aventura" em `/perfil`
// não tem fonte de dado real integrada neste spec (`fetchNextAdventure`
// sempre retorna `forecast: []`). Em vez de exibir a seção com um espaço
// vazio, ela deve ser ocultada por completo enquanto não houver forecast.
//
// Função pura extraída da condição de renderização para ser testável por
// property test (ver design.md, Property 29) sem depender de JSX/React.
export function shouldShowForecast(forecast: unknown[] | null | undefined): boolean {
  return Array.isArray(forecast) && forecast.length > 0;
}
