import { server } from "@/test/msw";
import { renderWithProviders } from "@/test/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateAccountStep, OnboardingPage } from "./onboarding";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
	mockNavigate.mockReset();
	window.sessionStorage.clear();
});

describe("CreateAccountStep", () => {
	it("renders email, password, and confirm password fields", () => {
		renderWithProviders(<CreateAccountStep onComplete={() => {}} />);

		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
		expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
	});

	it("shows validation error for empty email on submit", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep onComplete={() => {}} />);

		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByText("Email is required")).toBeInTheDocument();
	});

	it("shows validation error for invalid email format", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep onComplete={() => {}} />);

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
		renderWithProviders(<CreateAccountStep onComplete={() => {}} />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "short");
		await user.type(screen.getByLabelText("Confirm password"), "short");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
	});

	it("shows validation error when password is missing", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep onComplete={() => {}} />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(screen.getByText("Password is required")).toBeInTheDocument();
	});

	it("shows validation error when passwords don't match", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CreateAccountStep onComplete={() => {}} />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "different123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
	});

	it("prefills form from initialEmail and initialPassword props", () => {
		renderWithProviders(
			<CreateAccountStep initialEmail="prefill@test.com" initialPassword="password123" onComplete={() => {}} />,
		);

		expect(screen.getByLabelText("Email")).toHaveValue("prefill@test.com");
		expect(screen.getByLabelText("Password")).toHaveValue("password123");
		expect(screen.getByLabelText("Confirm password")).toHaveValue("");
	});

	it("uses prefilled values when submitting", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		renderWithProviders(
			<CreateAccountStep initialEmail="prefill@test.com" initialPassword="password123" onComplete={onComplete} />,
		);

		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await waitFor(() => {
			expect(onComplete).toHaveBeenCalledTimes(1);
		});
		expect(onComplete).toHaveBeenCalledWith({
			email: "prefill@test.com",
			password: "password123",
		});
	});

	it("calls onComplete with trimmed email and password for valid data", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		renderWithProviders(<CreateAccountStep onComplete={onComplete} />);

		await user.type(screen.getByLabelText("Email"), "  admin@test.com  ");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await waitFor(() => {
			expect(onComplete).toHaveBeenCalledTimes(1);
		});
		expect(onComplete).toHaveBeenCalledWith({
			email: "admin@test.com",
			password: "password123",
		});
	});

	it("does not call onComplete when validation fails", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		renderWithProviders(<CreateAccountStep onComplete={onComplete} />);

		await user.type(screen.getByLabelText("Email"), "not-an-email");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "different123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await waitFor(() => {
			expect(onComplete).not.toHaveBeenCalled();
		});
	});

	it("clears prior validation errors after correcting input", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		renderWithProviders(<CreateAccountStep onComplete={onComplete} />);

		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByText("Email is required")).toBeInTheDocument();
		expect(screen.getByText("Password is required")).toBeInTheDocument();

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await waitFor(() => {
			expect(onComplete).toHaveBeenCalledTimes(1);
		});
		expect(screen.queryByText("Email is required")).not.toBeInTheDocument();
		expect(screen.queryByText("Password is required")).not.toBeInTheDocument();
	});

	it("shows info callout about saving credentials", () => {
		renderWithProviders(<CreateAccountStep onComplete={() => {}} />);
		expect(screen.getByText(/Save these credentials/)).toBeInTheDocument();
	});
});

describe("OnboardingPage navigation and flow", () => {
	it("allows navigating back to Account step from progress indicator", async () => {
		server.use(
			http.post("/api/setup/slack/verify", () => {
				return HttpResponse.json({ success: true, workspaceName: "Test Workspace" });
			}),
		);

		const user = userEvent.setup();
		renderWithProviders(<OnboardingPage />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await user.type(screen.getByLabelText("Organization Name"), "Acme");
		await user.type(screen.getByLabelText("Bot Name"), "Sketch");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		await user.type(screen.getByLabelText("Bot Token"), "xoxb-test-bot-token");
		await user.type(screen.getByLabelText("App-Level Token"), "xapp-test-app-token");
		await user.click(screen.getByRole("button", { name: "Connect" }));

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByText("Connect your LLM")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Account" }));
		expect(screen.getByText("Create your admin account")).toBeInTheDocument();
	});

	it("restores onboarding step from draft after remount", async () => {
		const user = userEvent.setup();
		const { unmount } = renderWithProviders(<OnboardingPage />);

		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(screen.getByText("Set up your bot")).toBeInTheDocument();

		unmount();
		renderWithProviders(<OnboardingPage />);
		expect(screen.getByText("Set up your bot")).toBeInTheDocument();
	});

	it("finalizes setup in expected order and navigates to channels", async () => {
		const calls: string[] = [];
		server.use(
			http.get("/api/setup/status", () => {
				calls.push("status");
				return HttpResponse.json({ completed: false, currentStep: 0 });
			}),
			http.post("/api/setup/account", () => {
				calls.push("account");
				return HttpResponse.json({ success: true });
			}),
			http.post("/api/setup/identity", () => {
				calls.push("identity");
				return HttpResponse.json({ success: true });
			}),
			http.post("/api/setup/slack/verify", () => {
				return HttpResponse.json({ success: true, workspaceName: "Test Workspace" });
			}),
			http.post("/api/setup/slack", () => {
				calls.push("slack");
				return HttpResponse.json({ success: true });
			}),
			http.post("/api/setup/llm", () => {
				calls.push("llm");
				return HttpResponse.json({ success: true });
			}),
			http.post("/api/setup/complete", () => {
				calls.push("complete");
				return HttpResponse.json({ success: true });
			}),
			http.post("/api/auth/login", () => {
				calls.push("login");
				return HttpResponse.json({ authenticated: true, email: "admin@test.com" });
			}),
		);

		const user = userEvent.setup();
		renderWithProviders(<OnboardingPage />);

		// Step 1
		await user.type(screen.getByLabelText("Email"), "admin@test.com");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		// Step 2
		await user.type(screen.getByLabelText("Organization Name"), "Acme");
		await user.clear(screen.getByLabelText("Bot Name"));
		await user.type(screen.getByLabelText("Bot Name"), "Sketch");
		await user.click(screen.getByRole("button", { name: "Continue" }));

		// Step 3
		await user.type(screen.getByLabelText("Bot Token"), "xoxb-test-bot-token");
		await user.type(screen.getByLabelText("App-Level Token"), "xapp-test-app-token");
		await user.click(screen.getByRole("button", { name: "Connect" }));
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
		});
		await user.click(screen.getByRole("button", { name: "Continue" }));

		// Step 4
		await user.type(screen.getByLabelText("API Key"), "sk-ant-test-key");
		await user.click(screen.getByRole("button", { name: "Connect" }));
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
		});
		await user.click(screen.getByRole("button", { name: "Continue" }));

		// Step 5
		await user.click(screen.getByRole("button", { name: "Skip" }));

		// Step 6
		await user.click(screen.getByRole("button", { name: "Skip for now" }));

		// Step 7
		await user.click(screen.getByRole("button", { name: "Go to Dashboard" }));

		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith({ to: "/channels" });
		});

		expect(calls).toEqual(["status", "account", "identity", "slack", "llm", "complete", "login"]);
	});
});
