import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Camera, MapPin, Loader2, Mountain, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { resizeImageForUpload } from "@/lib/image-resize";

export const Route = createFileRoute("/sugerir-destino")({
  component: SuggestDestinationPage,
  head: () => ({
    meta: [
      { title: "Sugerir destino — Outlife" },
      { name: "description", content: "Indique um novo destino para a comunidade OutLife." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/sugerir-destino" }],
  }),
});

const DIFFICULTY_OPTIONS = ["Fácil", "Moderada", "Difícil", "Muito difícil"] as const;
const TYPE_OPTIONS = ["Trekking", "Cachoeira", "Montanha", "Camping", "Caiaque", "Escalada", "Outro"] as const;

function SuggestDestinationPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [state, setState] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [elevation, setElevation] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!name.trim()) throw new Error("Nome do destino é obrigatório");
      if (!description.trim()) throw new Error("Descrição é obrigatória");

      // Upload da imagem se houver
      let imageUrl: string | null = null;
      if (imageFile) {
        const optimized = await resizeImageForUpload(imageFile);
        const ext = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : "jpg";
        const path = `destinations/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("community-post-images")
          .upload(path, optimized, { upsert: false, contentType: imageFile.type });
        if (upErr) throw new Error("Erro no upload da imagem: " + upErr.message);
        const { data: pub } = supabase.storage.from("community-post-images").getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }

      // Criar destino pendente
      const { error } = await supabase.from("destinations").insert({
        name: name.trim(),
        description: description.trim(),
        region: region.trim() || null,
        state: state.trim() || null,
        difficulty: difficulty || null,
        type: type || null,
        distance: distance.trim() || null,
        duration: duration.trim() || null,
        elevation: elevation.trim() || null,
        main_image_url: imageUrl,
        status: "pending",
        created_by: user.id,
      } as never);
      if (error) throw error;

      // Notificar admins por e-mail (best-effort, não bloqueia a sugestão)
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || "https://outlife-app.vercel.app";
        await fetch(`${apiBase}/api/notify-admins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinationName: name.trim(),
            suggestedBy: user.email ?? "Usuário",
            description: description.trim() || undefined,
            secret: "outlife-push-2026",
          }),
        });
      } catch {
        // E-mail é best-effort — não impede a sugestão
      }
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Destino enviado para aprovação!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <p className="text-muted-foreground">Faça login para sugerir um destino</p>
        <Link to="/login" className="mt-4 text-sm text-primary font-medium">Fazer login</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <CheckCircle2 size={48} className="text-green-500 mb-4" />
        <h2 className="font-display text-xl font-semibold">Destino enviado!</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Seu destino foi enviado para análise. Os responsáveis serão notificados e, após aprovação, ele será publicado para toda a comunidade.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => { setSubmitted(false); setName(""); setDescription(""); setImageFile(null); setImagePreview(null); }}>
            Sugerir outro
          </Button>
          <Button onClick={() => navigate({ to: "/explorar" })}>
            Explorar destinos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 animate-float-up">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/explorar" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Sugerir destino</span>
          <span className="w-9" />
        </div>
      </div>

      <div className="px-5 mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Conhece um destino incrível? Mande as informações e fotos — após aprovação pelos responsáveis, ele será publicado na plataforma.
        </p>

        <div>
          <Label className="mb-1 text-sm font-medium">Nome do destino *</Label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cachoeira do Segredo" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
        </div>

        <div>
          <Label className="mb-1 text-sm font-medium">Descrição *</Label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o destino: como chegar, o que esperar, dicas..." rows={4} className="w-full rounded-xl border border-border bg-card p-3 text-sm resize-none outline-none focus:ring-1 ring-ring" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 text-sm font-medium">Região</Label>
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Serra do Espinhaço" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Estado</Label>
            <input value={state} onChange={(e) => setState(e.target.value)} placeholder="MG" maxLength={2} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 text-sm font-medium">Dificuldade</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {DIFFICULTY_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="mb-1 text-sm font-medium">Distância</Label>
            <input value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="12 km" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Duração</Label>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="4h" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
          <div>
            <Label className="mb-1 text-sm font-medium">Elevação</Label>
            <input value={elevation} onChange={(e) => setElevation(e.target.value)} placeholder="850m" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 ring-ring" />
          </div>
        </div>

        <div>
          <Label className="mb-1 text-sm font-medium">Foto do destino</Label>
          <button
            onClick={() => fileRef.current?.click()}
            className="relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 p-6 text-muted-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="h-40 w-full rounded-xl object-cover" />
            ) : (
              <>
                <Camera size={28} />
                <span className="text-sm">Adicionar foto</span>
                <span className="text-xs text-muted-foreground/70">JPG, PNG ou WEBP</span>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
          </button>
        </div>

        <Button className="w-full h-12 rounded-xl mt-2" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
          {submitMut.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Mountain size={16} className="mr-2" />}
          Enviar para aprovação
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          Após envio, os responsáveis da OutLife analisarão e aprovarão seu destino.
        </p>
      </div>
    </div>
  );
}
