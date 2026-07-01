-- ============ EXTENSIONS ============
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('adventurer', 'partner');
CREATE TYPE public.profile_status AS ENUM ('active', 'inactive', 'pending_verification');
CREATE TYPE public.destination_status AS ENUM ('pending', 'approved', 'rejected');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role public.app_role NOT NULL DEFAULT 'adventurer',
  location TEXT,
  rating NUMERIC(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  progress_to_next_level INTEGER DEFAULT 0,
  description TEXT,
  category TEXT,
  phone TEXT,
  instagram TEXT,
  website TEXT,
  cadastur_number TEXT,
  cnpj TEXT,
  status public.profile_status DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============ DESTINATIONS ============
CREATE TABLE public.destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  geog GEOGRAPHY(Point, 4326),
  region TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',
  main_image_url TEXT,
  difficulty TEXT,
  distance TEXT,
  duration TEXT,
  elevation TEXT,
  type TEXT,
  trail_type TEXT,
  rating NUMERIC(3,2) DEFAULT 0,
  status public.destination_status NOT NULL DEFAULT 'approved',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX destinations_geog_idx ON public.destinations USING GIST (geog);
CREATE INDEX destinations_name_lower_idx ON public.destinations (LOWER(name));

CREATE OR REPLACE FUNCTION public.sync_destination_geog()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_destination_geog_trigger
  BEFORE INSERT OR UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.sync_destination_geog();

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved destinations are public"
  ON public.destinations FOR SELECT
  USING (status = 'approved' OR auth.uid() = created_by);
CREATE POLICY "Authenticated users can suggest destinations"
  ON public.destinations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by AND status = 'pending');
CREATE POLICY "Creators can update their pending destinations"
  ON public.destinations FOR UPDATE USING (auth.uid() = created_by);

-- ============ SERVICES ============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'BRL',
  images_urls TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  availability JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX services_partner_idx ON public.services (partner_id);
CREATE INDEX services_destination_idx ON public.services (destination_id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are viewable by everyone"
  ON public.services FOR SELECT USING (true);
CREATE POLICY "Partners can create their own services"
  ON public.services FOR INSERT WITH CHECK (auth.uid() = partner_id);
CREATE POLICY "Partners can update their own services"
  ON public.services FOR UPDATE USING (auth.uid() = partner_id);
CREATE POLICY "Partners can delete their own services"
  ON public.services FOR DELETE USING (auth.uid() = partner_id);

-- ============ COMMUNITY POSTS ============
CREATE TABLE public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT,
  image_url TEXT,
  place TEXT,
  likes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are viewable by everyone"
  ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Users can create their own posts"
  ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own posts"
  ON public.community_posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own posts"
  ON public.community_posts FOR DELETE USING (auth.uid() = author_id);

-- ============ REVIEWS ============
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL,
  comment TEXT
);

CREATE INDEX reviews_destination_idx ON public.reviews (destination_id);
CREATE INDEX reviews_author_idx ON public.reviews (author_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews"
  ON public.reviews FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own reviews"
  ON public.reviews FOR DELETE USING (auth.uid() = author_id);

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, role, category)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 6)),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'adventurer'),
    NEW.raw_user_meta_data ->> 'category'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ DEDUP RPC ============
CREATE OR REPLACE FUNCTION public.find_similar_destinations(
  _name TEXT,
  _lat NUMERIC DEFAULT NULL,
  _lng NUMERIC DEFAULT NULL,
  _radius_meters NUMERIC DEFAULT 100
)
RETURNS SETOF public.destinations
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT *
  FROM public.destinations
  WHERE
    (LENGTH(_name) > 0 AND LOWER(name) LIKE '%' || LOWER(_name) || '%')
    OR (
      _lat IS NOT NULL AND _lng IS NOT NULL AND geog IS NOT NULL
      AND ST_DWithin(
        geog,
        ST_SetSRID(ST_MakePoint(_lng::float8, _lat::float8), 4326)::geography,
        _radius_meters
      )
    )
  ORDER BY status, created_at DESC
  LIMIT 10;
$$;

