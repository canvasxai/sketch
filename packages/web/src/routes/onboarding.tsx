import { ProgressIndicator } from "@/components/onboarding/progress-indicator";
import { StepBotIdentity } from "@/components/onboarding/step-bot-identity";
import { StepCompletion } from "@/components/onboarding/step-completion";
import { StepConfigureLLM } from "@/components/onboarding/step-configure-llm";
import { StepConnectChannels } from "@/components/onboarding/step-connect-channels";
import { StepInviteTeam } from "@/components/onboarding/step-invite-team";
import { StepTestSetup } from "@/components/onboarding/step-test-setup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SetupStatus, api } from "@/lib/api";
import { EyeIcon, EyeSlashIcon, InfoIcon, SparkleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createRoute, redirect, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { rootRoute } from "./root";

export const onboardingRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/onboarding",
	beforeLoad: async () => {
		const status = await api.setup.status();
		if (status.completed) {
			throw redirect({ to: "/channels" });
		}
		return { setupStatus: status };
	},
	component: OnboardingRoutePage,
});

function OnboardingRoutePage() {
	const { setupStatus } = useRouteContext({ from: onboardingRoute.id });
	return <OnboardingPage initialSetupStatus={setupStatus} />;
}

const defaultSetupStatus: SetupStatus = {
	completed: false,
	currentStep: 0,
	adminEmail: null,
	orgName: null,
	botName: "Sketch",
	slackConnected: false,
	llmConnected: false,
	llmProvider: null,
};

