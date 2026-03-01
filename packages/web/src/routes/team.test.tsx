import { server } from "@/test/msw";
import { renderWithProviders } from "@/test/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { TeamPage } from "./team";

/**
 * TeamPage uses useRouteContext to get the admin email.
 * Mock the TanStack Router hook to provide it.
 */
vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		useRouteContext: () => ({ auth: { authenticated: true, email: "admin@test.com" } }),
	};
});

describe("TeamPage", () => {
	it("renders member list", async () => {
		renderWithProviders(<TeamPage />);

		await waitFor(() => {
			expect(screen.getByText("Alice Smith")).toBeInTheDocument();
		});
		expect(screen.getByText("Bob Jones")).toBeInTheDocument();
		expect(screen.getByText("Team members")).toBeInTheDocument();
	});

	it("shows empty state when no users", async () => {
		server.use(
			http.get("/api/users", () => {
				return HttpResponse.json({ users: [] });
			}),
		);
		renderWithProviders(<TeamPage />);

		await waitFor(() => {
			expect(screen.getByText("Your team's empty!")).toBeInTheDocument();
		});
	});

	it("shows loading skeleton initially", () => {
		renderWithProviders(<TeamPage />);
		const skeletons = document.querySelectorAll("[data-slot='skeleton']");
		expect(skeletons.length).toBeGreaterThan(0);
	});

	describe("Add member dialog", () => {
		it("opens when clicking Add member button", async () => {
			const user = userEvent.setup();
			renderWithProviders(<TeamPage />);

			await waitFor(() => {
				expect(screen.getByText("Alice Smith")).toBeInTheDocument();
			});

			await user.click(screen.getByRole("button", { name: /Add member/i }));

			await waitFor(() => {
				expect(screen.getByText("This person will be able to message the bot on WhatsApp.")).toBeInTheDocument();
			});
		});

		it("creates a user on submit", async () => {
			const createFn = vi.fn();
			server.use(
				http.post("/api/users", async ({ request }) => {
					const body = (await request.json()) as { name: string; whatsappNumber: string };
					createFn(body);
					return HttpResponse.json(
						{
							user: {
								id: "u-new",
								name: body.name,
								email: null,
								slack_user_id: null,
								whatsapp_number: body.whatsappNumber,
								created_at: new Date().toISOString(),
							},
						},
						{ status: 201 },
					);
				}),
			);

			const user = userEvent.setup();
			renderWithProviders(<TeamPage />);

			await waitFor(() => {
				expect(screen.getByText("Alice Smith")).toBeInTheDocument();
			});

			await user.click(screen.getByRole("button", { name: /Add member/i }));

			await waitFor(() => {
				expect(screen.getByLabelText("Name")).toBeInTheDocument();
			});

			await user.type(screen.getByLabelText("Name"), "Charlie");
			await user.type(screen.getByLabelText("WhatsApp number"), "+14155551234");
			await user.click(screen.getByRole("button", { name: "Add member" }));

			await waitFor(() => {
				expect(createFn).toHaveBeenCalledWith({ name: "Charlie", whatsappNumber: "+14155551234" });
			});
		});

		it("shows inline error on duplicate number", async () => {
			server.use(
				http.post("/api/users", () => {
					return HttpResponse.json(
						{ error: { code: "CONFLICT", message: "This number is already linked to another member" } },
						{ status: 409 },
					);
				}),
			);

			const user = userEvent.setup();
			renderWithProviders(<TeamPage />);

			await waitFor(() => {
				expect(screen.getByText("Alice Smith")).toBeInTheDocument();
			});

			await user.click(screen.getByRole("button", { name: /Add member/i }));

			await waitFor(() => {
				expect(screen.getByLabelText("Name")).toBeInTheDocument();
			});

			await user.type(screen.getByLabelText("Name"), "Dupe");
			await user.type(screen.getByLabelText("WhatsApp number"), "+919876543210");
			await user.click(screen.getByRole("button", { name: "Add member" }));

			await waitFor(() => {
				expect(screen.getByText("This number is already linked to another member")).toBeInTheDocument();
			});
		});
	});

	describe("Remove member dialog", () => {
		it("opens from overflow menu and removes on confirm", async () => {
			const removeFn = vi.fn();
			server.use(
				http.delete("/api/users/:id", () => {
					removeFn();
					return HttpResponse.json({ success: true });
				}),
			);

			const user = userEvent.setup();
			renderWithProviders(<TeamPage />);

			await waitFor(() => {
				expect(screen.getByText("Alice Smith")).toBeInTheDocument();
			});

			// Open overflow menu on a non-admin row
			const menuTriggers = screen.getAllByRole("button").filter((btn) => btn.querySelector("svg"));
			// The last overflow menu button (for one of the users)
			const overflowBtn = menuTriggers[menuTriggers.length - 1];
			await user.click(overflowBtn);

			await waitFor(() => {
				expect(screen.getByText("Remove member")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Remove member"));

			await waitFor(() => {
				expect(screen.getByText("Remove team member?")).toBeInTheDocument();
			});

			await user.click(screen.getByRole("button", { name: "Remove" }));

			await waitFor(() => {
				expect(removeFn).toHaveBeenCalled();
			});
		});
	});
});
