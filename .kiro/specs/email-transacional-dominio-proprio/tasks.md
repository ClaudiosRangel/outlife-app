# Implementation Plan: Email Transacional com Domínio Próprio

## Overview

Esta é uma tarefa de configuração de infraestrutura/dashboard, não de desenvolvimento de código. Nenhum arquivo do repositório OutLife é criado ou alterado. As tasks abaixo são passos práticos de execução manual em três painéis externos: Resend (envio + geração de registros DNS), HostGator (zona de DNS do domínio `avidanaoesotrilhar.com.br`) e Supabase Dashboard (projeto `soghvqpnyekmkdqprpka`, SMTP customizado). Não há testes automatizados de código nem property-based tests aplicáveis (o design.md já indica explicitamente que Property-Based Testing não se aplica a esta feature). A validação final é feita através de um checklist manual de entrega e autenticação de e-mail (Requirement 4).

## Tasks

- [x] 1. Criar conta e adicionar domínio no Resend
  - [x] 1.1 Criar conta no Resend (resend.com)
    - Conta Resend criada/em uso para o OutLife
    - _Requirements: 1.2_
  - [x] 1.2 Adicionar o domínio `avidanaoesotrilhar.com.br` no Resend
    - Domínio adicionado no painel Resend → Domains; registros SPF e DKIM gerados e copiados
    - _Requirements: 2.1, 2.2_

- [x] 2. Obter e cadastrar registros DNS na zona do domínio (HostGator)
  - [x] 2.1 Verificar se já existe registro SPF pré-existente na DNS_Zone
    - Verificado na zona de DNS de `avidanaoesotrilhar.com.br`
    - _Requirements: 2.1_
  - [x] 2.2 Cadastrar (ou combinar) o registro SPF fornecido pelo Resend na DNS_Zone
    - Registro TXT SPF cadastrado no HostGator com o valor fornecido pelo Resend
    - _Requirements: 2.1_
  - [x] 2.3 Cadastrar o(s) registro(s) DKIM fornecido(s) pelo Resend na DNS_Zone
    - Registro(s) DKIM cadastrados no HostGator com os valores fornecidos pelo Resend
    - _Requirements: 2.2_
  - [x] 2.4 Cadastrar registro DMARC na DNS_Zone (opcional, porém recomendado)
    - Registro DMARC cadastrado; confirmado `p=NONE` no teste final de entrega (task 8.3)
    - _Requirements: 1.5_

- [x] 3. Verificar o domínio no Resend
  - [x] 3.1 Aguardar a propagação de DNS e verificar o status do domínio no Resend
    - Status do domínio `avidanaoesotrilhar.com.br` confirmado como `Verified` no Resend
    - _Requirements: 2.3, 2.4_
  - [x] 3.2 Corrigir registros DNS caso a verificação não conclua
    - Não foi necessário; verificação concluída sem falhas
    - _Requirements: 2.5_

- [x] 4. Gerar API key no Resend
  - [x] 4.1 Gerar a API key que será usada como senha SMTP
    - API key gerada no Resend (`outlife-supabase-smtp-v2`, regenerada durante a execução do spec `migracao-supabase-proprio-lovable` pois a chave original não estava mais recuperável)
    - _Requirements: 3.2_

- [x] 5. Configurar SMTP customizado no Supabase Dashboard
  - [x] 5.1 Preencher os parâmetros de SMTP customizado
    - **Nota de execução**: a configuração final foi aplicada no **New_Supabase_Project** (`dxmbftbhmjjqtpjymakj`, projeto `outlife-prod`), não no projeto original `soghvqpnyekmkdqprpka` referenciado no texto desta task. Isso ocorreu porque o spec `migracao-supabase-proprio-lovable` identificou que `soghvqpnyekmkdqprpka` foi provisionado pela Lovable Cloud e continha uma Edge Function que interceptava o envio de e-mail, ignorando o SMTP_Configuration — daí a decisão de migrar para um projeto novo antes de validar este Requirement 4. Parâmetros preenchidos: Host `smtp.resend.com`, Port `587`, Username `resend`, Password = API key da task 4.1, Sender email `naoresponda@avidanaoesotrilhar.com.br`, Sender name `OutLife`. Domínio confirmado `verified` no Resend antes de salvar
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 5.2 Salvar a configuração de SMTP customizado
    - Salvo com sucesso no New_Supabase_Project; a primeira tentativa tinha campos preenchidos incorretamente (porta 465, username incorreto, sender vazio) e foi corrigida antes do salvamento definitivo
    - _Requirements: 3.7_

- [x] 6. Habilitar manualmente o SMTP customizado
  - [x] 6.1 Ativar o toggle "Enable Custom SMTP" no Supabase Dashboard
    - Toggle "Enable custom SMTP" ativado manualmente no New_Supabase_Project, como ação distinta do salvamento dos campos
    - _Requirements: 2.6_