-- ============ SEED: DESTINATIONS ============
INSERT INTO public.destinations (id, name, description, latitude, longitude, region, state, country, main_image_url, difficulty, distance, duration, elevation, type, trail_type, rating, status)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'Cachoeira do Tabuleiro', 'Maior cachoeira de Minas Gerais com queda livre impressionante.', -18.5497, -43.3833, 'MG', 'Minas Gerais', 'Brasil', '/src/assets/cachoeira_do_tabuleiro.jpg', 'Moderada', '12 km', '4h', '850m', 'Trekking', 'Ida e volta', 4.8, 'approved'),
  ('11111111-1111-1111-1111-111111111102', 'Trilha Pedra do Sino', 'Travessia clássica na Serra dos Órgãos com vista privilegiada.', -22.4500, -43.0167, 'RJ', 'Rio de Janeiro', 'Brasil', '/src/assets/trilha_pedra_do_sino.jpg', 'Difícil', '18 km', '8h', '2263m', 'Trekking', 'Ida e volta', 4.7, 'approved'),
  ('11111111-1111-1111-1111-111111111103', 'Camping Vale Estelar', 'Camping em meio à mata atlântica de Santa Catarina.', -27.2500, -49.6333, 'SC', 'Santa Catarina', 'Brasil', '/src/assets/camping_vale_estelar.jpg', 'Fácil', '8 km', '2h', '420m', 'Caminhada', 'Circular', 4.9, 'approved'),
  ('11111111-1111-1111-1111-111111111104', 'Pico das Agulhas Negras', 'Quinto ponto mais alto do Brasil, no Parque Nacional de Itatiaia.', -22.3833, -44.6500, 'RJ', 'Rio de Janeiro', 'Brasil', '/src/assets/pico_agulhas_negras.jpg', 'Avançada', '22 km', '10h', '2791m', 'Alpinismo', 'Ida e volta', 4.9, 'approved');

-- ============ SEED: SAMPLE PARTNER PROFILES ============
INSERT INTO public.profiles (id, username, full_name, avatar_url, role, location, rating, reviews_count, is_verified, description, category, phone, instagram, status)
VALUES
  ('22222222-2222-2222-2222-222222222201', 'rafatrilhas', 'Rafa Trilhas', '/src/assets/partner-guide.jpg', 'partner', 'Petrópolis, RJ', 4.9, 213, true, 'Guia certificado em alta montanha. Travessias, escaladas guiadas e experiências fotográficas no eixo Mantiqueira-Órgãos.', 'Guias', '+5521999991111', '@rafatrilhas', 'active'),
  ('22222222-2222-2222-2222-222222222202', 'ventonorte', 'Pousada Vento Norte', '/src/assets/partner-lodge.jpg', 'partner', 'Bonito, MS', 4.8, 187, true, 'Pousada sustentável às margens do Rio Formoso. Café da manhã com produtos locais e trilhas particulares.', 'Pousadas', '+5567999992222', '@ventonorte', 'active'),
  ('22222222-2222-2222-2222-222222222203', 'caiolente', 'Caio Lente', '/src/assets/partner-photographer.jpg', 'partner', 'Chapada Diamantina, BA', 4.7, 96, false, 'Fotógrafo especializado em paisagens e astrofotografia na Chapada.', 'Fotógrafos', '+5571999993333', '@caiolente', 'active'),
  ('22222222-2222-2222-2222-222222222204', 'trilhasdosol', 'Trilhas do Sol', '/src/assets/trilha_pedra_do_sino.jpg', 'partner', 'Campos do Jordão, SP', 4.6, 142, true, 'Roteiros de trekking leve a moderado nas montanhas paulistas.', 'Guias', '+5512999994444', '@trilhasdosol', 'active'),
  ('22222222-2222-2222-2222-222222222205', 'ecolodgeserraverde', 'Eco Lodge Serra Verde', '/src/assets/partner-lodge.jpg', 'partner', 'Monte Verde, MG', 4.9, 310, true, 'Lodge de montanha com spa, sauna finlandesa e gastronomia orgânica.', 'Pousadas', '+5535999995555', '@ecolodgeserraverde', 'active'),
  ('22222222-2222-2222-2222-222222222206', 'pedaladventure', 'Pedal Adventure', '/src/assets/partner-guide.jpg', 'partner', 'São Paulo, SP', 4.5, 78, true, 'Aluguel de mountain bikes e e-bikes com capacete e kit de reparo.', 'Aluguel', '+5511999996666', '@pedaladventure', 'active'),
  ('22222222-2222-2222-2222-222222222207', 'saboresdaroca', 'Sabores da Roça', '/src/assets/partner-photographer.jpg', 'partner', 'Ouro Preto, MG', 4.8, 245, true, 'Restaurante familiar com culinária típica mineira. Ingredientes da horta orgânica própria.', 'Restaurantes', '+5531999997777', '@saboresdaroca', 'active'),
  ('22222222-2222-2222-2222-222222222208', 'aventuratotal', 'Aventura Total', '/src/assets/pico_agulhas_negras.jpg', 'partner', 'Florianópolis, SC', 4.4, 112, false, 'Pacotes de aventura personalizados no sul do Brasil. Trekking, surf, canyoning e stand-up paddle.', 'Agências', '+5548999998888', '@aventuratotal', 'active');
