export function StatusBar({ light = false }: { light?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-6 pt-3 pb-1 text-[12px] font-semibold tracking-tight ${light ? "text-white" : "text-foreground"}`}>
      <span>9:41</span>
      <div className="flex items-center gap-1 opacity-90">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span className="ml-2 text-[11px]">100%</span>
      </div>
    </div>
  );
}
