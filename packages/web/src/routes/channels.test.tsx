import { server } from "@/test/msw";
import { renderWithProviders } from "@/test/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ChannelsPage } from "./channels";

function channelsHandler(
	slack: { configured: boolean; connected: boolean | null },
	whatsapp: { configured: boolean; connected: boolean | null; phoneNumber?: string },
) {
	server.use(
		http.get("/api/channels/status", () => {
			return HttpResponse.json({
				channels: [
					{ platform: "slack", ...slack, phoneNumber: null },
					{ platform: "whatsapp", phoneNumber: null, ...whatsapp },
				],
			});
		}),
	);
}

describe("ChannelsPage", () => {
	it("renders both platform cards", async () => {
		renderWithProviders(<ChannelsPage />);

		await waitFor(() => {
			expect(screen.getByText("Slack")).toBeInTheDocument();
		});
		expect(screen.getByText("WhatsApp")).toBeInTheDocument();
	});

	describe("Slack card", () => {
		it("shows not-configured state with Connect button", async () => {
			channelsHandler({ configured: false, connected: null }, { configured: false, connected: null });
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText("Slack")).toBeInTheDocument();
			});

			expect(screen.getByText("Connect a Slack workspace to get started")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
		});

		it("shows connected state with green check", async () => {
			channelsHandler({ configured: true, connected: true }, { configured: false, connected: null });
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText("Slack")).toBeInTheDocument();
			});

			expect(screen.getByText("Connected")).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: "Connect" })).not.toBeInTheDocument();
		});
	});

	describe("WhatsApp card", () => {
		it("shows not-configured state with Pair button", async () => {
			channelsHandler({ configured: false, connected: null }, { configured: false, connected: null });
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText("WhatsApp")).toBeInTheDocument();
			});

			expect(screen.getByText("Pair a WhatsApp number to get started")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Pair" })).toBeInTheDocument();
		});

		it("shows disconnected state with warning", async () => {
			channelsHandler({ configured: false, connected: null }, { configured: true, connected: false });
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText("Disconnected")).toBeInTheDocument();
			});

			expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
		});

		it("shows connected state with phone number", async () => {
			channelsHandler(
				{ configured: false, connected: null },
				{ configured: true, connected: true, phoneNumber: "+1234567890" },
			);
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText(/Connected/)).toBeInTheDocument();
			});

			expect(screen.getByText(/\+1234567890/)).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: "Pair" })).not.toBeInTheDocument();
		});
	});

	describe("alert banner", () => {
		it("shows when both channels are not connected", async () => {
			channelsHandler({ configured: false, connected: null }, { configured: false, connected: null });
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText(/No channels connected/)).toBeInTheDocument();
			});
		});

		it("shows when slack not configured and whatsapp disconnected", async () => {
			channelsHandler({ configured: false, connected: null }, { configured: true, connected: false });
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText(/No channels connected/)).toBeInTheDocument();
			});
		});

		it("hidden when at least one channel is connected", async () => {
			channelsHandler({ configured: true, connected: true }, { configured: false, connected: null });
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText("Slack")).toBeInTheDocument();
			});

			expect(screen.queryByText(/No channels connected/)).not.toBeInTheDocument();
		});
	});

	describe("Slack connect dialog", () => {
		it("opens when clicking Connect and shows token inputs", async () => {
			channelsHandler({ configured: false, connected: null }, { configured: false, connected: null });

			const user = userEvent.setup();
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
			});

			await user.click(screen.getByRole("button", { name: "Connect" }));

			await waitFor(() => {
				expect(screen.getByText("Connect Slack")).toBeInTheDocument();
			});

			expect(screen.getByLabelText("Bot Token")).toBeInTheDocument();
			expect(screen.getByLabelText("App-Level Token")).toBeInTheDocument();
		});

		it("disables Connect button without both tokens filled", async () => {
			channelsHandler({ configured: false, connected: null }, { configured: false, connected: null });

			const user = userEvent.setup();
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
			});

			await user.click(screen.getByRole("button", { name: "Connect" }));

			await waitFor(() => {
				expect(screen.getByText("Connect Slack")).toBeInTheDocument();
			});

			// The Connect button inside the dialog (second one)
			const connectButtons = screen.getAllByRole("button", { name: "Connect" });
			const dialogConnectBtn = connectButtons[connectButtons.length - 1];
			expect(dialogConnectBtn).toBeDisabled();
		});
	});

	describe("Slack disconnect", () => {
		it("shows disconnect confirmation dialog from dropdown", async () => {
			channelsHandler({ configured: true, connected: true }, { configured: false, connected: null });

			const user = userEvent.setup();
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText("Connected")).toBeInTheDocument();
			});

			// Open the dropdown menu
			const menuTrigger = screen.getAllByRole("button").find((btn) => btn.querySelector("svg")) as HTMLElement;
			await user.click(menuTrigger);

			await waitFor(() => {
				expect(screen.getByText("Disconnect")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Disconnect"));

			await waitFor(() => {
				expect(screen.getByText("Disconnect Slack?")).toBeInTheDocument();
			});
		});

		it("calls disconnect API on confirm", async () => {
			const disconnectFn = vi.fn();
			server.use(
				http.delete("/api/channels/slack", () => {
					disconnectFn();
					return HttpResponse.json({ success: true });
				}),
			);
			channelsHandler({ configured: true, connected: true }, { configured: false, connected: null });

			const user = userEvent.setup();
			renderWithProviders(<ChannelsPage />);

			await waitFor(() => {
				expect(screen.getByText("Connected")).toBeInTheDocument();
			});

			// Open dropdown → click Disconnect
			const menuTrigger = screen.getAllByRole("button").find((btn) => btn.querySelector("svg")) as HTMLElement;
			await user.click(menuTrigger);
			await waitFor(() => {
				expect(screen.getByText("Disconnect")).toBeInTheDocument();
			});
			await user.click(screen.getByText("Disconnect"));

			// Confirm in dialog
			await waitFor(() => {
				expect(screen.getByText("Disconnect Slack?")).toBeInTheDocument();
			});
			await user.click(screen.getByRole("button", { name: "Disconnect" }));

			await waitFor(() => {
				expect(disconnectFn).toHaveBeenCalled();
			});
		});
	});
});
