/**
 * Seed_Script (Requirement 1)
 *
 * Popula o Production_Supabase_Project (ou qualquer projeto Supabase
 * equivalente) com o Seed_Dataset: os 4 destinos brasileiros reais e os 8
 * parceiros demo já presentes hoje em
 * `supabase/migrations/20260521193007_88f5fd4b-2759-4e79-b47d-ead844244cad.sql`.
 *
 * Idempotente por construção: cada registro usa um UUID fixo (chave natural)
 * e é gravado via `upsert(..., { onConflict: "id" })`, então executar o
 * script múltiplas vezes nunca duplica dados nem falha.
 *
 * Uso:
 *   npm run seed
 *
 * Requer as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * (lidas do `.env` na raiz do projeto).
 */
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

// Carrega o `.env` da raiz do projeto (Node >= 20.6 tem `loadEnvFile` nativo,
// evitando a dependência extra `dotenv` só para um script standalone).
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // Sem .env local (ex: variáveis já exportadas no ambiente de CI/deploy) — ok.
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const missing = [
    ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
    ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
  ];
  console.error(
    `[seed] Variável(is) de ambiente faltando: ${missing.join(", ")}. Defina-as no .env na raiz do projeto.`,
  );
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Categorias válidas de parceiro definidas pela OutLife_Application
// (ver src/routes/compliance.tsx e src/routes/cadastro.tsx).
export const VALID_PARTNER_CATEGORIES = [
  "Guias",
  "Pousadas",
  "Fotógrafos",
  "Aluguel",
  "Restaurantes",
  "Agências",
] as const;

type Destination = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  region: string;
  state: string;
  country: string;
  main_image_url: string;
  difficulty: string;
  distance: string;
  duration: string;
  elevation: string;
  type: string;
  trail_type: string;
  rating: number;
  status: "approved";
};

// Destinos com coordenadas reais dentro do território brasileiro
// (mesmos registros já presentes na migration inicial do Seed_Dataset).
export const DESTINATIONS: Destination[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    name: "Cachoeira do Tabuleiro",
    description: "Maior cachoeira de Minas Gerais com queda livre impressionante.",
    latitude: -18.5497,
    longitude: -43.3833,
    region: "MG",
    state: "Minas Gerais",
    country: "Brasil",
    main_image_url: "/src/assets/cachoeira_do_tabuleiro.jpg",
    difficulty: "Moderada",
    distance: "12 km",
    duration: "4h",
    elevation: "850m",
    type: "Trekking",
    trail_type: "Ida e volta",
    rating: 4.8,
    status: "approved",
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    name: "Trilha Pedra do Sino",
    description: "Travessia clássica na Serra dos Órgãos com vista privilegiada.",
    latitude: -22.45,
    longitude: -43.0167,
    region: "RJ",
    state: "Rio de Janeiro",
    country: "Brasil",
    main_image_url: "/src/assets/trilha_pedra_do_sino.jpg",
    difficulty: "Difícil",
    distance: "18 km",
    duration: "8h",
    elevation: "2263m",
    type: "Trekking",
    trail_type: "Ida e volta",
    rating: 4.7,
    status: "approved",
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    name: "Camping Vale Estelar",
    description: "Camping em meio à mata atlântica de Santa Catarina.",
    latitude: -27.25,
    longitude: -49.6333,
    region: "SC",
    state: "Santa Catarina",
    country: "Brasil",
    main_image_url: "/src/assets/camping_vale_estelar.jpg",
    difficulty: "Fácil",
    distance: "8 km",
    duration: "2h",
    elevation: "420m",
    type: "Caminhada",
    trail_type: "Circular",
    rating: 4.9,
    status: "approved",
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    name: "Pico das Agulhas Negras",
    description: "Quinto ponto mais alto do Brasil, no Parque Nacional de Itatiaia.",
    latitude: -22.3833,
    longitude: -44.65,
    region: "RJ",
    state: "Rio de Janeiro",
    country: "Brasil",
    main_image_url: "/src/assets/pico_agulhas_negras.jpg",
    difficulty: "Avançada",
    distance: "22 km",
    duration: "10h",
    elevation: "2791m",
    type: "Alpinismo",
    trail_type: "Ida e volta",
    rating: 4.9,
    status: "approved",
  },
];

