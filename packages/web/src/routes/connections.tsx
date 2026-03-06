/**
 * Connections page — manage MCP servers and per-user integrations.
 *
 * Two sections:
 * 1. Integrations — per-user OAuth via Canvas or Composio (appears after provider connected)
 * 2. MCP Servers — admin-configured MCP server connections
 *
 * The integration provider MCP (Canvas/Composio) is hidden from the MCP list;
 * it's surfaced only as "via Canvas" in the Integrations section header.
 */
import { ConnectionsBanner } from "@/components/connections-banner";
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
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckIcon,
  CircleDashedIcon,
  DotsThreeIcon,
  GearIcon,
  LinkSimpleIcon,
  PencilSimpleIcon,
  PlusIcon,
  SpinnerGapIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { dashboardRoute } from "./dashboard";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const connectionsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/connections",
  component: ConnectionsPage,
});

// ---------------------------------------------------------------------------
// Mock data — will be replaced with API calls
// ---------------------------------------------------------------------------

interface McpServer {
  id: string;
  name: string;
  url: string;
  status: "active" | "error" | "connecting";
  toolCount: number;
  oauthClientId?: string;
  oauthClientSecret?: string;
  isIntegrationProvider?: boolean;
}

type ToolPermission = "always_allow" | "needs_approval" | "never";

interface IntegrationTool {
  id: string;
  name: string;
  category: "read" | "write";
  permission: ToolPermission;
}

interface Integration {
  id: string;
  service: string;
  description: string;
  myStatus: "connected" | "not_connected";
  connectedUsers: number;
  totalUsers: number;
  tools: IntegrationTool[];
}

type IntegrationProvider = {
  type: "canvas" | "composio";
  status: "connected" | "not_connected";
} | null;

/** Catalog of apps available to add via Canvas. */
interface CatalogApp {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaultTools: IntegrationTool[];
}

