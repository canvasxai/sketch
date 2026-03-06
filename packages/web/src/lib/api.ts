/**
 * Typed API client for the control plane backend.
 * All methods throw on non-2xx responses with the standard error shape.
 */

import type { SkillCategory } from "@/lib/skills-data";

export interface ApiError {
  error: { code: string; message: string };
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  slack_user_id: string | null;
  whatsapp_number: string | null;
  allowed_skills: string[] | null;
  created_at: string;
}

export interface SlackChannel {
  id: string;
  slack_channel_id: string;
  name: string;
  type: string;
  allowed_skills: string[] | null;
  created_at: string;
}

export interface WaGroup {
  id: string;
  group_jid: string;
  name: string;
  allowed_skills: string[] | null;
  created_at: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: { code: "UNKNOWN", message: res.statusText } }))) as ApiError;
    throw new Error(body.error.message);
  }

  return res.json() as Promise<T>;
}

export interface ChannelStatus {
  platform: "slack" | "whatsapp";
  configured: boolean;
  connected: boolean | null;
  phoneNumber: string | null;
}

export interface SetupStatus {
  completed: boolean;
  currentStep: number;
  adminEmail: string | null;
  orgName: string | null;
  botName: string;
  slackConnected: boolean;
  llmConnected: boolean;
  llmProvider: "anthropic" | "bedrock" | null;
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  body: string;
  org_enabled: boolean;
}

export const api = {
  setup: {
    status() {
      return request<SetupStatus>("/api/setup/status");
    },
    verifySlack(botToken: string, appToken: string) {
      return request<{ success: boolean; workspaceName?: string }>("/api/setup/slack/verify", {
        method: "POST",
        body: JSON.stringify({ botToken, appToken }),
      });
    },
    verifyLlm(
      data:
        | { provider: "anthropic"; apiKey: string }
        | { provider: "bedrock"; awsAccessKeyId: string; awsSecretAccessKey: string; awsRegion: string },
    ) {
      return request<{ success: boolean }>("/api/setup/llm/verify", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    createAccount(email: string, password: string) {
      return request<{ success: boolean }>("/api/setup/account", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    identity(orgName: string, botName: string) {
      return request<{ success: boolean }>("/api/setup/identity", {
        method: "POST",
        body: JSON.stringify({ orgName, botName }),
      });
    },
    slack(botToken: string, appToken: string) {
      return request<{ success: boolean }>("/api/setup/slack", {
        method: "POST",
        body: JSON.stringify({ botToken, appToken }),
      });
    },
    llm(
      data:
        | { provider: "anthropic"; apiKey: string }
        | { provider: "bedrock"; awsAccessKeyId: string; awsSecretAccessKey: string; awsRegion: string },
    ) {
      return request<{ success: boolean }>("/api/setup/llm", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    complete() {
      return request<{ success: boolean }>("/api/setup/complete", {
        method: "POST",
      });
    },
  },
  auth: {
    login(email: string, password: string) {
      return request<{ authenticated: boolean; email: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    logout() {
      return request<{ authenticated: boolean }>("/api/auth/logout", { method: "POST" });
    },
    session() {
      return request<{ authenticated: boolean; email?: string }>("/api/auth/session");
    },
  },
  channels: {
    status() {
      return request<{ channels: ChannelStatus[] }>("/api/channels/status");
    },
    disconnectSlack() {
      return request<{ success: boolean }>("/api/channels/slack", { method: "DELETE" });
    },
    listSlackChannels() {
      return request<{ channels: SlackChannel[] }>("/api/channels/slack/list");
    },
    updateSlackChannelSkills(id: string, allowedSkills: string[] | null) {
      return request<{ channel: SlackChannel }>(`/api/channels/slack/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ allowed_skills: allowedSkills }),
      });
    },
    listWaGroups() {
      return request<{ groups: WaGroup[] }>("/api/channels/whatsapp/groups");
    },
    updateWaGroupSkills(id: string, allowedSkills: string[] | null) {
      return request<{ group: WaGroup }>(`/api/channels/whatsapp/groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ allowed_skills: allowedSkills }),
      });
    },
  },
  whatsapp: {
    status() {
      return request<{ connected: boolean; phoneNumber: string | null }>("/api/channels/whatsapp");
    },
    cancelPairing() {
      return request<{ success: boolean }>("/api/channels/whatsapp/pair", { method: "DELETE" });
    },
    disconnect() {
      return request<{ success: boolean }>("/api/channels/whatsapp", { method: "DELETE" });
    },
  },
  settings: {
    identity() {
      return request<{ orgName: string | null; botName: string }>("/api/settings/identity");
    },
  },
  users: {
    list() {
      return request<{ users: User[] }>("/api/users");
    },
    create(data: { name: string; whatsappNumber: string }) {
      return request<{ user: User }>("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    update(id: string, data: { name?: string; whatsappNumber?: string | null }) {
      return request<{ user: User }>(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    remove(id: string) {
      return request<{ success: boolean }>(`/api/users/${id}`, {
        method: "DELETE",
      });
    },
    updateSkills(id: string, allowedSkills: string[] | null) {
      return request<{ user: User }>(`/api/users/${id}/skills`, {
        method: "PATCH",
        body: JSON.stringify({ allowed_skills: allowedSkills }),
      });
    },
  },
  skills: {
    list() {
      return request<{ skills: SkillRecord[] }>("/api/skills");
    },
    get(id: string) {
      return request<{ skill: SkillRecord }>(`/api/skills/${id}`);
    },
    create(data: {
      name: string;
      description: string;
      category: SkillRecord["category"];
      body: string;
      org_enabled?: boolean;
      id?: string;
    }) {
      return request<{ skill: SkillRecord }>("/api/skills", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    update(
      id: string,
      data: {
        name: string;
        description: string;
        category: SkillRecord["category"];
        body: string;
        org_enabled?: boolean;
      },
    ) {
      return request<{ skill: SkillRecord }>(`/api/skills/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    remove(id: string) {
      return request<{ success: true }>(`/api/skills/${id}`, { method: "DELETE" });
    },
    updatePermissions(
      id: string,
      data: {
        channels?: { id: string; enabled: boolean }[];
        users?: { id: string; enabled: boolean }[];
      },
    ) {
      return request<{ success: true }>(`/api/skills/${id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
  },
};
