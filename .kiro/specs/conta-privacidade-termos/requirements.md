# Requirements Document

Requisitos — Conta, Privacidade e Termos de Uso

## Introduction

Antes de submeter o OutVitar às lojas (Apple App Store e Google Play), o app
precisa cumprir requisitos legais e de política das lojas que hoje não estão
implementados: **Termos de Uso e Política de Privacidade com aceite
obrigatório**, e um **mecanismo de exclusão de conta** acessível dentro do
app. Ambos são bloqueadores de submissão (Apple Guideline 5.1.1(v) exige
exclusão de conta in-app; Google exige política de privacidade e, para apps
com login, também caminho de exclusão de conta/dados).

O app é uma plataforma outdoor estilo Strava com **marketplace de parceiros**
e **conteúdo gerado por usuários** (posts, atividades, comentários, mensagens),
além de coleta de **localização/GPS**. Os documentos devem refletir esse
modelo: isentar a plataforma de negociações entre usuários e de conteúdo de
terceiros, na medida do que a lei permite, e ser transparentes sobre coleta,
uso, compartilhamento e **retenção** de dados (LGPD no Brasil; alinhado a
GDPR/CCPA como boas práticas de mercado).

> **Nota:** os textos jurídicos produzidos aqui são uma **minuta baseada em
> práticas de mercado**, para posterior validação por advogado. Não constituem
> aconselhamento jurídico.

## Glossary

- **UGC**: conteúdo gerado pelo usuário (posts, atividades, comentários, mensagens).
- **LGPD**: Lei Geral de Proteção de Dados (Brasil).
- **Titular**: pessoa a quem os dados pessoais se referem.
- **Retenção**: prazo e forma de guarda dos dados após exclusão de conta.
- **Gate**: bloqueio de uso do app até o aceite dos termos vigentes.

## Requirements

### Requisito 1 — Documentos legais (Termos de Uso + Política de Privacidade)

**User Story:** Como operador do OutVitar, quero Termos de Uso e Política de
Privacidade completos e em português (com versão em inglês), para cumprir a
LGPD e as políticas das lojas e limitar a responsabilidade da plataforma.

#### Critérios de Aceitação
1. QUANDO os documentos forem criados ENTÃO o sistema DEVE conter um **Termo de
   Uso** cobrindo, no mínimo: aceite/elegibilidade (idade mínima), conta e
   segurança, conduta do usuário, conteúdo gerado pelo usuário (licença e
   responsabilidade do autor), marketplace/parceiros (isenção de
   responsabilidade por negociações e transações entre usuários e parceiros),
   pagamentos em lojas virtuais (isenção pelo uso, ressalvado o que a lei
   obriga), propriedade intelectual, isenção de garantias, limitação de
   responsabilidade, indenização, suspensão/encerramento, alteração dos termos,
   lei aplicável e foro.
2. QUANDO os documentos forem criados ENTÃO o sistema DEVE conter uma
   **Política de Privacidade** cobrindo: dados coletados (cadastro,
   localização/GPS, atividades, conteúdo, uso/telemetria, dispositivo), base
   legal (LGPD art. 7º), finalidades, compartilhamento (Supabase, mapas,
   notificações push, parceiros quando aplicável), direitos do titular (acesso,
   correção, exclusão, portabilidade, revogação de consentimento),
   **retenção e prazos de exclusão**, segurança, transferência internacional,
   dados de menores, cookies/identificadores, e contato do controlador/DPO.
3. QUANDO houver risco de conflito ENTÃO os documentos DEVEM deixar claro que
   são minuta sujeita a validação jurídica.
4. QUANDO os documentos forem versionados ENTÃO cada um DEVE ter um campo de
   **versão e data** de vigência, para permitir re-aceite quando mudarem.

### Requisito 2 — Aceite obrigatório no primeiro acesso

**User Story:** Como usuário novo (ou existente que ainda não aceitou), quero
ser apresentado aos Termos e à Privacidade e precisar aceitar antes de usar o
app, para que meu consentimento fique registrado.

#### Critérios de Aceitação
1. QUANDO um usuário autenticado ainda não tiver aceitado a versão vigente dos
   termos ENTÃO o sistema DEVE exibir uma tela/modal de aceite bloqueante antes
   de liberar o uso das funcionalidades principais.
