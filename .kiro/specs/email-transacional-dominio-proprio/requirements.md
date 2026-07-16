# Requirements Document

## Introduction

O OutLife está em produção na Vercel com backend 100% Supabase (projeto `soghvqpnyekmkdqprpka`). Atualmente, os e-mails transacionais de autenticação (confirmação de cadastro, magic link, redefinição de senha) são enviados pelo provedor de e-mail padrão do Supabase Auth, com remetente `noreply@mail.app.supabase.io`. Esse remetente compartilhado não possui SPF/DKIM/DMARC alinhados a um domínio próprio, o que faz com que os e-mails caiam na caixa de spam dos usuários, além de impor um limite de 2 e-mails/hora (plano free), o que impede testar o fluxo de cadastro com múltiplos usuários.

Esta feature substitui o provedor de e-mail padrão do Supabase por uma configuração de SMTP customizado usando o domínio próprio `avidanaoesotrilhar.com.br` (já registrado e hospedado no HostGator) como remetente, autenticado via SPF/DKIM/DMARC, com envio realizado pelo provedor Resend. O objetivo é garantir que os e-mails transacionais cheguem na caixa de entrada dos usuários (não em spam) e removam o limite de envio que trava testes.

Esta é uma tarefa de configuração de infraestrutura/dashboard (DNS, Resend, Supabase Dashboard), sem necessidade de alteração de código da aplicação.

## Glossary

- **Supabase_Auth**: O serviço de autenticação do projeto Supabase (`soghvqpnyekmkdqprpka`) responsável por enviar e-mails transacionais de confirmação de cadastro, magic link e redefinição de senha.
- **Sender_Domain**: O domínio próprio `avidanaoesotrilhar.com.br`, registrado e hospedado no HostGator, usado como domínio de remetente dos e-mails transacionais.
- **Resend_Provider**: O serviço de envio de e-mail transacional Resend (resend.com), configurado como provedor SMTP customizado do Supabase_Auth.
- **DNS_Zone**: A zona de DNS do Sender_Domain, gerenciada no painel de cliente do HostGator (cliente.hostgator.com.br).
- **SMTP_Configuration**: O conjunto de parâmetros de SMTP customizado (host, porta, usuário, senha, remetente) configurado em Supabase Dashboard → Authentication → Emails → SMTP Settings.
- **Fallback_Provider**: O provedor de e-mail padrão do Supabase (remetente `noreply@mail.app.supabase.io`), usado como contingência caso o SMTP_Configuration apresente falha.
- **Confirmation_Email**: O e-mail transacional enviado pelo Supabase_Auth para confirmação de cadastro de um novo usuário.
- **Magic_Link_Email**: O e-mail transacional enviado pelo Supabase_Auth contendo um link de acesso sem senha (magic link).
- **Password_Reset_Email**: O e-mail transacional enviado pelo Supabase_Auth para redefinição de senha.
- **Transactional_Email**: Termo coletivo que engloba Confirmation_Email, Magic_Link_Email e Password_Reset_Email, além de outros e-mails de autenticação enviados pelo Supabase_Auth (ex.: alteração de endereço de e-mail).
- **Test_Signup_Record**: O registro de teste (cadastro de usuário de teste) executado para validar a entrega do Confirmation_Email.
- **Authentication_Headers**: Os cabeçalhos de e-mail (SPF, DKIM, DMARC) presentes no Confirmation_Email recebido, usados para verificar o alinhamento de autenticação do remetente.

## Requirements

### Requirement 1: Envio de e-mails transacionais via domínio próprio autenticado

**User Story:** Como usuário do OutLife, eu quero receber os e-mails de confirmação de cadastro, magic link e redefinição de senha na minha caixa de entrada (não em spam), para que eu consiga concluir meu cadastro e acessar o aplicativo sem fricção.

#### Acceptance Criteria

