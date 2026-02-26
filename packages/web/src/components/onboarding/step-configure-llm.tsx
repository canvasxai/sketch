import { useState } from "react";

import { SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Provider = "anthropic" | "bedrock";

interface StepConfigureLLMProps {
	onNext: (data: {
		provider: Provider;
		connected: boolean;
	}) => void;
}

const bedrockRegions = [
	"us-east-1",
	"us-west-2",
	"eu-west-1",
	"eu-west-3",
	"ap-southeast-1",
	"ap-northeast-1",
];

export function StepConfigureLLM({ onNext }: StepConfigureLLMProps) {
	const [provider, setProvider] = useState<Provider>("anthropic");
	const [apiKey, setApiKey] = useState("");
	const [awsAccessKey, setAwsAccessKey] = useState("");
	const [awsSecretKey, setAwsSecretKey] = useState("");
	const [awsRegion, setAwsRegion] = useState("us-east-1");
	const [isVerifying, setIsVerifying] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState("");

	const handleConnect = async () => {
		setError("");
		setIsVerifying(true);

		// Simulate API verification for now
		await new Promise((resolve) => setTimeout(resolve, 2000));

		if (provider === "anthropic") {
			if (apiKey.startsWith("sk-ant-")) {
				setIsConnected(true);
				setIsVerifying(false);
			} else {
				setError("Invalid API key. Check your key and try again.");
				setIsVerifying(false);
			}
		} else if (awsAccessKey && awsSecretKey && awsRegion) {
			setIsConnected(true);
			setIsVerifying(false);
		} else {
			setError("API key doesn't have required permissions. Ensure your key has access to Claude models.");
			setIsVerifying(false);
		}
	};

	const handleContinue = () => {
		onNext({ provider, connected: isConnected });
	};

	const canConnect =
		provider === "anthropic"
			? apiKey.trim().length > 0
			: awsAccessKey.trim().length > 0 && awsSecretKey.trim().length > 0;

	return (
		<div className="w-full max-w-[520px]">
			<div className="mb-1">
				<h1 className="text-xl font-semibold">Connect your LLM</h1>
			</div>
			<p className="mb-6 text-sm text-muted-foreground">
				Sketch uses Anthropic&apos;s Claude models. Choose how you&apos;d like to connect.
			</p>

			{isConnected ? (
				<div className="space-y-6">
					<div className="rounded-lg border bg-card p-5">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-full bg-success/10">
								<SpinnerGap weight="bold" className="size-5 text-success" />
							</div>
							<div>
								<p className="text-sm font-medium">
									Connected to {provider === "anthropic" ? "Anthropic" : "AWS Bedrock"}
								</p>
								<p className="text-xs text-muted-foreground">Using Claude Sonnet</p>
							</div>
						</div>
					</div>
					<Button className="w-full" onClick={handleContinue}>
						Continue
					</Button>
				</div>
			) : (
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-3">
						<button
							type="button"
							onClick={() => {
								setProvider("anthropic");
								setError("");
							}}
							className={cn(
								"rounded-lg border p-4 text-left transition-all",
								provider === "anthropic"
									? "border-primary bg-primary/5 ring-1 ring-primary/20"
									: "border-border bg-card hover:border-muted-foreground/30",
							)}
						>
							<div className="mb-1.5 flex items-center gap-2">
								<svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.604L16.742 20.48h-3.603L6.569 3.52zM0 20.48h3.604L10.174 3.52H6.569L0 20.48z" />
								</svg>
								<span className="text-sm font-medium">Anthropic (Direct)</span>
							</div>
							<p className="text-xs text-muted-foreground">Use your Anthropic API key directly</p>
						</button>
						<button
							type="button"
							onClick={() => {
								setProvider("bedrock");
								setError("");
							}}
							className={cn(
								"rounded-lg border p-4 text-left transition-all",
								provider === "bedrock"
									? "border-primary bg-primary/5 ring-1 ring-primary/20"
									: "border-border bg-card hover:border-muted-foreground/30",
							)}
						>
							<div className="mb-1.5 flex items-center gap-2">
								<svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
								</svg>
								<span className="text-sm font-medium">AWS Bedrock</span>
							</div>
							<p className="text-xs text-muted-foreground">Use Claude through your AWS account</p>
						</button>
					</div>

					<div className="space-y-3">
						{provider === "anthropic" ? (
							<div className="space-y-1.5">
								<Label htmlFor="apiKey" className="text-xs">
									API Key
								</Label>
								<Input
									id="apiKey"
									type="password"
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
									placeholder="sk-ant-..."
									disabled={isVerifying}
									className="font-mono text-xs"
								/>
							</div>
						) : (
							<>
								<div className="space-y-1.5">
									<Label htmlFor="awsAccess" className="text-xs">
										AWS Access Key ID
									</Label>
									<Input
										id="awsAccess"
										value={awsAccessKey}
										onChange={(e) => setAwsAccessKey(e.target.value)}
										placeholder="AKIA..."
										disabled={isVerifying}
										className="font-mono text-xs"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="awsSecret" className="text-xs">
										AWS Secret Access Key
									</Label>
									<Input
										id="awsSecret"
										type="password"
										value={awsSecretKey}
										onChange={(e) => setAwsSecretKey(e.target.value)}
										disabled={isVerifying}
										className="font-mono text-xs"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="awsRegion" className="text-xs">
										AWS Region
									</Label>
									<select
										id="awsRegion"
										value={awsRegion}
										onChange={(event) => setAwsRegion(event.target.value)}
										disabled={isVerifying}
										className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									>
										{bedrockRegions.map((region) => (
											<option key={region} value={region}>
												{region}
											</option>
										))}
									</select>
								</div>
							</>
						)}
					</div>

					{error && <p className="text-xs text-destructive">{error}</p>}

					<p className="text-xs text-muted-foreground">
						Sketch defaults to Claude Sonnet. You can switch models per conversation from chat settings.
					</p>

					<Button
						className="w-full"
						onClick={handleConnect}
						disabled={!canConnect || isVerifying}
					>
						{isVerifying ? (
							<>
								<SpinnerGap className="size-4 animate-spin" />
								Verifying...
							</>
						) : (
							"Connect"
						)}
					</Button>
				</div>
			)}
		</div>
	);
}

