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
import { Eye, EyeSlash, Info, Sparkle, SpinnerGap } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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

function OnboardingPage() {
	const navigate = useNavigate();

	const [currentStep, setCurrentStep] = useState(1);
	const [organizationName, setOrganizationName] = useState("");
	const [botName, setBotName] = useState("Sketch");
	const [slackConnected, setSlackConnected] = useState(false);
	const [slackWorkspace, setSlackWorkspace] = useState<string | undefined>();
	const [whatsappConnected, setWhatsappConnected] = useState(false);
	const [whatsappPhone, setWhatsappPhone] = useState<string | undefined>();
	const [llmProvider, setLlmProvider] = useState<"anthropic" | "bedrock">("anthropic");
	const [invitedCount, setInvitedCount] = useState(0);

	const onboardingData = {
		organizationName,
		botName,
		slackConnected,
		slackWorkspace,
		whatsappConnected,
		whatsappPhone,
		llmProvider,
		invitedCount,
	};

	let content: React.ReactNode;

	switch (currentStep) {
		case 1:
			content = <CreateAccountStep onComplete={() => setCurrentStep(2)} />;
			break;
		case 2:
			content = (
				<StepBotIdentity
					onNext={({ organizationName: orgName, botName: name }) => {
						setOrganizationName(orgName);
						setBotName(name);
						setCurrentStep(3);
					}}
				/>
			);
			break;
		case 3:
			content = (
				<StepConnectChannels
					botName={botName}
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
						setCurrentStep(4);
					}}
				/>
			);
			break;
		case 4:
			content = (
				<StepConfigureLLM
					onNext={({ provider }) => {
						setLlmProvider(provider);
						setCurrentStep(5);
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
					onNext={() => setCurrentStep(6)}
					onSkip={() => setCurrentStep(6)}
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
						setCurrentStep(7);
					}}
					onSkip={() => {
						setInvitedCount(0);
						setCurrentStep(7);
					}}
				/>
			);
			break;
		default:
			content = <StepCompletion data={onboardingData} onGoToDashboard={() => navigate({ to: "/login" })} />;
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
			<div className="mb-8 flex flex-col items-center gap-2">
				<div className="flex size-8 items-center justify-center rounded-md bg-primary">
					<Sparkle size={18} weight="fill" className="text-primary-foreground" />
				</div>
				<span className="text-lg font-semibold tracking-tight">Sketch</span>
			</div>

			<ProgressIndicator currentStep={Math.min(currentStep, 6)} />
			{content}
		</div>
	);
}

export function CreateAccountStep({ onComplete }: { onComplete: () => void }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const createAccountMutation = useMutation({
		mutationFn: () => api.setup.createAccount(email, password),
		onSuccess: () => {
			toast.success("Admin account created");
			onComplete();
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

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
			createAccountMutation.mutate();
		}
	};

	return (
		<Card className="w-full max-w-[480px]">
			<CardHeader className="text-center">
				<h1 className="text-xl font-semibold">Create your admin account</h1>
				<p className="text-sm text-muted-foreground">Set up credentials for the Sketch admin panel</p>
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

					<Button type="submit" className="w-full" disabled={createAccountMutation.isPending}>
						{createAccountMutation.isPending ? (
							<>
								<SpinnerGap size={16} className="animate-spin" />
								Creating account...
							</>
						) : (
							"Continue"
						)}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
