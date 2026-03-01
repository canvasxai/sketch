import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw";

// EventSource is not available in jsdom — provide a no-op stub so components
// that use SSE (e.g. WhatsAppQR) don't crash when rendered in tests.
if (typeof globalThis.EventSource === "undefined") {
	globalThis.EventSource = class EventSource extends EventTarget {
		static readonly CONNECTING = 0;
		static readonly OPEN = 1;
		static readonly CLOSED = 2;
		readonly CONNECTING = 0;
		readonly OPEN = 1;
		readonly CLOSED = 2;
		readyState = 0;
		url: string;
		withCredentials = false;
		onopen: ((this: EventSource, ev: Event) => void) | null = null;
		onmessage: ((this: EventSource, ev: MessageEvent) => void) | null = null;
		onerror: ((this: EventSource, ev: Event) => void) | null = null;
		constructor(url: string | URL) {
			super();
			this.url = typeof url === "string" ? url : url.toString();
		}
		close() {
			this.readyState = 2;
		}
	} as unknown as typeof EventSource;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	cleanup();
	server.resetHandlers();
});
afterAll(() => server.close());
