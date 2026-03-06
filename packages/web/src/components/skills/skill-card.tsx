import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Skill, SkillSourceTag } from "@/lib/skills-data";
import { getCategoryLabel } from "@/lib/skills-data";
import { cn } from "@/lib/utils";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { Download, Star, Store } from "lucide-react";

interface SkillCardProps {
  skill: Skill;
  sourceTags?: SkillSourceTag[];
  onCardClick: (skillId: string) => void;
  onDuplicate: (skill: Skill) => void;
  onDelete: (skill: Skill) => void;
}

function SourceTagPills({ tags }: { tags: SkillSourceTag[] }) {
  const visible = tags.slice(0, 1);
  const overflow = tags.length - 1;

  return (
    <>
      {visible.map((tag) => (
        <span
          key={tag.label}
          className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {tag.label}
        </span>
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0 cursor-default items-center rounded-full bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground/60">
              +{overflow}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" sideOffset={4}>
            <div className="flex flex-col gap-0.5">
              {tags.slice(1).map((t) => (
                <span key={t.label}>{t.label}</span>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}

export function SkillCard({ skill, sourceTags, onCardClick, onDuplicate, onDelete }: SkillCardProps) {
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
          {sourceTags && sourceTags.length > 0 && <SourceTagPills tags={sourceTags} />}
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
