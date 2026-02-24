/**
 * In-memory cache for Slack user info lookups.
 *
 * Eliminates N+1 getUserInfo API calls when resolving usernames for
 * thread history or buffered messages. Cache lives for the process lifetime —
 * user display names rarely change mid-session.
 */

export interface CachedUser {
	name: string;
	realName: string;
}

export class UserCache {
	private cache = new Map<string, CachedUser>();

	async resolve(userId: string, fetcher: (id: string) => Promise<CachedUser>): Promise<CachedUser> {
		const cached = this.cache.get(userId);
		if (cached) return cached;
		const user = await fetcher(userId);
		this.cache.set(userId, user);
		return user;
	}
}
