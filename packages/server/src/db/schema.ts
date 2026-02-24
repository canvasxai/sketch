import type { Generated } from "kysely";

export interface UsersTable {
	id: string;
	name: string;
	email: string | null;
	slack_user_id: string | null;
	whatsapp_number: string | null;
	created_at: Generated<string>;
}

export interface ChannelsTable {
	id: string;
	slack_channel_id: string;
	name: string;
	type: string;
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

export interface DB {
	users: UsersTable;
	channels: ChannelsTable;
	whatsapp_creds: WhatsAppCredsTable;
	whatsapp_keys: WhatsAppKeysTable;
}
