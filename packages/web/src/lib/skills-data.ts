// ── Types ──────────────────────────────────────────────────

export type SkillCategory = "crm" | "comms" | "research" | "ops" | "productivity";

export interface SkillSource {
  hub: string;
  stars: number;
  downloads: string;
}

export interface SkillChannelEntry {
  id: string;
  name: string;
  type: "slack" | "whatsapp";
  enabled: boolean;
}

export interface SkillIndividualEntry {
  id: string;
  name: string;
  enabled: boolean;
}

export interface SkillStatusConfig {
  org: boolean;
  channels: SkillChannelEntry[];
  individuals: SkillIndividualEntry[];
}

export interface SkillIntegration {
  integrationId: string;
  name: string;
  iconBg: string;
  iconLetter: string;
  status: "connected" | "error" | "not_connected";
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  category: SkillCategory;
  status: SkillStatusConfig;
  source?: SkillSource;
  iconBg: string;
  iconEmoji: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface ApiSkill {
  id: string;
  name: string;
  description: string;
  body: string;
  category: SkillCategory;
}

// ── Category Definitions ───────────────────────────────────

export const skillCategories: {
  value: SkillCategory;
  label: string;
}[] = [
  { value: "crm", label: "CRM" },
  { value: "comms", label: "Comms" },
  { value: "research", label: "Research" },
  { value: "ops", label: "Ops" },
  { value: "productivity", label: "Productivity" },
];

export const categoryMeta: Record<SkillCategory, { iconBg: string; iconEmoji: string }> = {
  crm: { iconBg: "bg-orange-500/15", iconEmoji: "📊" },
  comms: { iconBg: "bg-blue-500/15", iconEmoji: "💬" },
  research: { iconBg: "bg-purple-500/15", iconEmoji: "🔍" },
  ops: { iconBg: "bg-emerald-500/15", iconEmoji: "⚙️" },
  productivity: { iconBg: "bg-amber-500/15", iconEmoji: "⚡" },
};

// ── Mock current user ─────────────────────────────────────

/** Mock current user — used to compute "active for me" and source tags */
export const CURRENT_USER_ID = "ind-1"; // Himanshu Kalra

// ── Source tag type ───────────────────────────────────────

export interface SkillSourceTag {
  type: "individual" | "channel";
  label: string; // "You" or "#channel-name"
}

// ── Available channels & individuals for pickers ──────────

export const availableChannels: SkillChannelEntry[] = [
  { id: "ch-1", name: "#sales-team", type: "slack", enabled: false },
  { id: "ch-2", name: "#support", type: "slack", enabled: false },
  { id: "ch-3", name: "#engineering", type: "slack", enabled: false },
  { id: "ch-4", name: "#general", type: "slack", enabled: false },
  { id: "ch-5", name: "WhatsApp — Leads Group", type: "whatsapp", enabled: false },
  { id: "ch-6", name: "WhatsApp — Support Line", type: "whatsapp", enabled: false },
];

export const availableIndividuals: SkillIndividualEntry[] = [
  { id: "ind-1", name: "Himanshu Kalra", enabled: false },
  { id: "ind-2", name: "Apeksha Singh", enabled: false },
  { id: "ind-3", name: "Priya Sharma", enabled: false },
  { id: "ind-4", name: "Rahul Mondal", enabled: false },
  { id: "ind-5", name: "Ananya Gupta", enabled: false },
  { id: "ind-6", name: "Vikram Patel", enabled: false },
  { id: "ind-7", name: "Sarah Chen", enabled: false },
  { id: "ind-8", name: "Rohan Desai", enabled: false },
  { id: "ind-9", name: "Neha Kapoor", enabled: false },
  { id: "ind-10", name: "Arjun Nair", enabled: false },
  { id: "ind-11", name: "Meera Joshi", enabled: false },
  { id: "ind-12", name: "David Kim", enabled: false },
];

// ── Channel membership mapping ────────────────────────────

/** Maps each channel to the individual IDs of its members */
export const channelMembers: Record<string, string[]> = {
  "ch-1": ["ind-1", "ind-2", "ind-3", "ind-4", "ind-5"], // #sales-team
  "ch-2": ["ind-2", "ind-6", "ind-7", "ind-8"], // #support
  "ch-3": ["ind-3", "ind-8", "ind-9", "ind-10"], // #engineering
  "ch-4": [
    "ind-1",
    "ind-2",
    "ind-3",
    "ind-4",
    "ind-5",
    "ind-6",
    "ind-7",
    "ind-8",
    "ind-9",
    "ind-10",
    "ind-11",
    "ind-12",
  ], // #general (everyone)
  "ch-5": ["ind-1", "ind-4", "ind-5"], // WhatsApp — Leads Group
  "ch-6": ["ind-6", "ind-7", "ind-8"], // WhatsApp — Support Line
};

/** Resolve a channel's member IDs to name + id pairs */
export function getChannelMemberDetails(channelId: string): { id: string; name: string }[] {
  const memberIds = channelMembers[channelId] ?? [];
  return memberIds
    .map((id) => {
      const ind = availableIndividuals.find((i) => i.id === id);
      return ind ? { id: ind.id, name: ind.name } : null;
    })
    .filter((x): x is { id: string; name: string } => x !== null);
}

// ── Mock Data ──────────────────────────────────────────────

export const mockSkills: Skill[] = [
  {
    id: "skill-1",
    name: "Create CRM Lead",
    description: "Automatically creates a new lead in the CRM when a potential customer is identified in conversation.",
    body: `# Create CRM Lead

## Trigger
When the user mentions a new potential customer or company.

## Steps
1. Extract the company name, contact person, email, and phone if available
2. Check if the lead already exists in HubSpot or Close
3. If new, create a lead with the extracted information
4. If existing, update the lead with any new information
5. Respond with a confirmation and the lead URL

## Output Format
- Lead name and company
- CRM link
- Status (created / updated)`,
    category: "crm",
    status: {
      org: true,
      channels: [],
      individuals: [],
    },
    source: { hub: "ClawHub", stars: 4.8, downloads: "2.3k" },
    iconBg: "bg-orange-500/15",
    iconEmoji: "📊",
    lastUsedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "skill-2",
    name: "Draft Follow-up Email",
    description: "Generates a personalized follow-up email based on the conversation context and past interactions.",
    body: `# Draft Follow-up Email

## Trigger
Given a conversation summary and a contact.

## Steps
1. Retrieve the contact's recent interaction history
2. Draft a follow-up email that:
   - References the recent conversation
   - Proposes next steps
   - Includes a scheduling link if appropriate
3. Present the draft for review before sending

## Tone
Professional, concise, action-oriented.`,
    category: "comms",
    status: {
      org: false,
      channels: [
        { id: "ch-1", name: "#sales-team", type: "slack", enabled: true },
        { id: "ch-2", name: "#support", type: "slack", enabled: true },
      ],
      individuals: [
        { id: "ind-1", name: "Himanshu Kalra", enabled: true },
        { id: "ind-2", name: "Apeksha Singh", enabled: true },
      ],
    },
    source: { hub: "ClawHub", stars: 4.2, downloads: "1.2k" },
    iconBg: "bg-blue-500/15",
    iconEmoji: "💬",
    lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
  },
  {
    id: "skill-3",
    name: "Research Company",
    description:
      "Performs deep research on a company including financials, recent news, key personnel, and competitive landscape.",
    body: `# Research Company

## Trigger
When asked to research a company.

## Steps
1. Gather basic info (industry, size, location, funding)
2. Find recent news articles and press releases
3. Identify key decision makers and their LinkedIn profiles
4. Analyze competitive positioning
5. Compile findings into a structured brief

## Output
Structured company brief with sections for Overview, News, People, and Competition.`,
    category: "research",
    status: {
      org: false,
      channels: [{ id: "ch-1", name: "#sales-team", type: "slack", enabled: true }],
      individuals: [
        { id: "ind-1", name: "Himanshu Kalra", enabled: true },
        { id: "ind-2", name: "Apeksha Singh", enabled: true },
        { id: "ind-3", name: "Priya Sharma", enabled: true },
        { id: "ind-4", name: "Rahul Mondal", enabled: true },
        { id: "ind-5", name: "Ananya Gupta", enabled: true },
        { id: "ind-6", name: "Vikram Patel", enabled: true },
        { id: "ind-7", name: "Sarah Chen", enabled: true },
        { id: "ind-8", name: "Rohan Desai", enabled: true },
        { id: "ind-9", name: "Neha Kapoor", enabled: true },
        { id: "ind-10", name: "Arjun Nair", enabled: true },
      ],
    },
    source: { hub: "ClawHub", stars: 4.5, downloads: "980" },
    iconBg: "bg-purple-500/15",
    iconEmoji: "🔍",
    lastUsedAt: new Date(Date.now() - 30 * 60 * 1000),
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
  },
  {
    id: "skill-4",
    name: "Sync Deal to Sheets",
    description: "Exports deal data from CRM to a Google Sheets tracker for custom reporting.",
    body: `# Sync Deal to Sheets

## Trigger
When a deal status changes.

## Steps
1. Fetch the deal details from the CRM
2. Find or create the target Google Sheet
3. Add a new row with deal name, value, stage, owner, and dates
4. Update totals and formatting
5. Share a link to the updated sheet`,
    category: "ops",
    status: {
      org: false,
      channels: [],
      individuals: [{ id: "ind-1", name: "Himanshu Kalra", enabled: true }],
    },
    iconBg: "bg-emerald-500/15",
    iconEmoji: "⚙️",
    lastUsedAt: null,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
  },
  {
    id: "skill-5",
    name: "Summarize Slack Thread",
    description: "Creates a concise summary of a Slack thread including key decisions and action items.",
    body: `# Summarize Slack Thread

## Trigger
When given a Slack thread or channel.

## Steps
1. Retrieve the thread messages
2. Identify key discussion points
3. Extract decisions made
4. List action items with assignees
5. Format as a structured summary

## Output Format
- **Topic:** Brief description
- **Decisions:** Bulleted list
- **Action Items:** Owner + task + deadline`,
    category: "productivity",
    status: {
      org: true,
      channels: [],
      individuals: [],
    },
    source: { hub: "ClawHub", stars: 4.6, downloads: "3.1k" },
    iconBg: "bg-amber-500/15",
    iconEmoji: "⚡",
    lastUsedAt: null,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
  {
    id: "skill-6",
    name: "Update Deal Stage",
    description: "Moves a CRM deal to the next stage based on conversation signals.",
    body: `# Update Deal Stage

## Trigger
When conversation indicates deal progression.

## Steps
1. Identify the current deal stage
2. Determine the appropriate next stage
3. Update the deal in the CRM
4. Log the reason for advancement
5. Notify the deal owner`,
    category: "crm",
    status: {
      org: false,
      channels: [
        { id: "ch-1", name: "#sales-team", type: "slack", enabled: true },
        { id: "ch-5", name: "WhatsApp — Leads Group", type: "whatsapp", enabled: true },
      ],
      individuals: [],
    },
    source: { hub: "ClawHub", stars: 3.9, downloads: "540" },
    iconBg: "bg-orange-500/15",
    iconEmoji: "📊",
    lastUsedAt: null,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
  },
  {
    id: "skill-7",
    name: "Send WhatsApp Broadcast",
    description: "Sends a templated WhatsApp message to a list of contacts.",
    body: `# Send WhatsApp Broadcast

## Trigger
When the user wants to broadcast.

## Steps
1. Select contacts from the CRM
2. Choose or create a message template
3. Personalize per contact
4. Send via WhatsApp Business API
5. Track delivery and read receipts`,
    category: "comms",
    status: {
      org: false,
      channels: [],
      individuals: [],
    },
    iconBg: "bg-blue-500/15",
    iconEmoji: "💬",
    lastUsedAt: null,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "skill-8",
    name: "Generate Meeting Notes",
    description: "Creates structured meeting notes from a conversation, extracting key topics and action items.",
    body: `# Generate Meeting Notes

## Trigger
After a meeting or conversation.

## Steps
1. Parse the conversation transcript
2. Identify attendees and their contributions
3. Extract main discussion topics
4. List decisions and rationale
5. Create action items with owners and deadlines
6. Save to Notion as a meeting note`,
    category: "productivity",
    status: {
      org: false,
      channels: [{ id: "ch-4", name: "#general", type: "slack", enabled: true }],
      individuals: [
        { id: "ind-1", name: "Himanshu Kalra", enabled: true },
        { id: "ind-2", name: "Apeksha Singh", enabled: true },
      ],
    },
    source: { hub: "ClawHub", stars: 4.1, downloads: "890" },
    iconBg: "bg-amber-500/15",
    iconEmoji: "⚡",
    lastUsedAt: null,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "skill-9",
    name: "Competitor Price Check",
    description: "Researches and compares competitor pricing for a specific product or service.",
    body: `# Competitor Price Check

## Trigger
When asked about competitor pricing.

## Steps
1. Identify the product/service category
2. Look up known competitors
3. Gather pricing information from public sources
4. Create a comparison table
5. Highlight key differentiators`,
    category: "research",
    status: {
      org: false,
      channels: [],
      individuals: [{ id: "ind-1", name: "Himanshu Kalra", enabled: true }],
    },
    iconBg: "bg-purple-500/15",
    iconEmoji: "🔍",
    lastUsedAt: null,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

// ── Utilities ──────────────────────────────────────────────

export function fromApiSkill(s: ApiSkill): Skill {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    body: s.body,
    category: s.category,
    status: { org: true, channels: [], individuals: [] },
    iconBg: categoryMeta[s.category].iconBg,
    iconEmoji: categoryMeta[s.category].iconEmoji,
    source: undefined,
    lastUsedAt: null,
    createdAt: new Date(),
  };
}

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "1 day ago";
  return `${diffDay} days ago`;
}

export function getCategoryLabel(category: SkillCategory): string {
  const found = skillCategories.find((c) => c.value === category);
  return found?.label ?? category;
}

/** Check if a skill is enabled for anyone */
export function isSkillEnabled(status: SkillStatusConfig): boolean {
  if (status.org) return true;
  if (status.channels.some((c) => c.enabled)) return true;
  if (status.individuals.some((i) => i.enabled)) return true;
  return false;
}

/** Get active channels from a skill status */
export function getActiveChannels(status: SkillStatusConfig): SkillChannelEntry[] {
  return status.channels.filter((c) => c.enabled);
}

/** Get active individuals from a skill status */
export function getActiveIndividuals(status: SkillStatusConfig): SkillIndividualEntry[] {
  return status.individuals.filter((i) => i.enabled);
}

/**
 * Check if a skill is active for a specific user.
 * Active means: org-wide enabled, OR user is in individuals (enabled),
 * OR any channel is enabled (mock: all enabled channels accessible to user).
 */
export function isSkillActiveForUser(status: SkillStatusConfig, userId: string): boolean {
  if (status.org) return true;
  if (status.individuals.some((i) => i.id === userId && i.enabled)) return true;
  if (status.channels.some((c) => c.enabled)) return true;
  return false;
}

/**
 * Get the activation sources for a skill, relative to a specific user.
 * Returns tags in display order: "You" first, then channels alphabetically.
 * Org-wide skills return empty array (no source tags needed).
 */
export function getSkillSourcesForUser(status: SkillStatusConfig, userId: string): SkillSourceTag[] {
  if (status.org) return [];

  const tags: SkillSourceTag[] = [];

  // Check if user is individually assigned
  if (status.individuals.some((i) => i.id === userId && i.enabled)) {
    tags.push({ type: "individual", label: "You" });
  }

  // Add enabled channels, sorted alphabetically
  const enabledChannels = status.channels.filter((c) => c.enabled).sort((a, b) => a.name.localeCompare(b.name));

  for (const ch of enabledChannels) {
    tags.push({ type: "channel", label: ch.name });
  }

  return tags;
}
