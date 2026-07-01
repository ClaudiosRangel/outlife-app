import { Star } from "lucide-react";

export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(value) ? "fill-[var(--sun)] text-[var(--sun)]" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}
