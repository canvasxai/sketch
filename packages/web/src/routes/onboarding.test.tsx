import { server } from "@/test/msw";
import { renderWithProviders } from "@/test/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { CreateAccountStep } from "./onboarding";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return { ...actual, useNavigate: () => mockNavigate };
});

describe("CreateAccountStep", () => {
	it("renders email, password, and confirm password fields", () => {
		renderWithProviders(<CreateAccountStep />);

		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
		expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
	});

	it("shows validation error for empty email on submit", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep />);

		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByText("Email is required")).toBeInTheDocument();
	});

	it("shows validation error for invalid email format", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep />);

		// "user@domain" passes HTML5 type="email" constraint but fails our regex
		// which requires a dot in the domain part
		await user.type(screen.getByLabelText("Email"), "user@domain");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(screen.getByText("Invalid email format")).toBeInTheDocument();
	});

	it("shows validation error for short password", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "short");
		await user.type(screen.getByLabelText("Confirm password"), "short");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
	});

	it("shows validation error when passwords don't match", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "different123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
	});

	it("submits successfully with valid data", async () => {
		server.use(
			http.post("/api/setup/account", async ({ request }) => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				const body = (await request.json()) as { email?: string; password?: string };
				if (!body.email || !body.password) {
					return HttpResponse.json(
						{ error: { code: "BAD_REQUEST", message: "Email and password required" } },
						{ status: 400 },
					);
				}
				return HttpResponse.json({ success: true });
			}),
		);

		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await waitFor(() => {
			expect(screen.getByText("Creating account...")).toBeInTheDocument();
		});
	});

	it("shows API error on 409 conflict", async () => {
		server.use(
			http.post("/api/setup/account", () => {
				return HttpResponse.json(
					{ error: { code: "CONFLICT", message: "Admin account already exists" } },
					{ status: 409 },
				);
			}),
		);

		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await waitFor(() => {
			expect(screen.getByText("Admin account already exists")).toBeInTheDocument();
		});
	});

	it("disables submit button while request is in flight", async () => {
		server.use(
			http.post("/api/setup/account", async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				return HttpResponse.json({ success: true });
			}),
		);

		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await waitFor(() => {
			expect(screen.getByRole("button", { name: /Creating account/i })).toBeDisabled();
		});
	});

	it("shows info callout about saving credentials", () => {
		renderWithProviders(<CreateAccountStep />);
		expect(screen.getByText(/Save these credentials/)).toBeInTheDocument();
	});
});