- [x] 7. Checkpoint - revisão da configuração antes da validação
  - Configuração revisada e corrigida antes do salvamento definitivo (ver task 5.2). Sem dúvidas pendentes.

- [x] 8. Validar entrega e autenticação do Confirmation_Email
  - [x] 8.1 Criar um Test_Signup_Record com destinatário externo
    - Test_Signup_Record criado com `caioestevesrangel14@gmail.com` em 15/07/2026 às 15:43:19, contra o New_Supabase_Project
    - _Requirements: 4.1_
  - [x] 8.2 Verificar a chegada do Confirmation_Email na caixa de entrada principal
    - E-mail chegou em ~5 segundos, remetente `OutLife <naoresponda@avidanaoesotrilhar.com.br>`, sem nenhuma ocorrência de `lovable-app.email`. Entregue na pasta de **spam** do Gmail, não na caixa principal — não satisfaz literalmente o critério de localização deste requisito
    - _Requirements: 4.1, 4.6_
  - [x] 8.3 Inspecionar os cabeçalhos de autenticação (Authentication-Results)
    - Confirmado via "Mostrar original" do Gmail: `spf=pass`, `dkim=pass` (header.i=@avidanaoesotrilhar.com.br), `dmarc=pass` (p=NONE). Todos os mecanismos aplicáveis passaram
    - _Requirements: 4.2, 4.3, 4.4_
  - [x] 8.4 Corrigir e repetir o teste em caso de falha
    - **Decisão do usuário (15/07/2026)**: aceito como concluído com ressalva documentada. A causa raiz original (interceptação de e-mail pela Lovable Cloud) está comprovadamente resolvida — SPF/DKIM/DMARC 100% `pass`, remetente exclusivamente do Sender_Domain. A entrega em spam é atribuída à baixa reputação inicial do domínio recém-configurado no Resend (comportamento esperado, não uma falha de SMTP_Configuration ou de DNS_Zone) — risco de reputação a ser monitorado ao longo do tempo, não uma repetição de teste adicional nesta sessão
    - _Requirements: 4.5, 4.6_

- [x] 9. Validar entrega dos demais tipos de Transactional_Email
  - [x] 9.1 Repetir a validação de entrega e autenticação para o Password_Reset_Email
    - Solicitado via `supabase.auth.resetPasswordForEmail` em 15/07/2026 16:12:48 para `caioestevesrangel14@gmail.com`. E-mail chegou na **caixa de entrada principal** (não em spam) — melhora em relação ao Confirmation_Email (task 8.2), consistente com aumento de reputação do domínio no Resend ao longo do tempo/volume de envios
    - _Requirements: 3.4, 4.5_
  - [x] 9.2 Repetir a validação de entrega e autenticação para o Magic_Link_Email (se aplicável ao app)
    - Não aplicável: verificado no código-fonte da OutLife_Application (`src/`) que não há nenhum uso de `signInWithOtp` ou fluxo de magic link implementado no app; apenas cadastro (signUp) e login com senha (signInWithPassword) estão em uso
    - _Requirements: 3.4, 4.5_

- [x] 10. Checkpoint final - confirmar conclusão da tarefa
  - Todos os Requirements 1-4 concluídos (execução final no New_Supabase_Project, pós-migração). Confirmation_Email e Password_Reset_Email validados com SPF/DKIM/DMARC pass; Magic_Link_Email não aplicável ao app. Requirement 5 (documentação do risco de plano free) já satisfeito pelo design.md. Sem dúvidas pendentes.

## Notes

- O Requirement 5 (documentação do risco de pausa do plano Supabase free) já está satisfeito pelo documento `design.md`, seção "Riscos e Observações (fora do escopo de execução)", que referencia o spec `outlife-production-plan` como local de tratamento da migração de plano. Não há task de execução associada a este requisito neste spec — apenas a confirmação de que essa documentação existe e permanece consistente.
- Não há tasks marcadas com `*` (opcionais) porque não existem testes automatizados de código nesta feature; todas as tasks de validação (8.x, 9.x) são parte central do critério de conclusão (Requirement 4) e por isso não são opcionais.
- As tasks 2.2, 2.3 e 2.4 podem ser executadas na mesma sessão de edição da zona de DNS, mas dependem logicamente da task 2.1 (checagem de SPF pré-existente) e da task 1.2 (valores gerados pelo Resend).
- As tasks 3.x só devem prosseguir após a propagação de DNS; não há como acelerar esse tempo de espera.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["6.1"] },
    { "id": 10, "tasks": ["8.1"] },
    { "id": 11, "tasks": ["8.2"] },
    { "id": 12, "tasks": ["8.3"] },
    { "id": 13, "tasks": ["8.4"] },
    { "id": 14, "tasks": ["9.1", "9.2"] }
  ]
}
```
