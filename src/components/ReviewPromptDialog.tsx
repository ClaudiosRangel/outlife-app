import { useRef, useState } from "react";
import { Star, Camera, Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { submitReview, uploadReviewPhoto } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetId: string;
  targetType: "destination" | "partner";
  targetLabel?: string;
};

export function ReviewPromptDialog({ open, onOpenChange, targetId, targetType, targetLabel }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const potentialXp = rating === 0 ? 50 : imageUrl ? 50 : comment.trim().length > 0 ? 30 : 10;

  const reset = () => {
    setRating(0);
    setComment("");
    setImageUrl(null);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadReviewPhoto(file);
      setImageUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar foto.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error("Selecione uma nota de 1 a 5.");
      return;
    }
    setSubmitting(true);
    try {
      const { xp } = await submitReview(targetId, targetType, rating, comment, imageUrl);
      toast.success(`Avaliação enviada! +${xp} XP`, {
        icon: <Sparkles size={16} className="text-[var(--sun)]" />,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar avaliação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--sun)]" />
            Como foi a aventura?
          </DialogTitle>
          <DialogDescription>
            {targetLabel ? `Avalie ${targetLabel} e ganhe até 50 XP!` : "Avalie e ganhe até 50 XP!"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-3 text-center">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Você vai ganhar
            </div>
            <div className="mt-1 font-display text-2xl font-semibold text-primary">
              +{potentialXp} XP
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Nota: +10 • com comentário: +30 • com foto: +50
            </div>
          </div>

          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-1 transition-base"
                aria-label={`${n} estrelas`}
              >
                <Star
                  size={32}
                  className={
                    n <= rating
                      ? "fill-[var(--sun)] text-[var(--sun)]"
                      : "text-muted-foreground/40"
                  }
                />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte como foi a experiência (opcional)"
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            {imageUrl ? (
              <div className="relative">
                <img
                  src={imageUrl}
                  alt="Foto da avaliação"
                  className="h-40 w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-foreground shadow"
                  aria-label="Remover foto"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {uploading ? "Enviando foto..." : "Adicionar foto (+20 XP)"}
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Agora não
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={submitting || rating < 1}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
