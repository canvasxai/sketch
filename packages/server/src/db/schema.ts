import type { Generated } from "kysely";

export interface UsersTable {
  id: string;
  name: string;
  email: string | null;
  slack_user_id: string | null;
  whatsapp_number: string | null;
  allowed_skills: string | null;
  created_at: Generated<string>;
}

export interface SlackChannelsTable {
  id: string;
  slack_channel_id: string;
  name: string;
  type: string;
  allowed_skills: string | null;
  created_at: Generated<string>;
}

export interface WhatsAppCredsTable {
  id: string;
  creds: string;
  updated_at: Generated<string>;
}

export interface WhatsAppKeysTable {
  type: string;
  key_id: string;
  value: string;
}

export interface SettingsTable {
  id: string;
  admin_email: string | null;
  admin_password_hash: string | null;
  org_name: string | null;
  bot_name: Generated<string>;
  slack_bot_token: string | null;
  slack_app_token: string | null;
  llm_provider: string | null;
  anthropic_api_key: string | null;
  aws_access_key_id: string | null;
  aws_secret_access_key: string | null;
  aws_region: string | null;
  jwt_secret: string | null;
  onboarding_completed_at: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface WaGroupsTable {
  id: string;
  group_jid: string;
  name: string;
  allowed_skills: string | null;
  created_at: Generated<string>;
}

export interface DB {
  users: UsersTable;
  slack_channels: SlackChannelsTable;
  wa_groups: WaGroupsTable;
  whatsapp_creds: WhatsAppCredsTable;
  whatsapp_keys: WhatsAppKeysTable;
  settings: SettingsTable;
}
