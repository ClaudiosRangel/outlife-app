import { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-gradient-forest flex items-center justify-center p-0 sm:p-6">
      <div className="relative w-full sm:max-w-[420px] sm:rounded-[2.5rem] overflow-hidden bg-background min-h-screen sm:min-h-[860px] sm:shadow-float sm:border sm:border-white/10">
        {children}
      </div>
    </div>
  );
}