const CATALOG: CatalogApp[] = [
  {
    id: "cat-clickup",
    name: "ClickUp",
    description: "Project management & tasks",
    category: "Productivity",
    icon: "CU",
    defaultTools: [
      { id: "cu-1", name: "clickup-get-tasks", category: "read", permission: "always_allow" },
      { id: "cu-2", name: "clickup-get-spaces", category: "read", permission: "always_allow" },
      { id: "cu-3", name: "clickup-get-lists", category: "read", permission: "always_allow" },
      { id: "cu-4", name: "clickup-create-task", category: "write", permission: "needs_approval" },
      { id: "cu-5", name: "clickup-update-task", category: "write", permission: "needs_approval" },
      { id: "cu-6", name: "clickup-delete-task", category: "write", permission: "needs_approval" },
      { id: "cu-7", name: "clickup-create-comment", category: "write", permission: "needs_approval" },
    ],
  },
  {
    id: "cat-slack",
    name: "Slack",
    description: "Team messaging & channels",
    category: "Communication",
    icon: "SL",
    defaultTools: [
      { id: "sl-1", name: "slack-list-channels", category: "read", permission: "always_allow" },
      { id: "sl-2", name: "slack-read-messages", category: "read", permission: "always_allow" },
      { id: "sl-3", name: "slack-get-users", category: "read", permission: "always_allow" },
      { id: "sl-4", name: "slack-send-message", category: "write", permission: "needs_approval" },
      { id: "sl-5", name: "slack-update-message", category: "write", permission: "needs_approval" },
      { id: "sl-6", name: "slack-delete-message", category: "write", permission: "never" },
    ],
  },
  {
    id: "cat-gcal",
    name: "Google Calendar",
    description: "Calendar & scheduling",
    category: "Productivity",
    icon: "GC",
    defaultTools: [
      { id: "gc-1", name: "gcal-list-events", category: "read", permission: "always_allow" },
      { id: "gc-2", name: "gcal-get-event", category: "read", permission: "always_allow" },
      { id: "gc-3", name: "gcal-create-event", category: "write", permission: "needs_approval" },
      { id: "gc-4", name: "gcal-update-event", category: "write", permission: "needs_approval" },
      { id: "gc-5", name: "gcal-delete-event", category: "write", permission: "never" },
    ],
  },
  {
    id: "cat-gmail",
    name: "Gmail",
    description: "Email management",
    category: "Communication",
    icon: "GM",
    defaultTools: [
      { id: "gm-1", name: "gmail-search", category: "read", permission: "always_allow" },
      { id: "gm-2", name: "gmail-get-message", category: "read", permission: "always_allow" },
      { id: "gm-3", name: "gmail-get-thread", category: "read", permission: "always_allow" },
      { id: "gm-4", name: "gmail-send-email", category: "write", permission: "needs_approval" },
      { id: "gm-5", name: "gmail-reply", category: "write", permission: "needs_approval" },
      { id: "gm-6", name: "gmail-trash-message", category: "write", permission: "never" },
      { id: "gm-7", name: "gmail-create-draft", category: "write", permission: "needs_approval" },
    ],
  },
  {
    id: "cat-notion",
    name: "Notion",
    description: "Docs, wikis & databases",
    category: "Productivity",
    icon: "NO",
    defaultTools: [
      { id: "no-1", name: "notion-search", category: "read", permission: "always_allow" },
      { id: "no-2", name: "notion-get-page", category: "read", permission: "always_allow" },
      { id: "no-3", name: "notion-get-database", category: "read", permission: "always_allow" },
      { id: "no-4", name: "notion-create-page", category: "write", permission: "needs_approval" },
      { id: "no-5", name: "notion-update-page", category: "write", permission: "needs_approval" },
      { id: "no-6", name: "notion-delete-page", category: "write", permission: "never" },
    ],
  },
  {
    id: "cat-hubspot",
    name: "HubSpot",
    description: "CRM & marketing automation",
    category: "Sales",
    icon: "HS",
    defaultTools: [
      { id: "hs-1", name: "hubspot-get-contacts", category: "read", permission: "always_allow" },
      { id: "hs-2", name: "hubspot-get-deals", category: "read", permission: "always_allow" },
      { id: "hs-3", name: "hubspot-search", category: "read", permission: "always_allow" },
      { id: "hs-4", name: "hubspot-create-contact", category: "write", permission: "needs_approval" },
      { id: "hs-5", name: "hubspot-update-deal", category: "write", permission: "needs_approval" },
    ],
  },
  {
    id: "cat-jira",
    name: "Jira",
    description: "Issue & project tracking",
    category: "Productivity",
    icon: "JI",
    defaultTools: [
      { id: "ji-1", name: "jira-search-issues", category: "read", permission: "always_allow" },
      { id: "ji-2", name: "jira-get-issue", category: "read", permission: "always_allow" },
      { id: "ji-3", name: "jira-get-projects", category: "read", permission: "always_allow" },
      { id: "ji-4", name: "jira-create-issue", category: "write", permission: "needs_approval" },
      { id: "ji-5", name: "jira-update-issue", category: "write", permission: "needs_approval" },
      { id: "ji-6", name: "jira-add-comment", category: "write", permission: "needs_approval" },
    ],
  },
  {
    id: "cat-linear",
    name: "Linear",
    description: "Issue tracking for teams",
    category: "Productivity",
    icon: "LI",
    defaultTools: [
      { id: "li-1", name: "linear-list-issues", category: "read", permission: "always_allow" },
      { id: "li-2", name: "linear-get-issue", category: "read", permission: "always_allow" },
      { id: "li-3", name: "linear-create-issue", category: "write", permission: "needs_approval" },
      { id: "li-4", name: "linear-update-issue", category: "write", permission: "needs_approval" },
    ],
  },
  {
    id: "cat-github",
    name: "GitHub",
    description: "Code hosting & collaboration",
    category: "Development",
    icon: "GH",
    defaultTools: [
      { id: "gh-1", name: "github-list-repos", category: "read", permission: "always_allow" },
      { id: "gh-2", name: "github-get-issues", category: "read", permission: "always_allow" },
      { id: "gh-3", name: "github-get-prs", category: "read", permission: "always_allow" },
      { id: "gh-4", name: "github-create-issue", category: "write", permission: "needs_approval" },
      { id: "gh-5", name: "github-create-pr", category: "write", permission: "needs_approval" },
      { id: "gh-6", name: "github-create-comment", category: "write", permission: "needs_approval" },
    ],
  },
  {
    id: "cat-figma",
    name: "Figma",
    description: "Design & prototyping",
    category: "Design",
    icon: "FI",
    defaultTools: [
      { id: "fi-1", name: "figma-get-files", category: "read", permission: "always_allow" },
      { id: "fi-2", name: "figma-get-comments", category: "read", permission: "always_allow" },
      { id: "fi-3", name: "figma-post-comment", category: "write", permission: "needs_approval" },
    ],
  },
  {
    id: "cat-asana",
    name: "Asana",
    description: "Work management & tasks",
    category: "Productivity",
    icon: "AS",
    defaultTools: [
      { id: "as-1", name: "asana-list-tasks", category: "read", permission: "always_allow" },
      { id: "as-2", name: "asana-get-task", category: "read", permission: "always_allow" },
      { id: "as-3", name: "asana-create-task", category: "write", permission: "needs_approval" },
      { id: "as-4", name: "asana-update-task", category: "write", permission: "needs_approval" },
    ],
  },
  {
    id: "cat-intercom",
    name: "Intercom",
    description: "Customer messaging platform",
    category: "Support",
    icon: "IC",
    defaultTools: [
      { id: "ic-1", name: "intercom-list-conversations", category: "read", permission: "always_allow" },
      { id: "ic-2", name: "intercom-get-contacts", category: "read", permission: "always_allow" },
      { id: "ic-3", name: "intercom-reply", category: "write", permission: "needs_approval" },
      { id: "ic-4", name: "intercom-create-note", category: "write", permission: "needs_approval" },
    ],
  },
];

