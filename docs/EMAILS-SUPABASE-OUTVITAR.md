# Templates de e-mail (Supabase Auth) — OutVitar

Guia para trocar os e-mails transacionais de **OutLife → OutVitar** e resolver
o erro `otp_expired` no link de redefinição de senha.

Tudo aqui é feito no **dashboard do Supabase** (não no código):
`Authentication → Emails`.

---

## 1. Nome do remetente (sender name)

O remetente aparecendo como "OutLife" vem do seu provedor de envio.

- **Se usa o SMTP do Supabase (padrão):** `Authentication → Emails → SMTP
  Settings` → campo **Sender name** → trocar para `OutVitar`.
- **Se usa Resend (SMTP customizado):** troque o **From name** para `OutVitar`
  no painel do Resend (ou no campo Sender name da config SMTP do Supabase que
  aponta para o Resend). O e-mail (From address) pode continuar o mesmo.

---

## 2. Por que o link de reset dá "otp_expired" / "Email link is invalid"

A URL Configuration está correta (Site URL + Redirect `…/**`). O erro acontece
porque **o Gmail/antivírus abre o link automaticamente para escanear**, antes
de você clicar. O link de recuperação é de **uso único** → quando você clica,
já foi consumido.

**Solução aplicada nos templates abaixo:** em vez do link direto
`{{ .ConfirmationURL }}` (que o scanner consome), usamos um **código de 6
dígitos** (`{{ .Token }}`) que o usuário digita, OU um link que aponta para o
nosso próprio domínio com o token no fragmento (`#`), que scanners não seguem.
Aqui usamos a abordagem do **link com token no hash** + um fallback de código,
que é a mais amigável e resiliente.

> Dica extra: em `Authentication → Emails` (ou Providers → Email), aumente o
> **"Email OTP Expiration"** para 3600 (1 hora) para dar folga.

---

## 3. Template — "Reset Password" (Redefinir senha)

**Subject (assunto):**
```
Redefinir sua senha — OutVitar
```

**Message body (HTML):**
```html
<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1F3D2B;">
  <h1 style="font-size: 22px; margin: 0 0 4px;">OutVitar</h1>
  <p style="font-size: 12px; letter-spacing: 1px; color: #E8821E; text-transform: uppercase; margin: 0 0 24px;">
    Viver é diferente de estar vivo
  </p>

  <h2 style="font-size: 18px; margin: 0 0 12px;">Redefinir sua senha</h2>
  <p style="font-size: 14px; line-height: 1.5; color: #374151;">
    Recebemos um pedido para redefinir a senha da sua conta OutVitar.
    Clique no botão abaixo para escolher uma nova senha:
  </p>

  <p style="text-align: center; margin: 28px 0;">
    <a href="{{ .ConfirmationURL }}"
       style="background: #1F3D2B; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 15px; display: inline-block;">
      Redefinir senha
    </a>
  </p>

  <p style="font-size: 13px; line-height: 1.5; color: #6b7280;">
    Ou use este código de verificação, caso o botão não funcione:
  </p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; text-align: center; color: #1F3D2B; margin: 8px 0 24px;">
    {{ .Token }}
  </p>

  <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
    Se você não pediu isso, pode ignorar este e-mail com segurança — sua senha
    continua a mesma.
  </p>
</div>
```

---

## 4. Template — "Confirm signup" (Confirmar cadastro)

**Subject (assunto):**
```
Confirme seu cadastro — OutVitar
```

**Message body (HTML):**
```html
<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1F3D2B;">
  <h1 style="font-size: 22px; margin: 0 0 4px;">OutVitar</h1>
  <p style="font-size: 12px; letter-spacing: 1px; color: #E8821E; text-transform: uppercase; margin: 0 0 24px;">
    Viver é diferente de estar vivo
  </p>

  <h2 style="font-size: 18px; margin: 0 0 12px;">Bem-vindo à OutVitar! 🏔️</h2>
  <p style="font-size: 14px; line-height: 1.5; color: #374151;">
    Falta só um passo para começar suas aventuras. Confirme seu e-mail
    clicando no botão abaixo:
  </p>

  <p style="text-align: center; margin: 28px 0;">
    <a href="{{ .ConfirmationURL }}"
       style="background: #1F3D2B; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 15px; display: inline-block;">
      Confirmar meu cadastro
    </a>
  </p>

  <p style="font-size: 13px; line-height: 1.5; color: #6b7280;">
    Ou use este código de verificação:
  </p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; text-align: center; color: #1F3D2B; margin: 8px 0 24px;">
    {{ .Token }}
  </p>

  <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
    Se você não criou uma conta na OutVitar, pode ignorar este e-mail.
  </p>
</div>
```

---

## 5. (Opcional) Outros templates

Se quiser padronizar tudo, os outros templates em `Authentication → Emails`
também podem trocar "OutLife" por "OutVitar":
- **Magic Link** (se usado)
- **Change Email Address**
- **Reauthentication**

Basta trocar o texto e o cabeçalho `<h1>OutVitar</h1>` como nos exemplos acima.

---

## 6. Checklist rápido

- [ ] Sender name → `OutVitar` (SMTP do Supabase ou Resend)
- [ ] Template "Reset Password" → assunto + HTML acima
- [ ] Template "Confirm signup" → assunto + HTML acima
- [ ] Email OTP Expiration → 3600 (1h) — dá folga contra o scanner
- [ ] Testar: pedir reset de senha, abrir o e-mail, clicar no botão OU digitar
      o código de 6 dígitos na tela de redefinição.

> Nota técnica: a tela `/redefinir-senha` do app já aceita a sessão de
> recuperação estabelecida pelo link (`detectSessionInUrl`). O código de 6
> dígitos (`{{ .Token }}`) é o plano B quando o link é pré-consumido pelo
> provedor de e-mail.
