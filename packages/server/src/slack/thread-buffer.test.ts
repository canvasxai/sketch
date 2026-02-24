import { describe, expect, it } from "vitest";
import { ThreadBuffer } from "./thread-buffer";

describe("ThreadBuffer", () => {
	describe("register and hasThread", () => {
		it("hasThread returns false for unregistered thread", () => {
			const buf = new ThreadBuffer();
			expect(buf.hasThread("C001", "1111.0000")).toBe(false);
		});

		it("hasThread returns true after register", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			expect(buf.hasThread("C001", "1111.0000")).toBe(true);
		});

		it("register is idempotent — does not reset existing buffer", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			buf.append("C001", "1111.0000", { userName: "Alice", text: "hello", ts: "1111.0001" });
			buf.register("C001", "1111.0000");
			const drained = buf.drain("C001", "1111.0000");
			expect(drained).toHaveLength(1);
		});
	});

	describe("append", () => {
		it("no-op on unregistered thread", () => {
			const buf = new ThreadBuffer();
			buf.append("C001", "1111.0000", { userName: "Alice", text: "hello", ts: "1111.0001" });
			expect(buf.hasThread("C001", "1111.0000")).toBe(false);
		});

		it("adds messages to a registered thread", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			buf.append("C001", "1111.0000", { userName: "Alice", text: "hello", ts: "1111.0001" });
			buf.append("C001", "1111.0000", { userName: "Bob", text: "world", ts: "1111.0002" });
			const drained = buf.drain("C001", "1111.0000");
			expect(drained).toHaveLength(2);
			expect(drained[0].userName).toBe("Alice");
			expect(drained[1].userName).toBe("Bob");
		});

		it("buffers messages with attachments", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			buf.append("C001", "1111.0000", {
				userName: "Alice",
				text: "check this",
				ts: "1111.0001",
				attachments: [
					{
						originalName: "report.pdf",
						mimeType: "application/pdf",
						localPath: "/ws/attachments/report.pdf",
						sizeBytes: 1024,
					},
				],
			});
			const drained = buf.drain("C001", "1111.0000");
			expect(drained[0].attachments).toHaveLength(1);
			expect(drained[0].attachments?.[0].originalName).toBe("report.pdf");
		});
	});

	describe("drain", () => {
		it("returns empty array for unregistered thread", () => {
			const buf = new ThreadBuffer();
			expect(buf.drain("C001", "1111.0000")).toEqual([]);
		});

		it("returns empty array for registered thread with no messages", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			expect(buf.drain("C001", "1111.0000")).toEqual([]);
		});

		it("returns messages in order and clears buffer", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			buf.append("C001", "1111.0000", { userName: "Alice", text: "first", ts: "1111.0001" });
			buf.append("C001", "1111.0000", { userName: "Bob", text: "second", ts: "1111.0002" });

			const first = buf.drain("C001", "1111.0000");
			expect(first).toHaveLength(2);
			expect(first[0].text).toBe("first");

			const second = buf.drain("C001", "1111.0000");
			expect(second).toHaveLength(0);
		});

		it("thread stays registered after drain", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			buf.append("C001", "1111.0000", { userName: "Alice", text: "hello", ts: "1111.0001" });
			buf.drain("C001", "1111.0000");
			expect(buf.hasThread("C001", "1111.0000")).toBe(true);
		});

		it("new messages after drain are captured", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			buf.append("C001", "1111.0000", { userName: "Alice", text: "before", ts: "1111.0001" });
			buf.drain("C001", "1111.0000");
			buf.append("C001", "1111.0000", { userName: "Bob", text: "after", ts: "1111.0002" });
			const drained = buf.drain("C001", "1111.0000");
			expect(drained).toHaveLength(1);
			expect(drained[0].text).toBe("after");
		});
	});

	describe("thread isolation", () => {
		it("different threads in same channel are independent", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			buf.register("C001", "2222.0000");
			buf.append("C001", "1111.0000", { userName: "Alice", text: "thread1", ts: "1111.0001" });
			buf.append("C001", "2222.0000", { userName: "Bob", text: "thread2", ts: "2222.0001" });

			const t1 = buf.drain("C001", "1111.0000");
			const t2 = buf.drain("C001", "2222.0000");
			expect(t1).toHaveLength(1);
			expect(t1[0].text).toBe("thread1");
			expect(t2).toHaveLength(1);
			expect(t2[0].text).toBe("thread2");
		});

		it("same threadTs in different channels are independent", () => {
			const buf = new ThreadBuffer();
			buf.register("C001", "1111.0000");
			buf.register("C002", "1111.0000");
			buf.append("C001", "1111.0000", { userName: "Alice", text: "ch1", ts: "1111.0001" });
			buf.append("C002", "1111.0000", { userName: "Bob", text: "ch2", ts: "1111.0001" });

			const ch1 = buf.drain("C001", "1111.0000");
			const ch2 = buf.drain("C002", "1111.0000");
			expect(ch1[0].text).toBe("ch1");
			expect(ch2[0].text).toBe("ch2");
		});
	});
});
