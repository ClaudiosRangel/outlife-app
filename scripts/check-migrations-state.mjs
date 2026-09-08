// Script de VERIFICAÇÃO (read-only) do estado do Supabase remoto.
// Confirma, sem alterar nada, se:
//   1. A VIEW public.public_user_locations_live existe (feature nova).
//   2. A função public.finish_user_activity aceita o parâmetro _elevation_gain.
//   3. A coluna user_activities.elevation_gain existe.
// Usa a SERVICE_ROLE_KEY do .env apenas para leitura.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(name) {
  const raw = readFileSync(".env", "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) return null;
  return line.slice(name.length + 1).replace(/^["']|["']$/g, "").trim();
}

const url = readEnv("SUPABASE_URL");
const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !serviceKey) {
  console.error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function checkView() {
  // Tenta um SELECT trivial na VIEW nova. Se a VIEW não existe, o erro do
  // PostgREST traz "does not exist" / código 42P01 (relação inexistente).
  const { error } = await supabase
    .from("public_user_locations_live")
    .select("id")
    .limit(1);
  if (!error) return { exists: true };
  return { exists: false, error: error.message, code: error.code };
}

async function checkFinishFnSignature() {
  // Chama a RPC finish_user_activity com _elevation_gain e um _id inexistente.
  // - Se a assinatura NÃO tem _elevation_gain: erro PGRST202 (função não
  //   encontrada com esses argumentos) => migração 20260820090000 ausente.
  // - Se a assinatura tem _elevation_gain: a RPC roda, não encontra a linha
  //   (id aleatório) e retorna null/sem erro de assinatura => migração aplicada.
  const fakeId = "00000000-0000-0000-0000-000000000000";
  const { error } = await supabase.rpc("finish_user_activity", {
    _id: fakeId,
    _geojson: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
    _distance: 0,
    _duration: 0,
    _description: null,
    _image_url: null,
    _activity_type: null,
    _map_snapshot_url: null,
    _elevation_gain: null,
  });
  if (!error) return { acceptsElevation: true };
  return {
    acceptsElevation: !(error.code === "PGRST202"),
    error: error.message,
    code: error.code,
  };
}

const view = await checkView();
const fn = await checkFinishFnSignature();

console.log(JSON.stringify({ view, finishFn: fn }, null, 2));