function useMockData() {
  const [provider, setProvider] = useState<IntegrationProvider>(null);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([
    {
      id: "mcp-1",
      name: "GitHub",
      url: "https://gh-mcp.example.com/sse",
      status: "active",
      toolCount: 12,
    },
    {
      id: "mcp-2",
      name: "Sentry",
      url: "https://sentry-mcp.io/sse",
      status: "active",
      toolCount: 3,
    },
  ]);
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "int-1",
      service: "ClickUp",
      description: "Project management",
      myStatus: "connected",
      connectedUsers: 3,
      totalUsers: 5,
      tools: [
        { id: "cu-1", name: "clickup-get-tasks", category: "read", permission: "always_allow" },
        { id: "cu-2", name: "clickup-get-spaces", category: "read", permission: "always_allow" },
        { id: "cu-3", name: "clickup-get-lists", category: "read", permission: "always_allow" },
        { id: "cu-4", name: "clickup-create-task", category: "write", permission: "needs_approval" },
        { id: "cu-5", name: "clickup-update-task", category: "write", permission: "needs_approval" },
        { id: "cu-6", name: "clickup-delete-task", category: "write", permission: "needs_approval" },
        { id: "cu-7", name: "clickup-create-comment", category: "write", permission: "needs_approval" },
      ],
    },
    {
      id: "int-2",
      service: "Slack",
      description: "Team messaging",
      myStatus: "connected",
      connectedUsers: 5,
      totalUsers: 5,
      tools: [
        { id: "sl-1", name: "slack-list-channels", category: "read", permission: "always_allow" },
        { id: "sl-2", name: "slack-read-messages", category: "read", permission: "always_allow" },
        { id: "sl-3", name: "slack-get-users", category: "read", permission: "always_allow" },
        { id: "sl-4", name: "slack-send-message", category: "write", permission: "needs_approval" },
        { id: "sl-5", name: "slack-update-message", category: "write", permission: "needs_approval" },
        { id: "sl-6", name: "slack-delete-message", category: "write", permission: "never" },
      ],
    },
    {
      id: "int-3",
      service: "Google Calendar",
      description: "Calendar & scheduling",
      myStatus: "not_connected",
      connectedUsers: 0,
      totalUsers: 5,
      tools: [
        { id: "gc-1", name: "gcal-list-events", category: "read", permission: "always_allow" },
        { id: "gc-2", name: "gcal-get-event", category: "read", permission: "always_allow" },
        { id: "gc-3", name: "gcal-create-event", category: "write", permission: "needs_approval" },
        { id: "gc-4", name: "gcal-update-event", category: "write", permission: "needs_approval" },
        { id: "gc-5", name: "gcal-delete-event", category: "write", permission: "never" },
      ],
    },
    {
      id: "int-4",
      service: "Gmail",
      description: "Email",
      myStatus: "connected",
      connectedUsers: 2,
      totalUsers: 5,
      tools: [
        { id: "gm-1", name: "gmail-search", category: "read", permission: "always_allow" },
        { id: "gm-2", name: "gmail-get-message", category: "read", permission: "always_allow" },
        { id: "gm-3", name: "gmail-get-thread", category: "read", permission: "always_allow" },
        { id: "gm-4", name: "gmail-send-email", category: "write", permission: "needs_approval" },
        { id: "gm-5", name: "gmail-reply", category: "write", permission: "needs_approval" },
        { id: "gm-6", name: "gmail-trash-message", category: "write", permission: "never" },
        { id: "gm-7", name: "gmail-create-draft", category: "write", permission: "needs_approval" },
      ],
    },
  ]);

  return {
    provider,
    setProvider,
    mcpServers,
    setMcpServers,
    integrations,
    setIntegrations,
    isLoading: false,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ConnectionsPage() {
  const { provider, setProvider, mcpServers, setMcpServers, integrations, setIntegrations, isLoading } = useMockData();

  const [showAddMcpDialog, setShowAddMcpDialog] = useState(false);
  const [editingMcp, setEditingMcp] = useState<McpServer | null>(null);
  const [removingMcp, setRemovingMcp] = useState<McpServer | null>(null);
  const [showConnectProviderDialog, setShowConnectProviderDialog] = useState<"canvas" | "composio" | null>(null);
  const [managingIntegration, setManagingIntegration] = useState<Integration | null>(null);
  const [showAddIntegrationDialog, setShowAddIntegrationDialog] = useState(false);

  const alreadyAddedServices = new Set(integrations.map((i) => i.service));

  const handleAddIntegration = (app: CatalogApp) => {
    const newIntegration: Integration = {
      id: `int-${Date.now()}`,
      service: app.name,
      description: app.description,
      myStatus: "connected",
      connectedUsers: 1,
      totalUsers: 5,
      tools: app.defaultTools.map((t) => ({ ...t, id: `${t.id}-${Date.now()}` })),
    };
    setIntegrations((prev) => [...prev, newIntegration]);
    setShowAddIntegrationDialog(false);
    toast.success(`${app.name} connected`);
  };

  const handleProviderConnected = (type: "canvas" | "composio") => {
    setProvider({ type, status: "connected" });
    setShowConnectProviderDialog(null);
    toast.success(`${type === "canvas" ? "Canvas" : "Composio"} connected`);
  };

  const handleAddMcp = (server: Omit<McpServer, "id" | "status" | "toolCount" | "isIntegrationProvider">) => {
    const newServer: McpServer = {
      ...server,
      id: `mcp-${Date.now()}`,
      status: "active",
      toolCount: 0,
    };
    setMcpServers((prev) => [...prev, newServer]);
    setShowAddMcpDialog(false);
    toast.success(`${server.name} added`);
  };

  const handleUpdateToolPermission = (integrationId: string, toolId: string, permission: ToolPermission) => {
    setIntegrations((prev) =>
      prev.map((int) =>
        int.id === integrationId
          ? { ...int, tools: int.tools.map((t) => (t.id === toolId ? { ...t, permission } : t)) }
          : int,
      ),
    );
  };

  const handleBulkUpdatePermission = (
    integrationId: string,
    category: "read" | "write",
    permission: ToolPermission,
  ) => {
    setIntegrations((prev) =>
      prev.map((int) =>
        int.id === integrationId
          ? { ...int, tools: int.tools.map((t) => (t.category === category ? { ...t, permission } : t)) }
          : int,
      ),
    );
  };

  const handleUpdateMcp = (id: string, updates: Partial<McpServer>) => {
    setMcpServers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    setEditingMcp(null);
    toast.success("MCP server updated");
  };

  const handleRemoveMcp = (id: string) => {
    setMcpServers((prev) => prev.filter((s) => s.id !== id));
    setRemovingMcp(null);
    toast.success("MCP server removed");
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-xl font-bold">Connections</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage MCP servers and per-user integrations</p>

      <div className="mt-6 space-y-8">
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Integration provider CTA or integrations list */}
            {!provider ? (
              <IntegrationProviderBanner onConnect={() => setShowConnectProviderDialog("canvas")} />
            ) : (
              <IntegrationsList
                integrations={integrations}
                provider={provider}
                onManage={setManagingIntegration}
                onAdd={() => setShowAddIntegrationDialog(true)}
              />
            )}

            {/* MCP Servers */}
            <McpServersList
              servers={mcpServers}
              onAdd={() => setShowAddMcpDialog(true)}
              onEdit={setEditingMcp}
              onRemove={setRemovingMcp}
            />
          </>
        )}
      </div>

      {/* Dialogs */}
      <ConnectProviderDialog
        type={showConnectProviderDialog}
        onOpenChange={(open) => !open && setShowConnectProviderDialog(null)}
        onConnected={handleProviderConnected}
      />

      <AddMcpDialog open={showAddMcpDialog} onOpenChange={setShowAddMcpDialog} onAdd={handleAddMcp} />

      <EditMcpDialog
        server={editingMcp}
        onOpenChange={(open) => !open && setEditingMcp(null)}
        onSave={handleUpdateMcp}
      />

      <RemoveMcpDialog
        server={removingMcp}
        onOpenChange={(open) => !open && setRemovingMcp(null)}
        onRemove={handleRemoveMcp}
      />

      <ManageIntegrationDialog
        integration={managingIntegration}
        onOpenChange={(open) => !open && setManagingIntegration(null)}
        onUpdateToolPermission={handleUpdateToolPermission}
        onBulkUpdatePermission={handleBulkUpdatePermission}
      />

      <AddIntegrationDialog
        open={showAddIntegrationDialog}
        onOpenChange={setShowAddIntegrationDialog}
        alreadyAdded={alreadyAddedServices}
        onConnect={handleAddIntegration}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integration Provider Banner (empty state) — delegates to ConnectionsBanner
