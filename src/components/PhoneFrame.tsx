import { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    // Bug corrigido (pedido pelo usuário): antes o frame usava `min-h-screen`
    // (altura MÍNIMA), o que permitia o container crescer conforme o
    // conteúdo interno (ex.: lista de posts da comunidade) — o scroll real
    // acabava acontecendo na página inteira (documento), não dentro de
    // `<main>`. Com o menu inferior fora do fluxo de rolagem em `__root.tsx`
    // (renderizado como irmão de `<main>`, não dentro dele), ele só ficava
    // visível ao rolar até o fim absoluto de TODO o conteúdo — impraticável
    // com centenas/milhares de posts.
    //
    // Trocado para `h-[100dvh]` (altura FIXA = altura visível do viewport,
    // `dvh` já descontando barras dinâmicas do navegador mobile). Combinado
    // com `overflow-hidden` aqui e `overflow-y-auto` em `<main>`
    // (`__root.tsx`), o scroll passa a ficar contido dentro de `<main>`,
    // e o menu inferior permanece sempre visível na tela — comportamento do
    // Instagram (nunca precisa rolar até o fim para encontrá-lo).
    <div className="h-[100dvh] w-full max-w-full overflow-x-hidden bg-gradient-forest flex items-center justify-center p-0 sm:p-6">
      <div className="relative w-full max-w-full h-[100dvh] sm:max-w-[420px] sm:h-[860px] sm:rounded-[2.5rem] overflow-hidden bg-background sm:shadow-float sm:border sm:border-white/10">
        {children}
      </div>
    </div>
  );
}