type PartnerProfile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  role: "partner";
  location: string;
  rating: number;
  reviews_count: number;
  is_verified: boolean;
  description: string;
  category: (typeof VALID_PARTNER_CATEGORIES)[number];
  status: "active";
  // Colunas movidas para `profile_contacts` (ver migration
  // 20260522184926_2e12c581-*.sql), gravadas separadamente por seedPartners.
  phone: string;
  instagram: string;
};

// Parceiros demo (mesmos registros já presentes na migration inicial do
// Seed_Dataset), todos com categoria dentro de VALID_PARTNER_CATEGORIES.
export const PARTNERS: PartnerProfile[] = [
  {
    id: "22222222-2222-2222-2222-222222222201",
    username: "rafatrilhas",
    full_name: "Rafa Trilhas",
    avatar_url: "/src/assets/partner-guide.jpg",
    role: "partner",
    location: "Petrópolis, RJ",
    rating: 4.9,
    reviews_count: 213,
    is_verified: true,
    description:
      "Guia certificado em alta montanha. Travessias, escaladas guiadas e experiências fotográficas no eixo Mantiqueira–Órgãos.",
    category: "Guias",
    phone: "+5521999991111",
    instagram: "@rafatrilhas",
    status: "active",
  },
  {
    id: "22222222-2222-2222-2222-222222222202",
    username: "ventonorte",
    full_name: "Pousada Vento Norte",
    avatar_url: "/src/assets/partner-lodge.jpg",
    role: "partner",
    location: "Bonito, MS",
    rating: 4.8,
    reviews_count: 187,
    is_verified: true,
    description:
      "Pousada sustentável às margens do Rio Formoso. Café da manhã com produtos locais, trilhas particulares e observação de pássaros.",
    category: "Pousadas",
    phone: "+5567999992222",
    instagram: "@ventonorte",
    status: "active",
  },
  {
    id: "22222222-2222-2222-2222-222222222203",
    username: "caiolente",
    full_name: "Caio Lente",
    avatar_url: "/src/assets/partner-photographer.jpg",
    role: "partner",
    location: "Chapada Diamantina, BA",
    rating: 4.7,
    reviews_count: 96,
    is_verified: false,
    description:
      "Fotógrafo especializado em paisagens e astrofotografia na Chapada. Ensaios de aventura e cobertura de expedições.",
    category: "Fotógrafos",
    phone: "+5571999993333",
    instagram: "@caiolente",
    status: "active",
  },
  {
    id: "22222222-2222-2222-2222-222222222204",
    username: "trilhasdosol",
    full_name: "Trilhas do Sol",
    avatar_url: "/src/assets/trilha_pedra_do_sino.jpg",
    role: "partner",
    location: "Campos do Jordão, SP",
    rating: 4.6,
    reviews_count: 142,
    is_verified: true,
    description:
      "Roteiros de trekking leve a moderado nas montanhas paulistas. Ideal para iniciantes e famílias com crianças.",
    category: "Guias",
    phone: "+5512999994444",
    instagram: "@trilhasdosol",
    status: "active",
  },
  {
    id: "22222222-2222-2222-2222-222222222205",
    username: "ecolodgeserraverde",
    full_name: "Eco Lodge Serra Verde",
    avatar_url: "/src/assets/partner-lodge.jpg",
    role: "partner",
    location: "Monte Verde, MG",
    rating: 4.9,
    reviews_count: 310,
    is_verified: true,
    description:
      "Lodge de montanha com spa, sauna finlandesa e gastronomia orgânica. Quartos com lareira e vista para o vale.",
    category: "Pousadas",
    phone: "+5535999995555",
    instagram: "@ecolodgeserraverde",
    status: "active",
  },
  {
    id: "22222222-2222-2222-2222-222222222206",
    username: "pedaladventure",
    full_name: "Pedal Adventure",
    avatar_url: "/src/assets/partner-guide.jpg",
    role: "partner",
    location: "São Paulo, SP",
    rating: 4.5,
    reviews_count: 78,
    is_verified: true,
    description:
      "Aluguel de mountain bikes e e-bikes com capacete e kit de reparo. Rotas sugeridas via app próprio.",
    category: "Aluguel",
    phone: "+5511999996666",
    instagram: "@pedaladventure",
    status: "active",
  },
  {
    id: "22222222-2222-2222-2222-222222222207",
    username: "saboresdaroca",
    full_name: "Sabores da Roça",
    avatar_url: "/src/assets/partner-photographer.jpg",
    role: "partner",
    location: "Ouro Preto, MG",
    rating: 4.8,
    reviews_count: 245,
    is_verified: true,
    description:
      "Restaurante familiar com culinária típica mineira. Ingredientes da horta orgânica própria e vista para a serra.",
    category: "Restaurantes",
    phone: "+5531999997777",
    instagram: "@saboresdaroca",
    status: "active",
  },
  {
    id: "22222222-2222-2222-2222-222222222208",
    username: "aventuratotal",
    full_name: "Aventura Total",
    avatar_url: "/src/assets/pico_agulhas_negras.jpg",
    role: "partner",
    location: "Florianópolis, SC",
    rating: 4.4,
    reviews_count: 112,
    is_verified: false,
    description:
      "Pacotes de aventura personalizados no sul do Brasil. Trekking, surf, canyoning e stand-up paddle.",
    category: "Agências",
    phone: "+5548999998888",
    instagram: "@aventuratotal",
    status: "active",
  },
];