// ---------------------------------------------------------------------------

function IntegrationProviderBanner({ onConnect }: { onConnect: () => void }) {
  return <ConnectionsBanner onConnect={onConnect} />;
}

// ---------------------------------------------------------------------------
// Integrations List
// ---------------------------------------------------------------------------

function IntegrationsList({
  integrations,
  provider,
  onManage,
  onAdd,
}: {
  integrations: Integration[];
  provider: NonNullable<IntegrationProvider>;
  onManage: (integration: Integration) => void;
  onAdd: () => void;
}) {
  const providerLabel = provider.type === "canvas" ? "Canvas" : "Composio";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">Integrations</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            via {providerLabel}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <PlusIcon size={14} weight="bold" />
          Add integration
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {integrations.map((integration, i) => (
          <IntegrationRow
            key={integration.id}
            integration={integration}
            isLast={i === integrations.length - 1}
            onManage={() => onManage(integration)}
          />
        ))}
      </div>
    </div>
  );
}

function IntegrationRow({
  integration,
  isLast,
  onManage,
}: {
  integration: Integration;
  isLast: boolean;
  onManage: () => void;
}) {
  const isConnected = integration.myStatus === "connected";

  return (
    <div className={`flex items-center gap-4 px-4 py-4 ${isLast ? "" : "border-b border-border"}`}>
      {/* Service icon placeholder + name */}
      <div className="flex size-9 items-center justify-center rounded-full bg-muted">
        <LinkSimpleIcon size={16} className="text-muted-foreground" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{integration.service}</span>
        <span className="text-xs text-muted-foreground">{integration.description}</span>
      </div>

      {/* Personal status */}
      {isConnected ? (
        <div className="flex items-center gap-1.5">
          <CheckIcon size={14} className="text-success" />
          <span className="text-xs text-muted-foreground">Connected</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <CircleDashedIcon size={14} className="text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">Not connected</span>
        </div>
      )}

      {/* Team adoption (admin only — will be conditionally rendered later) */}
      <span className="w-16 text-right text-xs text-muted-foreground">
        {integration.connectedUsers}/{integration.totalUsers} users
      </span>

      {/* Action */}
      {isConnected ? (
        <Button variant="ghost" size="sm" className="text-xs" onClick={onManage}>
          Manage
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="text-xs">
          Connect
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCP Servers List
// ---------------------------------------------------------------------------

function McpServersList({
  servers,
  onAdd,
  onEdit,
  onRemove,
}: {
  servers: McpServer[];
  onAdd: () => void;
  onEdit: (server: McpServer) => void;
  onRemove: (server: McpServer) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">MCP Servers</p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 transition-colors"
          style={{
            background: "transparent",
            border: "1px solid rgba(107, 125, 250, 0.4)",
            color: "#a5b0ff",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(107, 125, 250, 0.7)";
            e.currentTarget.style.background = "rgba(107, 125, 250, 0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(107, 125, 250, 0.4)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <PlusIcon size={14} weight="bold" />
          New server
        </button>
      </div>

      {servers.length === 0 ? (
        <McpEmptyState onAdd={onAdd} />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {servers.map((server, i) => (
            <McpServerRow
              key={server.id}
              server={server}
              isLast={i === servers.length - 1}
              onEdit={() => onEdit(server)}
              onRemove={() => onRemove(server)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function McpServerRow({
  server,
  isLast,
  onEdit,
  onRemove,
}: {
  server: McpServer;
  isLast: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`flex items-center gap-4 px-4 py-4 ${isLast ? "" : "border-b border-border"}`}>
      <div className="flex size-9 items-center justify-center rounded-full bg-muted">
        <GearIcon size={16} className="text-muted-foreground" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{server.name}</span>
        <span className="truncate text-xs text-muted-foreground font-mono">{server.url}</span>
      </div>

      <span className="text-xs text-muted-foreground">{server.toolCount} tools</span>

      <StatusDot status={server.status} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <DotsThreeIcon size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <PencilSimpleIcon size={14} className="mr-2" />
            Configure
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={onRemove}>
            <TrashIcon size={14} className="mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function StatusDot({ status }: { status: McpServer["status"] }) {
  const color = status === "active" ? "bg-success" : status === "error" ? "bg-destructive" : "bg-warning";
  const label = status === "active" ? "Active" : status === "error" ? "Error" : "Connecting";

  return (
    <div className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function McpEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <GearIcon size={24} className="text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">No MCP servers</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Add an MCP server to give the agent access to external tools.
      </p>
      <Button size="sm" className="mt-4" onClick={onAdd}>
        <PlusIcon size={14} weight="bold" />
        Add MCP
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connect Provider Dialog (Canvas / Composio)
// ---------------------------------------------------------------------------

function ConnectProviderDialog({
  type,
  onOpenChange,
  onConnected,
}: {
  type: "canvas" | "composio" | null;
  onOpenChange: (open: boolean) => void;
  onConnected: (type: "canvas" | "composio") => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const label = type === "canvas" ? "Canvas" : "Composio";

  const handleConnect = async () => {
    if (!type || !apiKey.trim()) return;
    setIsConnecting(true);
    // Simulate API call — will be replaced with real backend
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsConnecting(false);
    setApiKey("");
    onConnected(type);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setApiKey("");
      setIsConnecting(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={type !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {label}</DialogTitle>
          <DialogDescription>
            {label} provides per-user OAuth for 2,700+ services. Each team member connects their own accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider-api-key">API Key</Label>
            <Input
              id="provider-api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={type === "canvas" ? "cvs_..." : "cmp_..."}
              disabled={isConnecting}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isConnecting}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleConnect} disabled={!apiKey.trim() || isConnecting}>
            {isConnecting ? (
              <>
                <SpinnerGapIcon size={14} className="animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Add MCP Dialog
// ---------------------------------------------------------------------------

function AddMcpDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (server: Omit<McpServer, "id" | "status" | "toolCount" | "isIntegrationProvider">) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const resetAndClose = () => {
    setName("");
    setUrl("");
    setOauthClientId("");
    setOauthClientSecret("");
    setShowAdvanced(false);
    setIsAdding(false);
    onOpenChange(false);
  };

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    setIsAdding(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsAdding(false);
    onAdd({
      name: name.trim(),
      url: url.trim(),
      ...(oauthClientId.trim() && { oauthClientId: oauthClientId.trim() }),
      ...(oauthClientSecret.trim() && { oauthClientSecret: oauthClientSecret.trim() }),
    });
    resetAndClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>Connect an MCP server to give the agent access to its tools.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="mcp-name">Name</Label>
            <Input
              id="mcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GitHub, Sentry, Internal Tools"
              disabled={isAdding}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mcp-url">Remote MCP server URL</Label>
            <Input
              id="mcp-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com/sse"
              disabled={isAdding}
              className="font-mono text-xs"
            />
          </div>

          {/* Collapsible advanced settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <CaretIcon direction={showAdvanced ? "up" : "down"} />
              Advanced settings
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mcp-oauth-id">OAuth Client ID (optional)</Label>
                  <Input
                    id="mcp-oauth-id"
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    disabled={isAdding}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mcp-oauth-secret">OAuth Client Secret (optional)</Label>
                  <Input
                    id="mcp-oauth-secret"
                    type="password"
                    value={oauthClientSecret}
                    onChange={(e) => setOauthClientSecret(e.target.value)}
                    disabled={isAdding}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isAdding}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleAdd} disabled={!name.trim() || !url.trim() || isAdding}>
            {isAdding ? (
              <>
                <SpinnerGapIcon size={14} className="animate-spin" />
                Adding...
              </>
            ) : (
              "Add"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit MCP Dialog
// ---------------------------------------------------------------------------

function EditMcpDialog({
  server,
  onOpenChange,
  onSave,
}: {
  server: McpServer | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<McpServer>) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when server changes
  const [lastServerId, setLastServerId] = useState<string | null>(null);
  if (server && server.id !== lastServerId) {
    setName(server.name);
    setUrl(server.url);
    setOauthClientId(server.oauthClientId ?? "");
    setOauthClientSecret(server.oauthClientSecret ?? "");
    setShowAdvanced(!!(server.oauthClientId || server.oauthClientSecret));
    setLastServerId(server.id);
  }
  if (!server && lastServerId) {
    setLastServerId(null);
  }

  const handleSave = async () => {
    if (!server || !name.trim() || !url.trim()) return;
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSaving(false);
    onSave(server.id, {
      name: name.trim(),
      url: url.trim(),
      ...(oauthClientId.trim() ? { oauthClientId: oauthClientId.trim() } : { oauthClientId: undefined }),
      ...(oauthClientSecret.trim()
        ? { oauthClientSecret: oauthClientSecret.trim() }
        : { oauthClientSecret: undefined }),
    });
  };

  const isDirty =
    server &&
    (name.trim() !== server.name ||
      url.trim() !== server.url ||
      oauthClientId.trim() !== (server.oauthClientId ?? "") ||
      oauthClientSecret.trim() !== (server.oauthClientSecret ?? ""));

  return (
    <Dialog open={!!server} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure MCP Server</DialogTitle>
          <DialogDescription>Update the server connection settings.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-mcp-name">Name</Label>
            <Input id="edit-mcp-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-mcp-url">Remote MCP server URL</Label>
            <Input
              id="edit-mcp-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isSaving}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <CaretIcon direction={showAdvanced ? "up" : "down"} />
              Advanced settings
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-mcp-oauth-id">OAuth Client ID (optional)</Label>
                  <Input
                    id="edit-mcp-oauth-id"
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    disabled={isSaving}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-mcp-oauth-secret">OAuth Client Secret (optional)</Label>
                  <Input
                    id="edit-mcp-oauth-secret"
                    type="password"
                    value={oauthClientSecret}
                    onChange={(e) => setOauthClientSecret(e.target.value)}
                    disabled={isSaving}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!isDirty || !name.trim() || !url.trim() || isSaving}>
            {isSaving ? (
              <>
                <SpinnerGapIcon size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Remove MCP Dialog
// ---------------------------------------------------------------------------

function RemoveMcpDialog({
  server,
  onOpenChange,
  onRemove,
}: {
  server: McpServer | null;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <AlertDialog open={!!server} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {server?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will disconnect the MCP server. The agent will lose access to its {server?.toolCount} tools.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => server && onRemove(server.id)}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Caret icon for collapsible sections
// ---------------------------------------------------------------------------

function CaretIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={`transition-transform ${direction === "up" ? "rotate-0" : "rotate-180"}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 7.5L6 4L9.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tool permission toggle — 3-state: always_allow / needs_approval / never
// ---------------------------------------------------------------------------

const PERMISSION_OPTIONS: { value: ToolPermission; label: string; icon: React.ReactNode }[] = [
  {
    value: "always_allow",
    label: "Always allow",
    icon: <CheckIcon size={14} weight="bold" />,
  },
  {
    value: "needs_approval",
    label: "Needs approval",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M7 1.75v3.5M5.25 3.5h3.5M3.5 6.125v5.25A1.125 1.125 0 004.625 12.5h4.75a1.125 1.125 0 001.125-1.125v-5.25"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    value: "never",
    label: "Never",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
        <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
];

function PermissionToggle({
  value,
  onChange,
}: {
  value: ToolPermission;
  onChange: (p: ToolPermission) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
      {PERMISSION_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            onClick={() => onChange(opt.value)}
            className={`flex size-7 items-center justify-center rounded transition-colors ${
              isActive
                ? opt.value === "always_allow"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : opt.value === "needs_approval"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                    : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            }`}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk permission dropdown for a tool category
// ---------------------------------------------------------------------------

function BulkPermissionDropdown({
  category,
  toolCount,
  currentPermission,
  onChange,
}: {
  category: "read" | "write";
  toolCount: number;
  currentPermission: ToolPermission | "mixed";
  onChange: (p: ToolPermission) => void;
}) {
  const label =
    currentPermission === "always_allow"
      ? "Always allow"
      : currentPermission === "needs_approval"
        ? "Needs approval"
        : currentPermission === "never"
          ? "Never"
          : "Mixed";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {currentPermission === "always_allow" && <CheckIcon size={12} weight="bold" className="text-emerald-600" />}
          {currentPermission === "needs_approval" && (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-amber-600" aria-hidden="true">
              <path
                d="M7 1.75v3.5M5.25 3.5h3.5M3.5 6.125v5.25A1.125 1.125 0 004.625 12.5h4.75a1.125 1.125 0 001.125-1.125v-5.25"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {label}
          <CaretIcon direction="down" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange("always_allow")}>
          <CheckIcon size={14} className="mr-2 text-emerald-600" />
          Always allow
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("needs_approval")}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="mr-2 text-amber-600"
            aria-hidden="true"
          >
            <path
              d="M7 1.75v3.5M5.25 3.5h3.5M3.5 6.125v5.25A1.125 1.125 0 004.625 12.5h4.75a1.125 1.125 0 001.125-1.125v-5.25"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Needs approval
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("never")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-2 text-red-500" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Never
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Add Integration Dialog — search catalog + OAuth flow
// ---------------------------------------------------------------------------

type AddIntegrationStep =
  | { kind: "search" }
  | { kind: "oauth"; app: CatalogApp }
  | { kind: "connected"; app: CatalogApp };

function AddIntegrationDialog({
  open,
  onOpenChange,
  alreadyAdded,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alreadyAdded: Set<string>;
  onConnect: (app: CatalogApp) => void;
}) {
  const [step, setStep] = useState<AddIntegrationStep>({ kind: "search" });
  const [search, setSearch] = useState("");

  const resetAndClose = () => {
    setStep({ kind: "search" });
    setSearch("");
    onOpenChange(false);
  };

  const filteredCatalog = CATALOG.filter((app) => {
    if (alreadyAdded.has(app.name)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      app.name.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q) ||
      app.category.toLowerCase().includes(q)
    );
  });

  const categories = [...new Set(filteredCatalog.map((a) => a.category))];

  const handleStartOAuth = (app: CatalogApp) => {
    setStep({ kind: "oauth", app });
    // Simulate OAuth redirect delay
    setTimeout(() => {
      setStep({ kind: "connected", app });
    }, 2500);
  };

  const handleFinish = () => {
    if (step.kind === "connected") {
      onConnect(step.app);
    }
    resetAndClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {step.kind === "search" && (
          <>
            <DialogHeader>
              <DialogTitle>Add integration</DialogTitle>
              <DialogDescription>Search from 2,700+ apps available via Canvas.</DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search apps…" autoFocus />
            </div>

            <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6">
              {filteredCatalog.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <p className="text-sm text-muted-foreground">No matching apps found</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">Try a different search term</p>
                </div>
              ) : (
                categories.map((category) => (
                  <div key={category} className="mb-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                      {category}
                    </p>
                    <div className="space-y-1">
                      {filteredCatalog
                        .filter((a) => a.category === category)
                        .map((app) => (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => handleStartOAuth(app)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                              {app.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{app.name}</p>
                              <p className="text-xs text-muted-foreground">{app.description}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{app.defaultTools.length} tools</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}

        {step.kind === "oauth" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground">
                  {step.app.icon}
                </div>
                Connecting {step.app.name}
              </DialogTitle>
              <DialogDescription>Authorizing via OAuth — this would normally open a popup.</DialogDescription>
            </DialogHeader>

            <div className="py-6">
              {/* Simulated OAuth screen */}
              <div className="rounded-lg border border-border bg-muted/30 p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-14 items-center justify-center rounded-xl bg-muted text-lg font-bold text-muted-foreground">
                    {step.app.icon}
                  </div>
                  <p className="mt-4 text-sm font-medium">Authorize Sketch to access {step.app.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This will grant read and write access to your {step.app.name} account.
                  </p>
                  <div className="mt-5 flex items-center gap-2">
                    <SpinnerGapIcon size={16} className="animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Waiting for authorization…</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {step.kind === "connected" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <CheckIcon size={16} weight="bold" className="text-emerald-600" />
                </div>
                {step.app.name} connected
              </DialogTitle>
              <DialogDescription>
                {step.app.defaultTools.length} tools are now available. You can configure permissions from the Manage
                view.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Available tools</p>
                <div className="flex flex-wrap gap-1.5">
                  {step.app.defaultTools.map((tool) => (
                    <span
                      key={tool.id}
                      className="rounded-md bg-muted px-2 py-1 text-xs font-mono text-muted-foreground"
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleFinish}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Manage Integration Dialog — per-tool permission management
// ---------------------------------------------------------------------------

function ManageIntegrationDialog({
  integration,
  onOpenChange,
  onUpdateToolPermission,
  onBulkUpdatePermission,
}: {
  integration: Integration | null;
  onOpenChange: (open: boolean) => void;
  onUpdateToolPermission: (integrationId: string, toolId: string, permission: ToolPermission) => void;
  onBulkUpdatePermission: (integrationId: string, category: "read" | "write", permission: ToolPermission) => void;
}) {
  if (!integration) return null;

  const readTools = integration.tools.filter((t) => t.category === "read");
  const writeTools = integration.tools.filter((t) => t.category === "write");

  const getBulkPermission = (tools: IntegrationTool[]): ToolPermission | "mixed" => {
    if (tools.length === 0) return "always_allow";
    const first = tools[0].permission;
    return tools.every((t) => t.permission === first) ? first : "mixed";
  };

  return (
    <Dialog open={!!integration} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-muted">
              <LinkSimpleIcon size={14} className="text-muted-foreground" />
            </div>
            {integration.service}
          </DialogTitle>
          <DialogDescription>Choose when the agent is allowed to use these tools.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-2">
          {/* Read-only tools */}
          {readTools.length > 0 && (
            <ToolCategorySection
              label="Read-only tools"
              tools={readTools}
              bulkPermission={getBulkPermission(readTools)}
              onBulkChange={(p) => onBulkUpdatePermission(integration.id, "read", p)}
              onToolChange={(toolId, p) => onUpdateToolPermission(integration.id, toolId, p)}
            />
          )}

          {/* Write/delete tools */}
          {writeTools.length > 0 && (
            <ToolCategorySection
              label="Write/delete tools"
              tools={writeTools}
              bulkPermission={getBulkPermission(writeTools)}
              onBulkChange={(p) => onBulkUpdatePermission(integration.id, "write", p)}
              onToolChange={(toolId, p) => onUpdateToolPermission(integration.id, toolId, p)}
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolCategorySection({
  label,
  tools,
  bulkPermission,
  onBulkChange,
  onToolChange,
}: {
  label: string;
  tools: IntegrationTool[];
  bulkPermission: ToolPermission | "mixed";
  onBulkChange: (p: ToolPermission) => void;
  onToolChange: (toolId: string, p: ToolPermission) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      {/* Category header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
        >
          <CaretIcon direction={collapsed ? "down" : "up"} />
          {label}
          <span className="text-xs font-normal text-muted-foreground">{tools.length}</span>
        </button>
        <BulkPermissionDropdown
          category={tools[0]?.category ?? "read"}
          toolCount={tools.length}
          currentPermission={bulkPermission}
          onChange={onBulkChange}
        />
      </div>

      {/* Tool rows */}
      {!collapsed && (
        <div className="mt-2 rounded-lg border border-border bg-card">
          {tools.map((tool, i) => (
            <div
              key={tool.id}
              className={`flex items-center justify-between px-4 py-3 ${i < tools.length - 1 ? "border-b border-border" : ""}`}
            >
              <span className="text-sm font-mono text-muted-foreground">{tool.name}</span>
              <PermissionToggle value={tool.permission} onChange={(p) => onToolChange(tool.id, p)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="rounded-lg border border-border bg-card">
          {[1, 2].map((i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-4 ${i < 2 ? "border-b border-border" : ""}`}>
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
