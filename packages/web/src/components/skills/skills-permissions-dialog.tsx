/**
 * Reusable dialog for managing allowed skills on a channel, group, or user.
 * Shows a multi-select list of org skills with an "All skills" toggle.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SkillRecord } from "@/lib/api";
import { api } from "@/lib/api";
import { type SkillCategory, categoryMeta } from "@/lib/skills-data";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SkillsPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  currentAllowedSkills: string[] | null;
  onSave: (allowedSkills: string[] | null) => Promise<void>;
}

export function SkillsPermissionsDialog({
  open,
  onOpenChange,
  title,
  description,
  currentAllowedSkills,
  onSave,
}: SkillsPermissionsDialogProps) {
  const [allSkills, setAllSkills] = useState(currentAllowedSkills === null);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAllowedSkills ?? []));
  const [isSaving, setIsSaving] = useState(false);

  const { data: skillsData } = useQuery({
    queryKey: ["skills", "raw"],
    queryFn: () => api.skills.list(),
    enabled: open,
  });

  const orgSkills = skillsData?.skills ?? [];

  useEffect(() => {
    if (open) {
      setAllSkills(currentAllowedSkills === null);
      setSelected(new Set(currentAllowedSkills ?? []));
    }
  }, [open, currentAllowedSkills]);

  // Filter out stale skill IDs that no longer exist in the org
  useEffect(() => {
    if (orgSkills.length > 0) {
      const validIds = new Set(orgSkills.map((s) => s.id));
      setSelected((prev) => {
        const filtered = new Set([...prev].filter((id) => validIds.has(id)));
        return filtered.size === prev.size ? prev : filtered;
      });
    }
  }, [orgSkills]);

  const handleToggleSkill = (skillId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const value = allSkills ? null : Array.from(selected);
      await onSave(value);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save skills");
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    allSkills !== (currentAllowedSkills === null) ||
    (!allSkills && !setsEqual(selected, new Set(currentAllowedSkills ?? [])));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-accent/30">
            <input
              type="checkbox"
              checked={allSkills}
              onChange={(e) => setAllSkills(e.target.checked)}
              className="size-4 rounded"
            />
            <span className="text-sm font-medium">All skills</span>
            <span className="ml-auto text-xs text-muted-foreground">No restriction</span>
          </label>

          {!allSkills && (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {orgSkills.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No skills configured</p>
              ) : (
                orgSkills.map((skill) => (
                  <SkillCheckRow
                    key={skill.id}
                    skill={skill}
                    checked={selected.has(skill.id)}
                    onToggle={() => handleToggleSkill(skill.id)}
                  />
                ))
              )}
            </div>
          )}

          {!allSkills && (
            <p className="text-xs text-muted-foreground">
              {selected.size === 0
                ? "No skills selected — all skills will be blocked."
                : `${selected.size} skill${selected.size === 1 ? "" : "s"} selected`}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!isDirty || isSaving}>
            {isSaving ? (
              <>
                <SpinnerGapIcon size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkillCheckRow({ skill, checked, onToggle }: { skill: SkillRecord; checked: boolean; onToggle: () => void }) {
  const meta = categoryMeta[skill.category as SkillCategory] ?? { iconBg: "bg-gray-500/15", iconEmoji: "⚡" };
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-accent/30">
      <input type="checkbox" checked={checked} onChange={onToggle} className="size-3.5 rounded" />
      <span className={`flex size-6 items-center justify-center rounded text-xs ${meta.iconBg}`}>{meta.iconEmoji}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{skill.name}</span>
    </label>
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
