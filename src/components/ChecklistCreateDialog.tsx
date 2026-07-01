import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createChecklist,
  fetchDestinations,
  type ChecklistItem,
} from "@/lib/api";

const SUGGESTION_KEYS = [
  "water",
  "snack",
  "firstAid",
  "sunscreen",
  "hat",
  "raincoat",
  "flashlight",
  "whistle",
  "backpack",
  "trailShoes",
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChecklistCreateDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [destinationId, setDestinationId] = useState<string>("none");
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(
    () => new Set(SUGGESTION_KEYS),
  );

  const { data: destinations = [] } = useQuery({
    queryKey: ["destinations-list"],
    queryFn: fetchDestinations,
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () => {
      const items: ChecklistItem[] = Array.from(selectedSuggestions).map((key) => ({
        id: crypto.randomUUID(),
        text: t(`checklist.suggestions.${key}`),
        is_checked: false,
      }));
      return createChecklist({
        name,
        destinationId: destinationId === "none" ? null : destinationId,
        items,
      });
    },
    onSuccess: (created) => {
      toast.success(t("checklist.saveSuccess"));
      qc.invalidateQueries({ queryKey: ["user-checklists"] });
      onOpenChange(false);
      setName("");
      setDestinationId("none");
      setSelectedSuggestions(new Set(SUGGESTION_KEYS));
      navigate({ to: "/checklist/$checklistId", params: { checklistId: created.id } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = name.trim().length >= 1 && !create.isPending;

  const toggleSuggestion = (key: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("checklist.createCta")}</DialogTitle>
          <DialogDescription>{t("checklist.suggestedItems")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="checklist-name">{t("checklist.nameLabel")}</Label>
            <Input
              id="checklist-name"
              placeholder={t("checklist.newName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t("checklist.linkDestination")}</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger>
                <SelectValue placeholder={t("checklist.selectDestination")} />
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

          <div className="space-y-2">
            <Label>{t("checklist.suggestedItems")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTION_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedSuggestions.has(key)}
                    onCheckedChange={() => toggleSuggestion(key)}
                  />
                  <span className="text-sm">{t(`checklist.suggestions.${key}`)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancelar")}
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit}>
            {create.isPending ? t("common.saving", "Salvando…") : t("checklist.createCta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
