import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Skill } from "@/lib/skills-data";
import { getCategoryLabel } from "@/lib/skills-data";
import { cn } from "@/lib/utils";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { Download, Star, Store } from "lucide-react";

interface SkillCardProps {
  skill: Skill;
  onCardClick: (skillId: string) => void;
  onDuplicate: (skill: Skill) => void;
  onDelete: (skill: Skill) => void;
}

export function SkillCard({ skill, onCardClick, onDuplicate, onDelete }: SkillCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer rounded-xl border bg-card p-5 transition-[background-color,border-color] duration-200 ease-in-out flex flex-col text-left w-full",
        // Light mode (theme-aware)
        "border-border/70 hover:border-primary/25 hover:bg-accent/30",
        // Dark mode (as in sketch-frontend diff)
        "dark:border-[rgba(255,255,255,0.07)] dark:hover:border-[rgba(255,255,255,0.2)] dark:hover:bg-[rgba(107,125,250,0.03)]",
      )}
      onClick={() => onCardClick(skill.id)}
    >
      {/* Top row: category pill + source tags + overflow */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {getCategoryLabel(skill.category)}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={(e) => e.stopPropagation()}>
              <DotsThreeIcon size={16} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onDuplicate(skill)}>Duplicate</DropdownMenuItem>
            {/* TODO: Enable/Disable skill will be implemented later. */}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(skill)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Skill name */}
      <p className="mt-3 truncate text-sm font-medium">{skill.name}</p>

      {/* Description */}
      {skill.description && (
        <p className="mt-1 text-xs text-muted-foreground/70 line-clamp-3 leading-relaxed">{skill.description}</p>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Hub source + stats */}
      <div className="mt-3 min-h-[18px]">
        {skill.source ? (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Store size={12} strokeWidth={1.75} />
            <span>{skill.source.hub}</span>
            <span className="text-muted-foreground/50">&middot;</span>
            <Star size={12} strokeWidth={1.75} />
            <span>{skill.source.stars}</span>
            <span className="text-muted-foreground/50">&middot;</span>
            <Download size={12} strokeWidth={1.75} />
            <span>{skill.source.downloads}</span>
          </div>
        ) : null}
      </div>
    </button>
  );
}
