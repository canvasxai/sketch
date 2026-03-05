import { DeleteSkillDialog } from "@/components/skills/delete-skill-dialog";
import { DiscardChangesDialog } from "@/components/skills/discard-changes-dialog";
import { SkillCard } from "@/components/skills/skill-card";
import { SkillDetailEdit, type SkillDraft } from "@/components/skills/skill-detail-edit";
import { SkillDetailView } from "@/components/skills/skill-detail-view";
import { SkillsEmptyState } from "@/components/skills/skills-empty-state";
import { SkillsFilterBar } from "@/components/skills/skills-filter-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ApiSkill,
  CURRENT_USER_ID,
  type Skill,
  type SkillCategory,
  categoryMeta,
  fromApiSkill,
  getCategoryLabel,
  getSkillSourcesForUser,
  isSkillActiveForUser,
  isSkillEnabled,
  mockSkills,
} from "@/lib/skills-data";
import { cn } from "@/lib/utils";
import { PlusIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
/**
 * Skills page — create, manage, and configure skills (custom agent behaviors).
 *
 * Two listing tabs:
 *  - Active   → skills currently enabled for the current user
 *  - Explore  → all skills; clicking one opens an explore-preview with "Add Skill" CTA
 *
 * Page modes: listing → view | explore-preview → edit | create
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { dashboardRoute } from "./dashboard";

export const skillsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/skills",
  component: SkillsPage,
});

type PageMode = "listing" | "view" | "edit" | "create" | "explore-preview";
type ListingTab = "active" | "explore";

export function SkillsPage() {
  // ── Core state ────────────────────────────────────────────
  const [mode, setMode] = useState<PageMode>("listing");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<SkillCategory[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "permissions">("details");

  // ── Listing tabs ──────────────────────────────────────────
  const [listingTab, setListingTab] = useState<ListingTab>("active");
  const [viewOrigin, setViewOrigin] = useState<ListingTab>("active");

  // ── Dialogs ────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null);

  const skillsQuery = useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const res = await fetch("/api/skills");
      if (!res.ok) throw new Error(`Failed to load skills (${res.status})`);
      return (await res.json()) as { skills: ApiSkill[] };
    },
  });

  // Hydrate the local editable state once.
  useEffect(() => {
    if (skills.length > 0) return;
    if (skillsQuery.data?.skills) {
      setSkills(skillsQuery.data.skills.map(fromApiSkill));
      return;
    }
    if (skillsQuery.isError) {
      setSkills(mockSkills);
    }
  }, [skills.length, skillsQuery.data, skillsQuery.isError]);

  // ── Derived data ──────────────────────────────────────────
  const isAdmin = true;

  const totalActiveCount = useMemo(
    () => skills.filter((s) => isSkillActiveForUser(s.status, CURRENT_USER_ID)).length,
    [skills],
  );

  const activeSkills = useMemo(() => {
    let result = skills.filter((s) => isSkillActiveForUser(s.status, CURRENT_USER_ID));
    if (activeCategories.length > 0) {
      result = result.filter((s) => activeCategories.includes(s.category));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return result;
  }, [skills, activeCategories, searchQuery]);

  const exploreSkills = useMemo(() => {
    let result = skills;
    if (activeCategories.length > 0) {
      result = result.filter((s) => activeCategories.includes(s.category));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return result;
  }, [skills, activeCategories, searchQuery]);

  const selectedSkill = useMemo(() => skills.find((s) => s.id === selectedSkillId) ?? null, [skills, selectedSkillId]);

  // ── Handlers ──────────────────────────────────────────────

  const handleCardClick = useCallback(
    (skillId: string) => {
      setSelectedSkillId(skillId);
      setActiveTab("details");
      setMode(listingTab === "explore" ? "explore-preview" : "view");
      setViewOrigin(listingTab);
    },
    [listingTab],
  );

  const handleEditClick = useCallback(() => {
    setMode("edit");
  }, []);

  const handleCreateClick = useCallback(() => {
    setSelectedSkillId(null);
    setActiveTab("details");
    setMode("create");
  }, []);

  const handleBackToListing = useCallback(() => {
    setSelectedSkillId(null);
    setActiveTab("details");
    setMode("listing");
  }, []);

  const handleAddSkill = useCallback(() => {
    setActiveTab("permissions");
    setMode("edit");
  }, []);

  const handleSave = useCallback(
    async (draft: SkillDraft) => {
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (mode === "create") {
        const newSkill: Skill = {
          id: `skill-${Date.now()}`,
          name: draft.name,
          description: draft.description,
          body: draft.body,
          category: draft.category,
          status: draft.status,
          iconBg: categoryMeta[draft.category].iconBg,
          iconEmoji: categoryMeta[draft.category].iconEmoji,
          lastUsedAt: null,
          createdAt: new Date(),
        };
        setSkills((prev) => [newSkill, ...prev]);
        setSelectedSkillId(newSkill.id);
        setMode("view");
        setListingTab("active");
        toast.success("Skill created");
      } else {
        const wasExplore = viewOrigin === "explore";
        setSkills((prev) =>
          prev.map((s) =>
            s.id === selectedSkillId
              ? {
                  ...s,
                  name: draft.name,
                  description: draft.description,
                  body: draft.body,
                  category: draft.category,
                  status: draft.status,
                }
              : s,
          ),
        );
        setMode("view");
        setViewOrigin("active");
        if (wasExplore) {
          setListingTab("active");
          toast.success("Skill added");
        } else {
          toast.success("Skill updated");
        }
      }
    },
    [mode, selectedSkillId, viewOrigin],
  );

  const handleCancelEdit = useCallback(() => {
    setDiscardDialogOpen(true);
  }, []);

  const handleDiscardConfirm = useCallback(() => {
    if (mode === "create") {
      setSelectedSkillId(null);
      setMode("listing");
    } else if (viewOrigin === "explore") {
      setMode("explore-preview");
    } else {
      setMode("view");
    }
  }, [mode, viewOrigin]);

  const handleDuplicate = useCallback((skill: Skill) => {
    const duplicate: Skill = {
      ...skill,
      id: `skill-dup-${Date.now()}`,
      name: `${skill.name} (copy)`,
      lastUsedAt: null,
      createdAt: new Date(),
      source: undefined,
    };
    setSkills((prev) => [duplicate, ...prev]);
    setSelectedSkillId(duplicate.id);
    setMode("edit");
    setViewOrigin("active");
    toast.success("Skill duplicated");
  }, []);

  const handleToggleDisable = useCallback((skillId: string) => {
    setSkills((prev) =>
      prev.map((s) => {
        if (s.id !== skillId) return s;
        const currently = isSkillEnabled(s.status);
        if (currently) {
          toast.success("Skill disabled");
          return {
            ...s,
            status: {
              org: false,
              channels: s.status.channels.map((c) => ({ ...c, enabled: false })),
              individuals: s.status.individuals.map((i) => ({ ...i, enabled: false })),
            },
          };
        }
        toast.success("Skill enabled");
        return { ...s, status: { ...s.status, org: true } };
      }),
    );
  }, []);

  const handleDeleteClick = useCallback((skill: Skill) => {
    setSkillToDelete(skill);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!skillToDelete) return;
    setSkills((prev) => prev.filter((s) => s.id !== skillToDelete.id));
    toast.success("Skill deleted");
    setSkillToDelete(null);
    setSelectedSkillId(null);
    setMode("listing");
  }, [skillToDelete]);

  const handleCategoryToggle = useCallback((category: SkillCategory) => {
    setActiveCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  }, []);

  const handleListingTabChange = useCallback((tab: ListingTab) => {
    setListingTab(tab);
    setSearchQuery("");
    setActiveCategories([]);
  }, []);

  // ── Loading skeleton ───────────────────────────────────────
  if (skillsQuery.isLoading && skills.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-10 py-8">
        <div className="flex items-start justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Explore-preview mode ───────────────────────────────────
  if (mode === "explore-preview" && selectedSkill) {
    return (
      <div className="mx-auto max-w-4xl px-10 py-8">
        <SkillDetailView
          skill={selectedSkill}
          isAdmin={isAdmin}
          activeTab="details"
          onTabChange={() => {}}
          onBack={handleBackToListing}
          onEdit={handleEditClick}
          onDuplicate={handleDuplicate}
          onToggleDisable={handleToggleDisable}
          onDelete={handleDeleteClick}
          isExplorePreview
          onAddSkill={handleAddSkill}
        />
        <DeleteSkillDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          skillName={skillToDelete?.name ?? null}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────
  if (mode === "view" && selectedSkill) {
    return (
      <div className="mx-auto max-w-4xl px-10 py-8">
        <SkillDetailView
          skill={selectedSkill}
          isAdmin={isAdmin}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={handleBackToListing}
          onEdit={handleEditClick}
          onDuplicate={handleDuplicate}
          onToggleDisable={handleToggleDisable}
          onDelete={handleDeleteClick}
        />
        <DeleteSkillDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          skillName={skillToDelete?.name ?? null}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    );
  }

  // ── Edit / Create mode ─────────────────────────────────────
  if (mode === "edit" || mode === "create") {
    return (
      <div className="mx-auto max-w-4xl px-10 py-8">
        <SkillDetailEdit
          skill={mode === "edit" && selectedSkill ? selectedSkill : null}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={handleCancelEdit}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          isAddingFromExplore={viewOrigin === "explore" && mode === "edit"}
        />
        <DiscardChangesDialog
          open={discardDialogOpen}
          onOpenChange={setDiscardDialogOpen}
          onConfirm={handleDiscardConfirm}
          isNewSkill={mode === "create"}
        />
      </div>
    );
  }

  // ── Listing mode ───────────────────────────────────────────
  const displayedSkills = listingTab === "active" ? activeSkills : exploreSkills;
  const showEmptyState = displayedSkills.length === 0;
  const emptyVariant: "no-skills" | "no-results" | "no-category" =
    skills.length === 0
      ? "no-skills"
      : searchQuery.trim()
        ? "no-results"
        : activeCategories.length > 0
          ? "no-category"
          : "no-skills";

  return (
    <div className="mx-auto max-w-4xl px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Skills</h1>
          <p className="mt-1 text-sm text-muted-foreground">Discover and manage your bot&apos;s capabilities.</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-1.5" onClick={handleCreateClick}>
            <PlusIcon size={14} weight="bold" />
            Create Skill
          </Button>
        )}
      </div>

      {/* Active / Explore tabs */}
      <div className="mt-4 flex gap-4 border-b border-border">
        {(["active", "explore"] as const).map((tab) => {
          const count = tab === "active" ? totalActiveCount : skills.length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleListingTabChange(tab)}
              className={cn(
                "relative py-2 text-sm capitalize transition-colors",
                listingTab === tab
                  ? "font-medium text-foreground"
                  : "font-normal text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {tab}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground/60">{count}</span>
              {listingTab === tab && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <SkillsFilterBar
        activeCategories={activeCategories}
        onCategoryToggle={handleCategoryToggle}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={listingTab === "active" ? "Search active skills..." : "Search all skills..."}
      />

      {/* Grid or empty state */}
      <div className="mt-6">
        {showEmptyState ? (
          <SkillsEmptyState
            variant={emptyVariant}
            searchQuery={searchQuery}
            category={activeCategories.length > 0 ? activeCategories.map(getCategoryLabel).join(", ") : undefined}
            onCreateClick={handleCreateClick}
            onClearSearch={searchQuery.trim() ? () => setSearchQuery("") : undefined}
            showCreateButton={isAdmin}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayedSkills.map((skill) => {
              const sourceTags =
                !isAdmin && listingTab === "active" ? getSkillSourcesForUser(skill.status, CURRENT_USER_ID) : undefined;
              return (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  sourceTags={sourceTags}
                  onCardClick={handleCardClick}
                  onDuplicate={handleDuplicate}
                  onToggleDisable={handleToggleDisable}
                  onDelete={handleDeleteClick}
                />
              );
            })}
          </div>
        )}
      </div>

      <DeleteSkillDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        skillName={skillToDelete?.name ?? null}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
