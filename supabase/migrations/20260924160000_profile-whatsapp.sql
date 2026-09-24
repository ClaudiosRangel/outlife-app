-- Campo WhatsApp nos dados de contato do usuário (owner-only). Idempotente.
alter table public.profile_contacts
  add column if not exists whatsapp text;
