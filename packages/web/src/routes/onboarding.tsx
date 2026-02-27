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
import { api } from "@/lib/api";
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboarding-draft";
import { Eye, EyeSlash, Info, Sparkle } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
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
	component: OnboardingPage,
});

export function OnboardingPage() {
	const navigate = useNavigate();

	const [initialDraft] = useState(() => loadOnboardingDraft());

	const [currentStep, setCurrentStep] = useState(initialDraft?.currentStep ?? 1);
	const [maxStepReached, setMaxStepReached] = useState(initialDraft?.maxStepReached ?? 1);

	const [adminEmail, setAdminEmail] = useState(initialDraft?.adminEmail ?? "");
	const [adminPassword, setAdminPassword] = useState(initialDraft?.adminPassword ?? "");

	const [organizationName, setOrganizationName] = useState(initialDraft?.organizationName ?? "");
	const [botName, setBotName] = useState(initialDraft?.botName ?? "Sketch");

	const [slackConnected, setSlackConnected] = useState(initialDraft?.slackConnected ?? false);
	const [slackWorkspace, setSlackWorkspace] = useState<string | undefined>(initialDraft?.slackWorkspace);
	const [slackBotToken, setSlackBotToken] = useState(initialDraft?.slackBotToken ?? "");
	const [slackAppToken, setSlackAppToken] = useState(initialDraft?.slackAppToken ?? "");

	const [whatsappConnected, setWhatsappConnected] = useState(initialDraft?.whatsappConnected ?? false);
	const [whatsappPhone, setWhatsappPhone] = useState<string | undefined>(initialDraft?.whatsappPhone);
	const [llmProvider, setLlmProvider] = useState<"anthropic" | "bedrock">(initialDraft?.llmProvider ?? "anthropic");
	const [llmConnected, setLlmConnected] = useState(initialDraft?.llmConnected ?? false);
	const [anthropicApiKey, setAnthropicApiKey] = useState(initialDraft?.anthropicApiKey ?? "");
	const [awsAccessKeyId, setAwsAccessKeyId] = useState(initialDraft?.awsAccessKeyId ?? "");
	const [awsSecretAccessKey, setAwsSecretAccessKey] = useState(initialDraft?.awsSecretAccessKey ?? "");
	const [awsRegion, setAwsRegion] = useState(initialDraft?.awsRegion ?? "us-east-1");

	const [invitedCount, setInvitedCount] = useState(initialDraft?.invitedCount ?? 0);

	const goToStep = (nextStep: number) => {
		setCurrentStep(nextStep);
		setMaxStepReached((prev) => (nextStep > prev ? nextStep : prev));
	};

	useEffect(() => {
		saveOnboardingDraft({
			version: 1,
			updatedAt: Date.now(),
			currentStep,
			maxStepReached,
			adminEmail,
			adminPassword,
			organizationName,
			botName,
			slackConnected,
			slackWorkspace,
			slackBotToken,
			slackAppToken,
			whatsappConnected,
			whatsappPhone,
			llmProvider,
			llmConnected,
			anthropicApiKey,
			awsAccessKeyId,
			awsSecretAccessKey,
			awsRegion,
			invitedCount,
		});
	}, [
		currentStep,
		maxStepReached,
		adminEmail,
		adminPassword,
		organizationName,
		botName,
		slackConnected,
		slackWorkspace,
		slackBotToken,
		slackAppToken,
		whatsappConnected,
		whatsappPhone,
		llmProvider,
		llmConnected,
		anthropicApiKey,
		awsAccessKeyId,
		awsSecretAccessKey,
		awsRegion,
		invitedCount,
	]);

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
			const status = await api.setup.status();
			const adminAlreadyExists = status.currentStep === 1 || status.completed;

			if (!adminAlreadyExists) {
				if (!adminEmail.trim() || !adminPassword) {
					throw new Error("Admin email and password are required");
				}
				await api.setup.createAccount(adminEmail.trim(), adminPassword);
			}

			await api.setup.identity(organizationName.trim(), botName.trim());

			if (slackConnected) {
				await api.setup.slack(slackBotToken.trim(), slackAppToken.trim());
			}

			if (llmConnected) {
				if (llmProvider === "anthropic") {
					await api.setup.llm({ provider: "anthropic", apiKey: anthropicApiKey.trim() });
				} else {
					await api.setup.llm({
						provider: "bedrock",
						awsAccessKeyId: awsAccessKeyId.trim(),
						awsSecretAccessKey: awsSecretAccessKey.trim(),
						awsRegion: awsRegion.trim(),
					});
				}
			}

			await api.setup.complete();

			const canAutoLogin = adminEmail.trim().length > 0 && adminPassword.length > 0;
			if (canAutoLogin) {
				await api.auth.login(adminEmail.trim(), adminPassword);
			}

			return { canAutoLogin };
		},
		onSuccess: ({ canAutoLogin }) => {
			clearOnboardingDraft();
			if (canAutoLogin) {
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

	let content: React.ReactNode;

	switch (currentStep) {
		case 1:
			content = (
				<CreateAccountStep
					initialEmail={adminEmail}
					initialPassword={adminPassword}
					onComplete={({ email, password }) => {
						setAdminEmail(email);
						setAdminPassword(password);
						goToStep(2);
					}}
				/>
			);
			break;
		case 2:
			content = (
				<StepBotIdentity
					initialOrganizationName={organizationName}
					initialBotName={botName}
					onNext={({ organizationName: orgName, botName: name }) => {
						setOrganizationName(orgName);
						setBotName(name);
						goToStep(3);
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
					initialSlackBotToken={slackBotToken}
					initialSlackAppToken={slackAppToken}
					onNext={({
						slackConnected: slackOk,
						slackWorkspace: workspace,
						slackBotToken: botToken,
						slackAppToken: appToken,
						whatsappConnected: waOk,
						whatsappPhone: waPhone,
					}) => {
						setSlackConnected(slackOk);
						setSlackWorkspace(workspace);
						setSlackBotToken(botToken);
						setSlackAppToken(appToken);
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
					initialAnthropicApiKey={anthropicApiKey}
					initialAwsAccessKeyId={awsAccessKeyId}
					initialAwsSecretAccessKey={awsSecretAccessKey}
					initialAwsRegion={awsRegion}
					onNext={({ provider, connected, anthropicApiKey, awsAccessKeyId, awsSecretAccessKey, awsRegion }) => {
						setLlmProvider(provider);
						setLlmConnected(connected);
						setAnthropicApiKey(anthropicApiKey);
						setAwsAccessKeyId(awsAccessKeyId);
						setAwsSecretAccessKey(awsSecretAccessKey);
						setAwsRegion(awsRegion);
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
					<Sparkle size={18} weight="fill" className="text-primary-foreground" />
				</div>
				<span className="text-lg font-semibold tracking-tight">Sketch</span>
			</div>

			{currentStep <= 6 && (
				<ProgressIndicator
					currentStep={Math.min(currentStep, 6)}
					maxStepReached={Math.min(maxStepReached, 6)}
					onStepClick={(step) => goToStep(step)}
				/>
			)}
			{content}
		</div>
	);
}

export function CreateAccountStep({
	initialEmail,
	initialPassword,
	onComplete,
}: {
	initialEmail?: string;
	initialPassword?: string;
	onComplete: (data: { email: string; password: string }) => void;
}) {
	const [email, setEmail] = useState(initialEmail ?? "");
	const [password, setPassword] = useState(initialPassword ?? "");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

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
				<p className="text-sm text-muted-foreground">We’ll create the account when you finish setup</p>
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
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
								onClick={() => setShowPassword(!showPassword)}
							>
								{showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
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
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
								onClick={() => setShowConfirm(!showConfirm)}
							>
								{showConfirm ? <EyeSlash size={16} /> : <Eye size={16} />}
							</Button>
						</div>
						{errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
					</div>

					<div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
						<Info size={16} className="mt-0.5 shrink-0 text-primary" />
						<p className="text-sm text-muted-foreground">
							Save these credentials — you'll need them to access the admin panel.
						</p>
					</div>

					<Button type="submit" className="w-full">
						Continue
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
