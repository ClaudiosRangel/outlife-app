import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, MoreVertical, Plus, Trash2, MapPin, Pencil } from "lucide-react";
import {
  deleteChecklist,
  fetchChecklistById,
  fetchDestinations,
  updateChecklist,
  type ChecklistItem,
  type UserChecklist,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useChecklistMutations } from "@/hooks/use-checklist-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/checklist/$checklistId")({
  component: ChecklistDetail,
  head: () => ({
    meta: [
      { title: "Checklist — Outlife" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ChecklistDetail() {
  const { checklistId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: checklist, isLoading } = useQuery({
    queryKey: ["checklist", checklistId],
    queryFn: () => fetchChecklistById(checklistId),
    enabled: !!user,
  });

  const { data: destinations = [] } = useQuery({
    queryKey: ["destinations-list"],
    queryFn: fetchDestinations,
    enabled: !!user,
  });

  const { queueItems, flush } = useChecklistMutations(checklistId);

  const [newItem, setNewItem] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDest, setEditDest] = useState<string>("none");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    if (checklist && editOpen === false) {
      setEditName(checklist.name);
      setEditDest(checklist.destination_id ?? "none");
    }
  }, [checklist, editOpen]);

  const total = checklist?.items.length ?? 0;
  const done = checklist?.items.filter((i) => i.is_checked).length ?? 0;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const destinationName = useMemo(() => {
    if (!checklist?.destination_id) return null;
    return destinations.find((d) => d.id === checklist.destination_id)?.name ?? null;
  }, [checklist, destinations]);

  const updateItems = (next: ChecklistItem[]) => queueItems(next);

  const toggleItem = (id: string) => {
    if (!checklist) return;
    updateItems(
      checklist.items.map((i) => (i.id === id ? { ...i, is_checked: !i.is_checked } : i)),
    );
  };

  const removeItem = (id: string) => {
    if (!checklist) return;
    updateItems(checklist.items.filter((i) => i.id !== id));
  };

  const addItem = () => {
    if (!checklist) return;
    const text = newItem.trim();
    if (text.length < 1) {
      toast.error(t("checklist.tooShort"));
      return;
    }
    if (checklist.items.length >= 100) {
      toast.error(t("checklist.tooMany", "Limite de 100 itens atingido."));
      return;
    }
    updateItems([
      ...checklist.items,
      { id: crypto.randomUUID(), text, is_checked: false },
    ]);
    setNewItem("");
    toast.success(t("checklist.itemAdded"));
  };

  const saveItemEdit = (id: string) => {
    if (!checklist) return;
    const text = editingText.trim();
    if (text.length < 1) {
      setEditingItemId(null);
      return;
    }
    updateItems(checklist.items.map((i) => (i.id === id ? { ...i, text } : i)));
    setEditingItemId(null);
  };

  const saveMeta = useMutation({
    mutationFn: async () => {
      return updateChecklist(checklistId, {
        name: editName,
        destinationId: editDest === "none" ? null : editDest,
      });
    },
    onSuccess: (saved) => {
      qc.setQueryData(["checklist", checklistId], saved);
      qc.invalidateQueries({ queryKey: ["user-checklists"] });
      setEditOpen(false);
      toast.success(t("checklist.saveSuccess"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeChecklist = useMutation({
    mutationFn: async () => {
      await flush();
      return deleteChecklist(checklistId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-checklists"] });
      qc.removeQueries({ queryKey: ["checklist", checklistId] });
      toast.success(t("checklist.deleteSuccess"));
      navigate({ to: "/perfil" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("checklist.notFound", "Checklist não encontrado.")}
      </div>
    );
  }

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 backdrop-blur px-4 py-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/perfil" })}
          aria-label="Voltar"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg font-semibold truncate">{checklist.name}</h1>
          {destinationName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} /> {destinationName}
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <MoreVertical size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil size={14} className="mr-2" /> {t("checklist.editTitle")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 size={14} className="mr-2" /> {t("common.delete", "Excluir")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <section className="px-5 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {t("checklist.progress", { done, total })}
          </span>
          <Badge variant="secondary">{progress}%</Badge>
        </div>
        <Progress value={progress} />
      </section>

      <section className="px-5 mt-6 space-y-2">
        {checklist.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("checklist.noItems", "Nenhum item ainda. Adicione abaixo.")}
          </p>
        )}
        {checklist.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-2.5"
          >
            <Checkbox
              checked={item.is_checked}
              onCheckedChange={() => toggleItem(item.id)}
              aria-label={item.text}
            />
            {editingItemId === item.id ? (
              <Input
                autoFocus
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={() => saveItemEdit(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveItemEdit(item.id);
                  if (e.key === "Escape") setEditingItemId(null);
                }}
                maxLength={80}
                className="h-8 flex-1"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingItemId(item.id);
                  setEditingText(item.text);
                }}
                className={`flex-1 text-left text-sm ${
                  item.is_checked ? "line-through text-muted-foreground" : ""
                }`}
              >
                {item.text}
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(item.id)}
              aria-label="Remover item"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </section>

      <section className="px-5 mt-6 flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
          placeholder={t("checklist.itemPlaceholder")}
          maxLength={80}
        />
        <Button onClick={addItem} aria-label={t("checklist.addItem")}>
          <Plus size={16} className="mr-1" /> {t("checklist.addItem")}
        </Button>
      </section>

      {/* Editar metadados */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("checklist.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("checklist.nameLabel")}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("checklist.linkDestination")}</Label>
              <Select value={editDest} onValueChange={setEditDest}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("checklist.noDestination")}</SelectItem>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("common.cancel", "Cancelar")}
            </Button>
            <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}>
              {saveMeta.isPending ? t("common.saving", "Salvando…") : t("common.save", "Salvar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("checklist.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("checklist.confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeChecklist.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete", "Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