export function OnboardingPage({ initialSetupStatus }: { initialSetupStatus?: SetupStatus }) {
	const navigate = useNavigate();
	const setupStatus = initialSetupStatus ?? defaultSetupStatus;
	const initialStep = setupStatus.currentStep > 0 ? setupStatus.currentStep : 1;

	const [currentStep, setCurrentStep] = useState(initialStep);
	const [maxStepReached, setMaxStepReached] = useState(Math.min(initialStep, 6));
	const [isStepAutosaving, setIsStepAutosaving] = useState(false);

	const [draftAdminEmail, setDraftAdminEmail] = useState(setupStatus.adminEmail ?? "");
	const [draftAdminPassword, setDraftAdminPassword] = useState("");
	const [draftAdminConfirmPassword, setDraftAdminConfirmPassword] = useState("");

	const [organizationName, setOrganizationName] = useState(setupStatus.orgName ?? "");
	const [botName, setBotName] = useState(setupStatus.botName ?? "Sketch");
	const [draftOrganizationName, setDraftOrganizationName] = useState(setupStatus.orgName ?? "");
	const [draftBotName, setDraftBotName] = useState(setupStatus.botName ?? "Sketch");

	const [slackConnected, setSlackConnected] = useState(setupStatus.slackConnected);
	const [slackWorkspace, setSlackWorkspace] = useState<string | undefined>(undefined);

	const [whatsappConnected, setWhatsappConnected] = useState(false);
	const [whatsappPhone, setWhatsappPhone] = useState<string | undefined>(undefined);
	const [llmProvider, setLlmProvider] = useState<"anthropic" | "bedrock">(setupStatus.llmProvider ?? "anthropic");
	const [llmConnected, setLlmConnected] = useState(setupStatus.llmConnected);
	const [invitedCount, setInvitedCount] = useState(0);

	const goToStep = (nextStep: number) => {
		setCurrentStep(nextStep);
		setMaxStepReached((prev) => (nextStep > prev ? nextStep : prev));
	};

	const onboardingData = {
		organizationName,
		botName,
		slackConnected,
		slackWorkspace,
		whatsappConnected,
		whatsappPhone,
		llmProvider,
		llmConnected,
		invitedCount,
	};

	const finishMutation = useMutation({
		mutationFn: async () => {
			await api.setup.complete();
			const session = await api.auth.session().catch(() => ({ authenticated: false }));
			return { isAuthenticated: session.authenticated };
		},
		onSuccess: ({ isAuthenticated }) => {
			if (isAuthenticated) {
				toast.success("Setup complete. Redirecting to dashboard.");
				navigate({ to: "/channels" });
			} else {
				toast.success("Setup complete. Please sign in to continue.");
				navigate({ to: "/login" });
			}
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const accountMutation = useMutation({
		mutationFn: async ({ email, password }: { email: string; password: string }) => {
			await api.setup.createAccount(email, password);
			const login = await api.auth
				.login(email, password)
				.then(() => true)
				.catch(() => false);
			return { email, login };
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const identityMutation = useMutation({
		mutationFn: ({ organizationName: orgName, botName: name }: { organizationName: string; botName: string }) =>
			api.setup.identity(orgName, name),
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

	async function persistAccount(email: string, password: string, options?: { showWarning?: boolean }) {
		const result = await accountMutation.mutateAsync({ email, password });
		setDraftAdminEmail(result.email);
		setDraftAdminPassword("");
		setDraftAdminConfirmPassword("");
		if (!result.login && options?.showWarning) {
			toast.warning("Account saved. You may need to sign in after setup completes.");
		}
	}

	async function persistIdentity(orgName: string, name: string) {
		await identityMutation.mutateAsync({ organizationName: orgName, botName: name });
		setOrganizationName(orgName);
		setBotName(name);
		setDraftOrganizationName(orgName);
		setDraftBotName(name);
	}

	async function maybeAutosaveCurrentStep(): Promise<boolean> {
		if (currentStep === 1) {
			const email = draftAdminEmail.trim();
			const password = draftAdminPassword;
			const confirm = draftAdminConfirmPassword;
			const isSavable = isValidEmail(email) && password.length >= 8 && password === confirm;
			if (!isSavable) return true;
			try {
				await persistAccount(email, password);
				return true;
			} catch {
				return false;
			}
		}

		if (currentStep === 2) {
			const orgName = draftOrganizationName.trim();
			const name = draftBotName.trim();
			if (!orgName || !name) return true;
			try {
				await persistIdentity(orgName, name);
				return true;
			} catch {
				return false;
			}
		}

		return true;
	}

	const handleStepClick = async (step: number) => {
		if (step === currentStep || isStepAutosaving) return;

		setIsStepAutosaving(true);
		const canNavigate = await maybeAutosaveCurrentStep();
		setIsStepAutosaving(false);
		if (canNavigate) {
			goToStep(step);
		}
	};

	let content: React.ReactNode;

	switch (currentStep) {
		case 1:
			content = (
				<CreateAccountStep
					initialEmail={draftAdminEmail}
					isSubmitting={accountMutation.isPending || isStepAutosaving}
					onDraftChange={({ email, password, confirmPassword }) => {
						setDraftAdminEmail(email);
						setDraftAdminPassword(password);
						setDraftAdminConfirmPassword(confirmPassword);
					}}
					onComplete={async ({ email, password }) => {
						try {
							await persistAccount(email, password, { showWarning: true });
							goToStep(2);
						} catch {
							// Error toast is handled by account mutation.
						}
					}}
				/>
			);
			break;
		case 2:
			content = (
				<StepBotIdentity
					initialOrganizationName={draftOrganizationName}
					initialBotName={draftBotName}
					isSubmitting={identityMutation.isPending || isStepAutosaving}
					onDraftChange={({ organizationName: orgName, botName: name }) => {
						setDraftOrganizationName(orgName);
						setDraftBotName(name);
					}}
					onNext={async ({ organizationName: orgName, botName: name }) => {
						try {
							await persistIdentity(orgName, name);
							goToStep(3);
						} catch {
							// Error toast is handled by identity mutation.
						}
					}}
				/>
			);
			break;
		case 3:
			content = (
				<StepConnectChannels
					botName={botName}
					initialSlackConnected={slackConnected}
					initialSlackWorkspace={slackWorkspace}
					onNext={({
						slackConnected: slackOk,
						slackWorkspace: workspace,
						whatsappConnected: waOk,
						whatsappPhone: waPhone,
					}) => {
						setSlackConnected(slackOk);
						setSlackWorkspace(workspace);
						setWhatsappConnected(waOk);
						setWhatsappPhone(waPhone);
						goToStep(4);
					}}
				/>
			);
			break;
		case 4:
			content = (
				<StepConfigureLLM
					initialProvider={llmProvider}
					initialConnected={llmConnected}
					onNext={({ provider, connected }) => {
						setLlmProvider(provider);
						setLlmConnected(connected);
						goToStep(5);
					}}
				/>
			);
			break;
		case 5:
			content = (
				<StepTestSetup
					botName={botName}
					organizationName={organizationName}
					slackConnected={slackConnected}
					whatsappConnected={whatsappConnected}
					whatsappPhone={whatsappPhone}
					onNext={() => goToStep(6)}
					onSkip={() => goToStep(6)}
				/>
			);
			break;
		case 6:
			content = (
				<StepInviteTeam
					slackConnected={slackConnected}
					whatsappConnected={whatsappConnected}
					onFinish={(count) => {
						setInvitedCount(count);
						goToStep(7);
					}}
					onSkip={() => {
						setInvitedCount(0);
						goToStep(7);
					}}
				/>
			);
			break;
		default:
			content = (
				<StepCompletion
					data={onboardingData}
					isFinishing={finishMutation.isPending}
					onGoToDashboard={() => finishMutation.mutate()}
				/>
			);
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
			<div className="mb-8 flex flex-col items-center gap-2">
				<div className="flex size-8 items-center justify-center rounded-md bg-primary">
					<SparkleIcon size={18} weight="fill" className="text-primary-foreground" />
				</div>
				<span className="text-lg font-semibold tracking-tight">Sketch</span>
			</div>

			{currentStep <= 6 && (
				<ProgressIndicator
					currentStep={Math.min(currentStep, 6)}
					maxStepReached={Math.min(maxStepReached, 6)}
					onStepClick={handleStepClick}
				/>
			)}
			{content}
		</div>
	);
}

export function CreateAccountStep({
	initialEmail,
	initialPassword,
	isSubmitting,
	onDraftChange,
	onComplete,
}: {
	initialEmail?: string;
	initialPassword?: string;
	isSubmitting?: boolean;
	onDraftChange?: (data: { email: string; password: string; confirmPassword: string }) => void;
	onComplete: (data: { email: string; password: string }) => void;
}) {
	const [email, setEmail] = useState(initialEmail ?? "");
	const [password, setPassword] = useState(initialPassword ?? "");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		onDraftChange?.({ email, password, confirmPassword });
	}, [email, password, confirmPassword, onDraftChange]);

	function validate(): boolean {
		const newErrors: Record<string, string> = {};

		if (!email) {
			newErrors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			newErrors.email = "Invalid email format";
		}

		if (!password) {
			newErrors.password = "Password is required";
		} else if (password.length < 8) {
			newErrors.password = "Password must be at least 8 characters";
		}

		if (password !== confirmPassword) {
			newErrors.confirmPassword = "Passwords do not match";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (validate()) {
			onComplete({ email: email.trim(), password });
		}
	};

	return (
		<Card className="w-full max-w-[480px]">
			<CardHeader className="text-center">
				<h1 className="text-xl font-semibold">Create your admin account</h1>
				<p className="text-sm text-muted-foreground">We’ll securely save your credentials now.</p>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="admin@yourorg.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={Boolean(isSubmitting)}
							autoFocus
						/>
						{errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<div className="relative">
							<Input
								id="password"
								type={showPassword ? "text" : "password"}
								placeholder="At least 8 characters"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={Boolean(isSubmitting)}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
								onClick={() => setShowPassword(!showPassword)}
								disabled={Boolean(isSubmitting)}
							>
								{showPassword ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
							</Button>
						</div>
						{errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="confirmPassword">Confirm password</Label>
						<div className="relative">
							<Input
								id="confirmPassword"
								type={showConfirm ? "text" : "password"}
								placeholder="Re-enter your password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								disabled={Boolean(isSubmitting)}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
								onClick={() => setShowConfirm(!showConfirm)}
								disabled={Boolean(isSubmitting)}
							>
								{showConfirm ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
							</Button>
						</div>
						{errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
					</div>

					<div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
						<InfoIcon size={16} className="mt-0.5 shrink-0 text-primary" />
						<p className="text-sm text-muted-foreground">
							Save these credentials — you'll need them to access the admin panel.
						</p>
					</div>

					<Button type="submit" className="w-full" disabled={Boolean(isSubmitting)}>
						{isSubmitting ? "Creating account..." : "Continue"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