1. WHEN Supabase_Auth envia um Confirmation_Email, um Magic_Link_Email ou um Password_Reset_Email (em conjunto, Transactional_Email), THE Supabase_Auth SHALL usar um endereço de remetente do Sender_Domain.
2. WHEN Supabase_Auth envia um Transactional_Email (Confirmation_Email, Magic_Link_Email ou Password_Reset_Email), THE SMTP_Configuration SHALL rotear o envio através do Resend_Provider.
3. THE Resend_Provider SHALL estar configurado com registros SPF e DKIM válidos para o Sender_Domain antes do envio de qualquer Transactional_Email em produção.
4. IF os registros SPF e/ou DKIM do Sender_Domain se tornarem inválidos após a configuração inicial (ex.: alteração indevida na DNS_Zone), THEN THE Supabase_Auth SHALL continuar permitindo normalmente os fluxos de cadastro, magic link e redefinição de senha, sem bloquear essas ações, mesmo havendo risco do Transactional_Email ser classificado como spam pelo provedor de destino até a correção dos registros na DNS_Zone.
5. WHERE DMARC estiver habilitado para o Sender_Domain, THE DNS_Zone SHALL conter um registro DMARC cuja política (p=none, p=quarantine ou p=reject) esteja alinhada com os mecanismos de autenticação SPF e DKIM exigidos pelo Resend_Provider, de modo que o Transactional_Email seja aprovado na validação DMARC do provedor de destino.
6. IF a validação do SMTP_Configuration falhar (ex.: host, porta, credenciais ou handshake TLS inválidos com o Resend_Provider), THEN THE Supabase_Auth SHALL rotear o envio do Transactional_Email através do Fallback_Provider até que o SMTP_Configuration seja corrigido e revalidado com sucesso.
7. IF tanto o Resend_Provider quanto o Fallback_Provider estiverem indisponíveis no momento do envio de um Transactional_Email, THEN THE Supabase_Auth SHALL preservar os dados já submetidos pelo usuário (cadastro, solicitação de magic link ou de redefinição de senha) e SHALL permitir que o usuário solicite o reenvio do Transactional_Email após o restabelecimento de ao menos um dos provedores.

### Requirement 2: Configuração de registros DNS no domínio próprio

**User Story:** Como responsável técnico do OutLife, eu quero que os registros DNS de autenticação de e-mail estejam corretamente configurados e verificados, para que o Resend_Provider tenha permissão para enviar e-mails em nome do Sender_Domain com reputação de entrega adequada.

#### Acceptance Criteria

1. THE DNS_Zone SHALL conter o registro SPF fornecido pelo Resend_Provider para o Sender_Domain.
2. THE DNS_Zone SHALL conter o(s) registro(s) DKIM fornecido(s) pelo Resend_Provider para o Sender_Domain.
3. WHEN os registros SPF e DKIM são cadastrados na DNS_Zone e a propagação de DNS é concluída, THE Resend_Provider SHALL exibir o status de verificação do Sender_Domain como concluído (verified).
4. WHILE a propagação de DNS estiver em curso após o cadastro dos registros SPF e DKIM na DNS_Zone, THE Resend_Provider PODE exibir o status de verificação do Sender_Domain como "pendente" por até 72 horas, sem que esse estado transitório seja considerado uma falha.
5. IF o Resend_Provider exibir o status de verificação do Sender_Domain como pendente por mais de 72 horas, como falho, ou se o próprio Resend_Provider estiver indisponível para consulta do status, THEN THE SMTP_Configuration SHALL permanecer desativado até que o status de verificado seja confirmado.
6. WHEN o status de verificação do Sender_Domain no Resend_Provider mudar para concluído (verified), THE SMTP_Configuration SHALL permanecer desativado até que o responsável técnico o habilite manualmente no Supabase Dashboard — a ativação do SMTP_Configuration NÃO SHALL ocorrer automaticamente apenas pela conclusão da verificação do domínio.

### Requirement 3: Configuração de SMTP customizado no Supabase Dashboard

**User Story:** Como responsável técnico do OutLife, eu quero configurar o SMTP customizado no Supabase Dashboard usando as credenciais do Resend, para que o Supabase_Auth passe a enviar e-mails transacionais pelo domínio próprio sem exigir alteração de código da aplicação.

#### Acceptance Criteria

1. THE SMTP_Configuration SHALL especificar o host `smtp.resend.com` e a porta 587.
2. THE SMTP_Configuration SHALL especificar o usuário `resend` e a senha correspondente à API key gerada no Resend_Provider.
3. THE SMTP_Configuration SHALL especificar um endereço de remetente cujo domínio corresponda ao Sender_Domain e que esteja com status de domínio verificado no Resend_Provider no momento em que o SMTP_Configuration for salvo.
4. WHEN o SMTP_Configuration é salvo no Supabase Dashboard, THE Supabase_Auth SHALL passar a usar o SMTP_Configuration para todos os envios subsequentes de e-mails transacionais de autenticação, incluindo no mínimo Confirmation_Email, e-mail de recuperação de senha, e-mail de magic link e e-mail de alteração de endereço de e-mail.
5. IF o Supabase_Auth falhar ao enviar qualquer e-mail transacional de autenticação através do SMTP_Configuration, THEN THE Supabase_Auth SHALL registrar a falha de envio no Supabase Dashboard, incluindo identificação do destinatário e do tipo de e-mail envolvido, para permitir diagnóstico posterior.
6. IF o registro de falha de envio no Supabase Dashboard não estiver disponível ou também falhar, THEN o responsável técnico SHALL verificar a entrega dos e-mails utilizando o painel de logs de envio/eventos do Resend_Provider como fonte alternativa de diagnóstico, evitando depender de um único ponto de registro.
7. IF os valores informados no SMTP_Configuration forem inválidos no momento de salvar (por exemplo, host ou porta em formato incorreto, endereço de remetente que não pertence ao Sender_Domain, ou credenciais rejeitadas pelo Resend_Provider), THEN THE Supabase Dashboard SHALL rejeitar o salvamento, exibir uma indicação de erro identificando o campo inválido, e preservar a configuração de SMTP anteriormente válida sem alteração.

