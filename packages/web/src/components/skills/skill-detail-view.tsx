import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Skill } from "@/lib/skills-data";
import { getActiveChannels, getActiveIndividuals, getCategoryLabel, isSkillEnabled } from "@/lib/skills-data";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  CaretRightIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { Building2, Download, MessageCircle, Star, Store, User, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface SkillDetailViewProps {
  skill: Skill;
  isAdmin: boolean;
  activeTab: "details" | "permissions";
  onTabChange: (tab: "details" | "permissions") => void;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: (skill: Skill) => void;
  onDelete: (skill: Skill) => void;
  isExplorePreview?: boolean;
  onAddSkill?: () => void;
}

function ChannelPlatformIcon({ type }: { type: string }) {
  if (type === "whatsapp") {
    return (
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-muted-foreground shrink-0"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-muted-foreground shrink-0"
    >
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

export function SkillDetailView({
  skill,
  isAdmin,
  activeTab,
  onTabChange,
  onBack,
  onEdit,
  onDuplicate,
  onDelete,
  isExplorePreview = false,
  onAddSkill,
}: SkillDetailViewProps) {
  const [overflowPopup, setOverflowPopup] = useState<{
    type: "channels" | "individuals";
    items: { name: string }[];
  } | null>(null);

  const enabled = isSkillEnabled(skill.status);
  const activeChannels = getActiveChannels(skill.status);
  const activeIndividuals = getActiveIndividuals(skill.status);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <div ref={sentinelRef} className="h-0" />

      {/* Sticky header */}
      <div
        className={cn(
          "sticky top-0 z-20 -mx-6 bg-background px-6 pb-4 pt-8 transition-shadow duration-150",
          scrolled ? "shadow-[0_1px_4px_rgba(0,0,0,0.1)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)]" : "shadow-none",
        )}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon size={14} />
          Skills
        </button>

        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{skill.name}</h1>
          </div>
          {isExplorePreview ? (
            <Button className="gap-1.5" onClick={onAddSkill}>
              Add Skill
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="size-8" onClick={onEdit}>
                <PencilSimpleIcon size={16} className="text-muted-foreground" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7">
                    <DotsThreeIcon size={16} className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onDuplicate(skill)}>Duplicate</DropdownMenuItem>
                  {/* TODO: Enable/Disable skill will be implemented later. */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(skill)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Explore preview: Details only */}
      {isExplorePreview ? (
        <div className="mt-6">
          <DetailsContent skill={skill} />
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex gap-4 border-b border-border">
            {(["details", "permissions"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={cn(
                  "relative py-2 text-sm capitalize transition-colors",
                  activeTab === tab
                    ? "font-medium text-foreground"
                    : "font-normal text-muted-foreground/60 hover:text-muted-foreground",
                )}
              >
                {tab}
                {activeTab === tab && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
              </button>
            ))}
          </div>

          {activeTab === "details" && (
            <div className="mt-6">
              <DetailsContent skill={skill} />
            </div>
          )}

          {activeTab === "permissions" && (
            <div className="mt-6">
              {isAdmin ? (
                <AdminPermissionsView
                  skill={skill}
                  enabled={enabled}
                  activeChannels={activeChannels}
                  activeIndividuals={activeIndividuals}
                  onOverflowClick={setOverflowPopup}
                />
              ) : (
                <MemberStatusLabel enabled={enabled} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Overflow Popup */}
      <Dialog
        open={overflowPopup !== null}
        onOpenChange={(open) => {
          if (!open) setOverflowPopup(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{skill.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">Enabled for</p>
          </DialogHeader>
          {overflowPopup && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {overflowPopup.type === "channels" ? "Channels" : "Individuals"} ({overflowPopup.items.length})
              </p>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {overflowPopup.items.map((item) => (
                  <div key={item.name} className="text-sm py-1.5 px-1">
                    {overflowPopup.type === "channels" ? (
                      <MessageCircle size={14} strokeWidth={1.75} className="inline mr-1.5 text-muted-foreground" />
                    ) : (
                      <User size={14} strokeWidth={1.75} className="inline mr-1.5 text-muted-foreground" />
                    )}
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Details Content ──────────────────────────────────────

function DetailsContent({ skill }: { skill: Skill }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</h2>
        {skill.description ? (
          <p className="mt-2 text-sm leading-relaxed">{skill.description}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No description added.</p>
        )}
      </div>

      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Body</h2>
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4">
          <div className="markdown-body">
            <ReactMarkdown>{skill.body}</ReactMarkdown>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</h2>
        <span className="mt-2 inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {getCategoryLabel(skill.category)}
        </span>
      </div>

      {skill.source && (
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source</h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Store size={16} strokeWidth={1.75} />
            <span className="font-medium">{skill.source.hub}</span>
            <span className="text-muted-foreground/50">&middot;</span>
            <Star size={16} strokeWidth={1.75} />
            <span>{skill.source.stars}</span>
            <span className="text-muted-foreground/50">&middot;</span>
            <Download size={16} strokeWidth={1.75} />
            <span>{skill.source.downloads}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Permissions View ───────────────────────────────

function AdminPermissionsView({
  skill,
  enabled,
  activeChannels,
  activeIndividuals,
}: {
  skill: Skill;
  enabled: boolean;
  activeChannels: { id: string; name: string; enabled: boolean }[];
  activeIndividuals: { name: string }[];
  onOverflowClick: (popup: { type: "channels" | "individuals"; items: { name: string }[] }) => void;
}) {
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [individualsOpen, setIndividualsOpen] = useState(true);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [channelSearch, setChannelSearch] = useState("");
  const [individualSearch, setIndividualSearch] = useState("");
  const channelListRef = useRef<HTMLDivElement>(null);
  const individualListRef = useRef<HTMLDivElement>(null);

  const toggleExpandedChannel = (id: string) => {
    setExpandedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayChannels = skill.status.org ? skill.status.channels : activeChannels;
  const displayIndividuals = skill.status.org ? skill.status.individuals : activeIndividuals;

  const filteredChannels = useMemo(() => {
    const q = channelSearch.toLowerCase().trim();
    return q ? displayChannels.filter((ch) => ch.name.toLowerCase().includes(q)) : displayChannels;
  }, [displayChannels, channelSearch]);

  const filteredIndividuals = useMemo(() => {
    const q = individualSearch.toLowerCase().trim();
    return q ? displayIndividuals.filter((ind) => ind.name.toLowerCase().includes(q)) : displayIndividuals;
  }, [displayIndividuals, individualSearch]);

  if (!enabled) {
    return <p className="text-sm text-muted-foreground">Not enabled for anyone</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between py-2.5">
        <div className="flex items-center gap-2">
          <Building2 size={16} strokeWidth={1.75} className="text-muted-foreground" />
          <span className="text-sm font-medium">Organisation</span>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            skill.status.org ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground/60",
          )}
        >
          {skill.status.org ? "On" : "Off"}
        </span>
      </div>

      <div className={cn("relative ml-3 border-l border-border pl-5", skill.status.org && "opacity-40")}>
        {/* Channels */}
        <div className="relative">
          <div className="absolute -left-5 top-[15px] h-px w-5 bg-border" />
          <button
            type="button"
            onClick={() => setChannelsOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <CaretRightIcon size={12} className={cn("shrink-0 transition-transform", channelsOpen && "rotate-90")} />
            <MessageCircle size={16} strokeWidth={1.75} className="text-muted-foreground" />
            <span>Channels</span>
            {!channelsOpen && (
              <span className="text-[11px] text-muted-foreground/60">
                {skill.status.org ? "All included" : `${activeChannels.length} active`}
              </span>
            )}
          </button>
          {channelsOpen && (
            <div className="relative ml-[7px] border-l border-border pl-5">
              <div className="relative mb-2 mt-1">
                <MagnifyingGlassIcon
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                  size={14}
                />
                <Input
                  placeholder="Search channels..."
                  value={channelSearch}
                  onChange={(e) => {
                    setChannelSearch(e.target.value);
                    if (channelListRef.current) channelListRef.current.scrollTop = 0;
                  }}
                  className="h-9 rounded-[6px] bg-transparent pl-8 text-sm"
                />
              </div>
              <div ref={channelListRef} className="relative max-h-[320px] overflow-y-auto">
                {displayChannels.length > 0 ? (
                  filteredChannels.length > 0 ? (
                    filteredChannels.map((ch) => {
                      const isActive = skill.status.org || ch.enabled;
                      const chType = skill.status.channels.find((c) => c.id === ch.id)?.type ?? "slack";
                      return (
                        <div key={ch.id} className="relative">
                          <div className="absolute -left-5 top-[15px] h-px w-5 bg-border" />
                          <div className="flex items-center gap-1.5 py-2">
                            <button
                              type="button"
                              onClick={() => toggleExpandedChannel(ch.id)}
                              className="shrink-0 p-0.5"
                            >
                              <CaretRightIcon
                                size={11}
                                className={cn(
                                  "text-muted-foreground/60 transition-transform",
                                  expandedChannels.has(ch.id) && "rotate-90",
                                )}
                              />
                            </button>
                            <ChannelPlatformIcon type={chType} />
                            <span className="flex-1 truncate text-sm">{ch.name}</span>
                            {isActive && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                                Active
                              </span>
                            )}
                          </div>
                          {expandedChannels.has(ch.id) && null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-2 text-xs text-muted-foreground">
                      No channels match &lsquo;{channelSearch}&rsquo;
                    </p>
                  )
                ) : (
                  <div className="relative">
                    <div className="absolute -left-5 top-[11px] h-px w-5 bg-border" />
                    <p className="py-1.5 text-[13px] text-muted-foreground/60">No channels</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Individuals */}
        <div className="relative">
          <div className="absolute -left-5 top-[15px] h-px w-5 bg-border" />
          <button
            type="button"
            onClick={() => setIndividualsOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <CaretRightIcon size={12} className={cn("shrink-0 transition-transform", individualsOpen && "rotate-90")} />
            <Users size={16} strokeWidth={1.75} className="text-muted-foreground" />
            <span>Individuals</span>
            {!individualsOpen && (
              <span className="text-[11px] text-muted-foreground/60">
                {skill.status.org ? "All included" : `${activeIndividuals.length} active`}
              </span>
            )}
          </button>
          {individualsOpen && (
            <div className="relative ml-[7px] border-l border-border pl-5">
              <div className="relative mb-2 mt-1">
                <MagnifyingGlassIcon
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                  size={14}
                />
                <Input
                  placeholder="Search individuals..."
                  value={individualSearch}
                  onChange={(e) => {
                    setIndividualSearch(e.target.value);
                    if (individualListRef.current) individualListRef.current.scrollTop = 0;
                  }}
                  className="h-9 rounded-[6px] bg-transparent pl-8 text-sm"
                />
              </div>
              <div ref={individualListRef} className="relative max-h-[320px] overflow-y-auto">
                {displayIndividuals.length > 0 ? (
                  filteredIndividuals.length > 0 ? (
                    filteredIndividuals.map((ind) => (
                      <div key={ind.name} className="relative">
                        <div className="absolute -left-5 top-[14px] h-px w-5 bg-border" />
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-1.5">
                            <User size={14} strokeWidth={1.75} className="text-muted-foreground" />
                            <span className="text-sm">{ind.name}</span>
                          </div>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                            Active
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-xs text-muted-foreground">
                      No individuals match &lsquo;{individualSearch}&rsquo;
                    </p>
                  )
                ) : (
                  <div className="relative">
                    <div className="absolute -left-5 top-[11px] h-px w-5 bg-border" />
                    <p className="py-1.5 text-[13px] text-muted-foreground/60">No individuals</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberStatusLabel({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-success">
        <span className="text-sm">⚡</span> Enabled for you
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="text-sm">⏸</span> Not available
    </span>
  );
}