2. QUANDO o usuário aceitar ENTÃO o sistema DEVE registrar o aceite (usuário,
   versão dos termos, data/hora) de forma persistente e auditável.
3. QUANDO o usuário recusar ENTÃO o sistema NÃO DEVE liberar o uso e DEVE
   oferecer sair da conta.
4. QUANDO a versão vigente dos termos mudar (nova versão) ENTÃO o sistema DEVE
   voltar a exigir o aceite da nova versão no próximo acesso.
5. QUANDO o aceite for registrado ENTÃO os documentos DEVEM permanecer
   acessíveis a qualquer momento (link em Configurações e/ou no rodapé do
   modal), inclusive antes do login (rota pública).

### Requisito 3 — Exclusão de conta (in-app)

**User Story:** Como usuário, quero poder excluir minha conta pelo próprio app,
para exercer meu direito e cumprir o que as lojas exigem.

#### Critérios de Aceitação
1. QUANDO o usuário acessar Configurações ENTÃO o sistema DEVE oferecer a opção
   "Excluir minha conta".
2. QUANDO o usuário solicitar exclusão ENTÃO o sistema DEVE exigir confirmação
   explícita (ex.: digitar uma palavra/senha) e explicar as consequências e o
   que acontece com os dados.
3. QUANDO a exclusão for confirmada ENTÃO o sistema DEVE executar a exclusão/
   anonimização dos dados pessoais do usuário conforme a política de retenção
   definida (Requisito 4), encerrar a sessão e impedir novo login com a conta
   excluída.
4. QUANDO houver conteúdo público do usuário (posts, atividades, comentários)
   ENTÃO o sistema DEVE tratar esse conteúdo conforme a política (excluir ou
   anonimizar — decisão documentada), sem quebrar integridade referencial.
5. QUANDO a exclusão ocorrer ENTÃO a operação DEVE ser segura contra abuso
   (só o próprio dono; auditável) e refletir imediatamente (o usuário não
   consegue mais autenticar).

### Requisito 4 — Retenção e ciclo de vida dos dados

**User Story:** Como operador, quero uma política clara de retenção alinhada ao
mercado e à LGPD, para saber o que guardar, por quanto tempo e como.

#### Critérios de Aceitação
1. QUANDO a conta for excluída ENTÃO o sistema DEVE remover ou anonimizar os
   dados pessoais em prazo definido (padrão de mercado: exclusão imediata dos
   dados de identificação e período de carência curto — ex.: até 30 dias — para
   remoção completa em backups), documentado na Política.
2. QUANDO houver obrigação legal de guarda (ex.: registros fiscais/financeiros
   de transações, logs de acesso exigidos por lei) ENTÃO o sistema DEVE reter
   apenas o mínimo necessário pelo prazo legal, de forma segregada.
3. QUANDO dados forem anonimizados ENTÃO NÃO DEVE ser possível reidentificar o
   titular (ex.: substituir nome/e-mail por identificador neutro em conteúdo
   que precise ser mantido por integridade estatística/histórica).
4. QUANDO a política definir prazos ENTÃO esses prazos DEVEM constar
   explicitamente na Política de Privacidade (Requisito 1.2).

### Requisito 5 — Exportação/portabilidade (desejável, alinhado ao mercado)

**User Story:** Como usuário, quero poder solicitar uma cópia dos meus dados,
para exercer o direito de portabilidade da LGPD.

#### Critérios de Aceitação
1. QUANDO o usuário solicitar seus dados ENTÃO o sistema DEVE fornecer um meio
   de obter os dados pessoais e conteúdo próprios (mínimo: perfil + atividades),
   ainda que de forma simples (arquivo JSON) — pode ser fase 2 se necessário.

### Requisito 6 — URLs públicas para as lojas

**User Story:** Como operador, preciso de URLs públicas dos documentos, porque
Apple e Google exigem link de política de privacidade na ficha do app.

#### Critérios de Aceitação
1. QUANDO os documentos existirem ENTÃO o sistema DEVE expô-los em rotas
   públicas (acessíveis sem login), aptas a serem informadas nas fichas das
   lojas.