### Requirement 4: Validação da entrega e autenticação dos e-mails

**User Story:** Como responsável técnico do OutLife, eu quero validar, através de um cadastro de teste, que os e-mails transacionais chegam na caixa de entrada e passam a autenticação SPF/DKIM/DMARC, para que eu tenha confirmação objetiva de que o problema de spam foi resolvido antes de considerar a tarefa concluída.

#### Acceptance Criteria

1. WHEN um Test_Signup_Record é criado após a aplicação do SMTP_Configuration, utilizando um endereço de e-mail de destinatário de teste hospedado em um provedor de e-mail externo e independente da infraestrutura do Sender_Domain (por exemplo, Gmail, Outlook ou Yahoo), THE Confirmation_Email correspondente SHALL chegar na caixa de entrada principal desse destinatário de teste, não na pasta de spam ou lixo eletrônico, em até 30 minutos a partir da criação do Test_Signup_Record. Esse requisito de entrega na caixa de entrada só SHALL se aplicar a partir do momento em que o SMTP_Configuration estiver efetivamente aplicado; Test_Signup_Record criados antes da aplicação do SMTP_Configuration (ainda usando o Fallback_Provider) não SHALL ser considerados para esta validação.
2. WHEN o Confirmation_Email de um Test_Signup_Record é inspecionado, THE Authentication_Headers SHALL indicar resultado "pass" para SPF.
3. WHEN o Confirmation_Email de um Test_Signup_Record é inspecionado, THE Authentication_Headers SHALL indicar resultado "pass" para DKIM.
4. WHERE DMARC estiver habilitado para o Sender_Domain, THE Authentication_Headers do Confirmation_Email SHALL indicar resultado "pass" para DMARC.
5. IF qualquer um dos resultados de Authentication_Headers (SPF, DKIM ou DMARC, quando habilitado) não for "pass" para um Test_Signup_Record, THEN o responsável técnico SHALL corrigir a configuração de DNS_Zone ou SMTP_Configuration e, após a correção, SHALL criar um novo Test_Signup_Record e repetir a validação dos critérios 1 a 4 até que todos os resultados de Authentication_Headers aplicáveis indiquem "pass" antes de considerar a tarefa concluída.
6. IF o Confirmation_Email de um Test_Signup_Record não chegar na caixa de entrada principal nem na pasta de spam ou lixo eletrônico do destinatário de teste dentro de 30 minutos a partir da criação do Test_Signup_Record, THEN o responsável técnico SHALL tratar essa ausência como falha de entrega, investigar o SMTP_Configuration e os registros de envio do Resend_Provider, e SHALL repetir o teste com um novo Test_Signup_Record antes de considerar a tarefa concluída.

### Requirement 5: Documentação do risco de pausa do plano Supabase Free

**User Story:** Como responsável técnico do OutLife, eu quero que o risco de pausa automática do projeto Supabase por inatividade (plano free) esteja documentado, para que a equipe tenha visibilidade do risco operacional mesmo sem tratá-lo como parte central desta configuração de e-mail.

#### Acceptance Criteria

1. THE documentação desta feature (registrada no documento de design deste spec ou, na ausência de um documento de design, na seção de introdução do documento de requisitos deste spec) SHALL registrar que o projeto Supabase (`soghvqpnyekmkdqprpka`) está no plano free e sujeito a pausa automática por inatividade.
2. THE documentação desta feature (registrada no documento de design deste spec ou, na ausência de um documento de design, na seção de introdução do documento de requisitos deste spec) SHALL referenciar o spec `outlife-production-plan` como o local onde a migração para o plano Supabase Pro é tratada como tarefa central.
3. THE documentação desta feature (registrada no documento de design deste spec ou, na ausência de um documento de design, na seção de introdução do documento de requisitos deste spec) SHALL declarar explicitamente que a migração de plano do Supabase está fora do escopo de execução (tasks) deste spec.