// Território brasileiro (bounding box aproximado, usado só como sanity check
// deste script — não é validação de negócio da aplicação).
export const BRAZIL_BOUNDS = {
  minLat: -33.75,
  maxLat: 5.27,
  minLng: -73.99,
  maxLng: -28.84,
};

export function assertSeedDataIsValid() {
  for (const d of DESTINATIONS) {
    const withinBrazil =
      d.latitude >= BRAZIL_BOUNDS.minLat &&
      d.latitude <= BRAZIL_BOUNDS.maxLat &&
      d.longitude >= BRAZIL_BOUNDS.minLng &&
      d.longitude <= BRAZIL_BOUNDS.maxLng;
    if (!withinBrazil) {
      throw new Error(
        `[seed] Destino "${d.name}" (${d.id}) tem coordenadas fora do território brasileiro: (${d.latitude}, ${d.longitude})`,
      );
    }
  }

  for (const p of PARTNERS) {
    if (!VALID_PARTNER_CATEGORIES.includes(p.category)) {
      throw new Error(
        `[seed] Parceiro "${p.full_name}" (${p.id}) tem categoria inválida: "${p.category}"`,
      );
    }
  }
}

async function seedDestinations() {
  const { error, count } = await supabaseAdmin
    .from("destinations")
    .upsert(DESTINATIONS, { onConflict: "id", count: "exact" });

  if (error) {
    throw new Error(`[seed] Falha ao fazer upsert de destinations: ${error.message}`);
  }

  console.log(`[seed] destinations: ${count ?? DESTINATIONS.length} registro(s) upsertado(s).`);
}

async function seedPartners() {
  // `phone`/`instagram` residem hoje em `profile_contacts` (1:1 com
  // `profiles`, ver migration 20260522184926_2e12c581-*.sql), não mais em
  // `profiles`. Upsert em duas etapas, cada uma pela chave natural (id).
  const profileRows = PARTNERS.map(({ phone, instagram, ...profile }) => profile);
  const contactRows = PARTNERS.map(({ id, phone, instagram }) => ({ id, phone, instagram }));

  const { error: profilesError, count: profilesCount } = await supabaseAdmin
    .from("profiles")
    .upsert(profileRows, { onConflict: "id", count: "exact" });

  if (profilesError) {
    throw new Error(`[seed] Falha ao fazer upsert de profiles (parceiros): ${profilesError.message}`);
  }

  const { error: contactsError, count: contactsCount } = await supabaseAdmin
    .from("profile_contacts")
    .upsert(contactRows, { onConflict: "id", count: "exact" });

  if (contactsError) {
    throw new Error(`[seed] Falha ao fazer upsert de profile_contacts (parceiros): ${contactsError.message}`);
  }

  console.log(
    `[seed] profiles (parceiros): ${profilesCount ?? profileRows.length} registro(s) upsertado(s).`,
  );
  console.log(
    `[seed] profile_contacts (parceiros): ${contactsCount ?? contactRows.length} registro(s) upsertado(s).`,
  );
}

async function main() {
  assertSeedDataIsValid();

  console.log(`[seed] Conectando a ${SUPABASE_URL} ...`);
  await seedDestinations();
  await seedPartners();
  console.log("[seed] Seed_Dataset aplicado com sucesso (idempotente).");
}

// Só executa `main()` quando o arquivo é rodado diretamente (`npm run seed` /
// `tsx scripts/seed.ts`), nunca quando é importado por outro módulo (ex:
// `tests/seed.test.ts` importando DESTINATIONS/PARTNERS/assertSeedDataIsValid
// para validação de exemplo, sem disparar upsert contra o banco).
const isMainModule = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
