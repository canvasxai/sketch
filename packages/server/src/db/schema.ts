import type { Generated } from "kysely";

export interface UsersTable {
	id: string;
	name: string;
	email: string | null;
	slack_user_id: string | null;
	whatsapp_number: string | null;
	created_at: Generated<string>;
}

export interface DB {
	users: UsersTable;
}
