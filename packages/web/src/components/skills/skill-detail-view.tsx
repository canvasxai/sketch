import { ChannelPlatformIcon } from "@/components/skills/channel-platform-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Skill, SkillChannelEntry, SkillIndividualEntry } from "@/lib/skills-data";
import { getCategoryLabel } from "@/lib/skills-data";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  CaretRightIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
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
  const { data: slackData } = useQuery({
    queryKey: ["channels", "slack", "list"],
    queryFn: () => api.channels.listSlackChannels(),
  });
  const { data: groupData } = useQuery({
    queryKey: ["channels", "whatsapp", "groups"],
    queryFn: () => api.channels.listWaGroups(),
  });
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.list(),
  });

  const activeChannels: SkillChannelEntry[] = useMemo(() => {
    const slack = (slackData?.channels ?? [])
      .filter((ch) => ch.allowed_skills === null || ch.allowed_skills.includes(skill.id))
      .map((ch) => ({ id: ch.id, name: ch.name, type: "slack" as const, enabled: true }));
    const wa = (groupData?.groups ?? [])
      .filter((g) => g.allowed_skills === null || g.allowed_skills.includes(skill.id))
      .map((g) => ({ id: g.id, name: g.name, type: "whatsapp" as const, enabled: true }));
    return [...slack, ...wa];
  }, [slackData, groupData, skill.id]);

  const activeIndividuals: SkillIndividualEntry[] = useMemo(() => {
    return (usersData?.users ?? [])
      .filter((u) => u.allowed_skills === null || u.allowed_skills.includes(skill.id))
      .map((u) => ({ id: u.id, name: u.name, enabled: true }));
  }, [usersData, skill.id]);

  const enabled = skill.status.org || activeChannels.length > 0 || activeIndividuals.length > 0;

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
                />
              ) : (
                <MemberStatusLabel enabled={enabled} />
              )}
            </div>
          )}
        </div>
      )}
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

  const displayChannels = activeChannels;
  const displayIndividuals = activeIndividuals;

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
                      const chType = (ch as SkillChannelEntry).type ?? "slack";
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
                          {/* TODO: Render expanded channel details once nested permission data is available. */}
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
