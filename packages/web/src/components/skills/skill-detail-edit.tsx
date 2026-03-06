import { ChannelPlatformIcon } from "@/components/skills/channel-platform-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type {
  Skill,
  SkillCategory,
  SkillChannelEntry,
  SkillIndividualEntry,
  SkillStatusConfig,
} from "@/lib/skills-data";
import { getCategoryLabel, skillCategories } from "@/lib/skills-data";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SpinnerGapIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Download, MessageCircle, Star, Store, User, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface SkillDraft {
  name: string;
  description: string;
  body: string;
  category: SkillCategory;
  status: SkillStatusConfig;
}

interface SkillDetailEditProps {
  skill: Skill | null; // null = create mode
  activeTab: "details" | "permissions";
  onTabChange: (tab: "details" | "permissions") => void;
  onBack: () => void;
  onSave: (draft: SkillDraft) => Promise<void>;
  onCancel: () => void;
}

export function SkillDetailEdit({ skill, activeTab, onTabChange, onBack, onSave, onCancel }: SkillDetailEditProps) {
  const isNew = !skill;

  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [body, setBody] = useState(skill?.body ?? "");
  const [category, setCategory] = useState<SkillCategory>(skill?.category ?? "productivity");

  const [orgEnabled, setOrgEnabled] = useState(skill?.status.org ?? false);

  const skillId = skill?.id ?? null;

  const { data: slackData } = useQuery({
    queryKey: ["channels", "slack", "list"],
    queryFn: () => api.channels.listSlackChannels(),
    enabled: !!skillId,
  });
  const { data: groupData } = useQuery({
    queryKey: ["channels", "whatsapp", "groups"],
    queryFn: () => api.channels.listWaGroups(),
    enabled: !!skillId,
  });
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.list(),
    enabled: !!skillId,
  });

  const [channels, setChannels] = useState<SkillChannelEntry[]>([]);
  const [individuals, setIndividuals] = useState<SkillIndividualEntry[]>([]);

  const permissionsInitialized = useRef(false);
  useEffect(() => {
    if (permissionsInitialized.current || !skillId) return;
    if (!slackData || !groupData || !usersData) return;
    const slack = slackData.channels
      .filter((ch) => ch.allowed_skills === null || ch.allowed_skills.includes(skillId))
      .map((ch) => ({ id: ch.id, name: ch.name, type: "slack" as const, enabled: true }));
    const wa = groupData.groups
      .filter((g) => g.allowed_skills === null || g.allowed_skills.includes(skillId))
      .map((g) => ({ id: g.id, name: g.name, type: "whatsapp" as const, enabled: true }));
    setChannels([...slack, ...wa]);
    setIndividuals(
      usersData.users
        .filter((u) => u.allowed_skills === null || u.allowed_skills.includes(skillId))
        .map((u) => ({ id: u.id, name: u.name, enabled: true })),
    );
    permissionsInitialized.current = true;
  }, [skillId, slackData, groupData, usersData]);

  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [showIndividualPicker, setShowIndividualPicker] = useState(false);

  const [channelSearch, setChannelSearch] = useState("");
  const [individualSearch, setIndividualSearch] = useState("");
  const channelListRef = useRef<HTMLDivElement>(null);
  const individualListRef = useRef<HTMLDivElement>(null);

  const [channelsOpen, setChannelsOpen] = useState(true);
  const [individualsOpen, setIndividualsOpen] = useState(true);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [bodyError, setBodyError] = useState(false);

  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeDescription = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => {
    autoResizeDescription(descriptionRef.current);
  }, [autoResizeDescription]);

  const canSave = name.trim() !== "" && body.trim() !== "";

  const handleSave = useCallback(async () => {
    let hasError = false;
    if (!name.trim()) {
      setNameError(true);
      hasError = true;
    }
    if (!body.trim()) {
      setBodyError(true);
      hasError = true;
    }
    if (hasError) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        body: body.trim(),
        category,
        status: { org: orgEnabled, channels, individuals },
      });
    } finally {
      setSaving(false);
    }
  }, [name, description, body, category, orgEnabled, channels, individuals, onSave]);

  const addChannel = useCallback((channel: SkillChannelEntry) => {
    setChannels((prev) => [...prev, { ...channel, enabled: true }]);
    setShowChannelPicker(false);
  }, []);

  const toggleChannel = useCallback((id: string) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  }, []);

  const removeChannel = useCallback((id: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addIndividual = useCallback((individual: SkillIndividualEntry) => {
    setIndividuals((prev) => [...prev, { ...individual, enabled: true }]);
    setShowIndividualPicker(false);
  }, []);

  const toggleIndividual = useCallback((id: string) => {
    setIndividuals((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)));
  }, []);

  const removeIndividual = useCallback((id: string) => {
    setIndividuals((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toggleExpandedChannel = useCallback((id: string) => {
    setExpandedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const unaddedChannels: SkillChannelEntry[] = useMemo(() => {
    const addedIds = new Set(channels.map((c) => c.id));
    const slack = (slackData?.channels ?? [])
      .filter((ch) => !addedIds.has(ch.id))
      .map((ch) => ({ id: ch.id, name: ch.name, type: "slack" as const, enabled: false }));
    const wa = (groupData?.groups ?? [])
      .filter((g) => !addedIds.has(g.id))
      .map((g) => ({ id: g.id, name: g.name, type: "whatsapp" as const, enabled: false }));
    return [...slack, ...wa];
  }, [slackData, groupData, channels]);

  const unaddedIndividuals: SkillIndividualEntry[] = useMemo(() => {
    const addedIds = new Set(individuals.map((i) => i.id));
    return (usersData?.users ?? [])
      .filter((u) => !addedIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name, enabled: false }));
  }, [usersData, individuals]);

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

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Input
              placeholder={isNew ? "Skill name..." : undefined}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(false);
              }}
              className={cn(
                "h-auto border-0 bg-transparent px-0 py-0 text-xl font-bold shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50",
                nameError && "text-destructive",
              )}
              autoFocus={isNew}
            />
            {nameError && <p className="mt-1 text-xs text-destructive">Name is required.</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? (
                <>
                  <SpinnerGapIcon size={14} className="mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
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

        {/* Details Tab */}
        {activeTab === "details" && (
          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="skill-description"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Description
              </Label>
              <Textarea
                ref={descriptionRef}
                id="skill-description"
                placeholder="Describe what this skill does and when to use it..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  autoResizeDescription(e.target);
                }}
                className="min-h-[60px] max-h-[200px] resize-none overflow-hidden px-4 py-3"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="skill-body"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Body
              </Label>
              <Textarea
                id="skill-body"
                placeholder="Write the skill logic, instructions, or prompt template..."
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  if (bodyError) setBodyError(false);
                }}
                className={cn("min-h-[360px] resize-y font-mono text-sm", bodyError && "border-destructive")}
              />
              {bodyError && <p className="text-xs text-destructive">Body is required.</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
                  >
                    {getCategoryLabel(category)}
                    <CaretDownIcon size={12} className="text-muted-foreground/80" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {skillCategories.map((cat) => (
                    <DropdownMenuItem key={cat.value} onClick={() => setCategory(cat.value)}>
                      {cat.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {skill?.source && (
              <div className="space-y-2 opacity-70">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Source
                </Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
        )}

        {/* Permissions Tab */}
        {activeTab === "permissions" && (
          <div className="mt-6">
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <Building2 size={16} strokeWidth={1.75} className="text-muted-foreground" />
                <span className="text-sm font-medium">Organisation</span>
                {orgEnabled && <span className="text-[11px] text-muted-foreground/60">All included</span>}
              </div>
              <Switch checked={orgEnabled} onCheckedChange={setOrgEnabled} />
            </div>

            <div
              className={cn(
                "relative ml-3 border-l border-border pl-5",
                orgEnabled && "pointer-events-none opacity-40",
              )}
            >
              {/* Channels */}
              <div className="relative">
                <div className="absolute -left-5 top-[15px] h-px w-5 bg-border" />
                <button
                  type="button"
                  onClick={() => setChannelsOpen((v) => !v)}
                  className="flex w-full items-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <CaretRightIcon
                    size={12}
                    className={cn("shrink-0 transition-transform", channelsOpen && "rotate-90")}
                  />
                  <MessageCircle size={16} strokeWidth={1.75} className="text-muted-foreground" />
                  <span>Channels</span>
                  {!channelsOpen && channels.length > 0 && (
                    <span className="text-[11px] text-muted-foreground/60">
                      {channels.filter((c) => c.enabled).length} active
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
                      {(() => {
                        const q = channelSearch.toLowerCase().trim();
                        const filtered = q ? channels.filter((ch) => ch.name.toLowerCase().includes(q)) : channels;
                        if (q && filtered.length === 0) {
                          return (
                            <p className="py-2 text-xs text-muted-foreground">
                              No channels match &lsquo;{channelSearch}&rsquo;
                            </p>
                          );
                        }
                        return filtered.map((ch) => (
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
                              <ChannelPlatformIcon type={ch.type} />
                              <span className="flex-1 truncate text-sm">{ch.name}</span>
                              <Switch size="sm" checked={ch.enabled} onCheckedChange={() => toggleChannel(ch.id)} />
                              <button
                                type="button"
                                onClick={() => removeChannel(ch.id)}
                                className="text-muted-foreground/60 transition-colors hover:text-foreground"
                              >
                                <XIcon size={12} />
                              </button>
                            </div>
                            {/* TODO: Render expanded channel details once nested permission data is available. */}
                            {expandedChannels.has(ch.id) && null}
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="relative">
                      <div className="absolute -left-5 top-[13px] h-px w-5 bg-border" />
                      {showChannelPicker ? (
                        <div className="space-y-1 py-1">
                          {unaddedChannels.length > 0 ? (
                            unaddedChannels.map((ch) => (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => addChannel(ch)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                              >
                                <ChannelPlatformIcon type={ch.type} />
                                <span className="truncate">{ch.name}</span>
                              </button>
                            ))
                          ) : (
                            <p className="py-1 text-xs text-muted-foreground">All channels added</p>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowChannelPicker(false)}
                            className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowChannelPicker(true)}
                          className="flex items-center gap-1.5 py-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                        >
                          <PlusIcon size={13} weight="bold" /> Add channel
                        </button>
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
                  <CaretRightIcon
                    size={12}
                    className={cn("shrink-0 transition-transform", individualsOpen && "rotate-90")}
                  />
                  <Users size={16} strokeWidth={1.75} className="text-muted-foreground" />
                  <span>Individuals</span>
                  {!individualsOpen && individuals.length > 0 && (
                    <span className="text-[11px] text-muted-foreground/60">
                      {individuals.filter((i) => i.enabled).length} active
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
                      {(() => {
                        const q = individualSearch.toLowerCase().trim();
                        const filtered = q
                          ? individuals.filter((ind) => ind.name.toLowerCase().includes(q))
                          : individuals;
                        if (q && filtered.length === 0) {
                          return (
                            <p className="py-2 text-xs text-muted-foreground">
                              No individuals match &lsquo;{individualSearch}&rsquo;
                            </p>
                          );
                        }
                        return filtered.map((ind) => (
                          <div key={ind.id} className="relative">
                            <div className="absolute -left-5 top-[15px] h-px w-5 bg-border" />
                            <div className="flex items-center gap-2 py-2">
                              <User size={14} strokeWidth={1.75} className="text-muted-foreground" />
                              <span className="flex-1 text-sm">{ind.name}</span>
                              <Switch
                                size="sm"
                                checked={ind.enabled}
                                onCheckedChange={() => toggleIndividual(ind.id)}
                              />
                              <button
                                type="button"
                                onClick={() => removeIndividual(ind.id)}
                                className="text-muted-foreground/60 transition-colors hover:text-foreground"
                              >
                                <XIcon size={12} />
                              </button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="relative">
                      <div className="absolute -left-5 top-[13px] h-px w-5 bg-border" />
                      {showIndividualPicker ? (
                        <div className="max-h-48 space-y-1 overflow-y-auto py-1">
                          {unaddedIndividuals.length > 0 ? (
                            unaddedIndividuals.map((ind) => (
                              <button
                                key={ind.id}
                                type="button"
                                onClick={() => addIndividual(ind)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                              >
                                <User size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                                <span className="truncate">{ind.name}</span>
                              </button>
                            ))
                          ) : (
                            <p className="py-1 text-xs text-muted-foreground">All team members added</p>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowIndividualPicker(false)}
                            className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowIndividualPicker(true)}
                          className="flex items-center gap-1.5 py-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                        >
                          <PlusIcon size={13} weight="bold" /> Add individual
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
