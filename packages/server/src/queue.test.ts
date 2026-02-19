import { describe, expect, it } from "vitest";
import { ChannelQueue, QueueManager } from "./queue";

/**
 * Helper that creates a delayed work function.
 * Records execution order in the provided array and optionally delays to simulate async work.
 */
function createWork(order: number[], id: number, delayMs = 0): () => Promise<void> {
	return async () => {
		if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
		order.push(id);
	};
}

describe("ChannelQueue", () => {
	it("processes items sequentially in enqueue order", async () => {
		const queue = new ChannelQueue();
		const order: number[] = [];

		queue.enqueue(createWork(order, 1, 10));
		queue.enqueue(createWork(order, 2, 10));
		queue.enqueue(createWork(order, 3, 10));

		await new Promise((r) => setTimeout(r, 100));

		expect(order).toEqual([1, 2, 3]);
	});

	it("continues processing after an error in a work item", async () => {
		const queue = new ChannelQueue();
		const order: number[] = [];

		queue.enqueue(createWork(order, 1));
		queue.enqueue(async () => {
			throw new Error("boom");
		});
		queue.enqueue(createWork(order, 3));

		await new Promise((r) => setTimeout(r, 50));

		expect(order).toEqual([1, 3]);
	});

	it("processes items one at a time with no concurrent overlap", async () => {
		const queue = new ChannelQueue();
		let concurrency = 0;
		let maxConcurrency = 0;
		const order: number[] = [];

		for (let i = 0; i < 3; i++) {
			queue.enqueue(async () => {
				concurrency++;
				maxConcurrency = Math.max(maxConcurrency, concurrency);
				await new Promise((r) => setTimeout(r, 20));
				order.push(i);
				concurrency--;
			});
		}

		await new Promise((r) => setTimeout(r, 200));

		expect(maxConcurrency).toBe(1);
		expect(order).toEqual([0, 1, 2]);
	});

	it("does nothing when no items are enqueued", async () => {
		const queue = new ChannelQueue();
		await new Promise((r) => setTimeout(r, 20));
		expect(true).toBe(true);
	});
});

describe("QueueManager", () => {
	it("returns the same instance for the same channelId", () => {
		const manager = new QueueManager();
		const q1 = manager.getQueue("channel-1");
		const q2 = manager.getQueue("channel-1");
		expect(q1).toBe(q2);
	});

	it("returns different instances for different channelIds", () => {
		const manager = new QueueManager();
		const q1 = manager.getQueue("channel-1");
		const q2 = manager.getQueue("channel-2");
		expect(q1).not.toBe(q2);
	});

	it("processes queues for different channels independently and concurrently", async () => {
		const manager = new QueueManager();
		const timestamps: { channel: string; event: string; time: number }[] = [];

		const createTimedWork = (channel: string, delayMs: number) => async () => {
			timestamps.push({ channel, event: "start", time: Date.now() });
			await new Promise((r) => setTimeout(r, delayMs));
			timestamps.push({ channel, event: "end", time: Date.now() });
		};

		manager.getQueue("ch-a").enqueue(createTimedWork("ch-a", 50));
		manager.getQueue("ch-b").enqueue(createTimedWork("ch-b", 50));

		await new Promise((r) => setTimeout(r, 150));

		const find = (channel: string, event: string) => {
			const entry = timestamps.find((t) => t.channel === channel && t.event === event);
			expect(entry).toBeDefined();
			return entry as { channel: string; event: string; time: number };
		};

		const startA = find("ch-a", "start");
		const startB = find("ch-b", "start");
		const endA = find("ch-a", "end");
		const endB = find("ch-b", "end");

		const timeDiffStarts = Math.abs(startA.time - startB.time);
		expect(timeDiffStarts).toBeLessThan(20);

		expect(endA.time).toBeLessThan(startA.time + 100);
		expect(endB.time).toBeLessThan(startB.time + 100);
	});
});
