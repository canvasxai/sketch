import { Check, Minus } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

interface OnboardingData {
	organizationName: string;
	botName: string;
	slackConnected: boolean;
	slackWorkspace?: string;
	whatsappConnected: boolean;
	whatsappPhone?: string;
	llmProvider: "anthropic" | "bedrock";
	invitedCount: number;
}

interface StepCompletionProps {
	data: OnboardingData;
	onGoToDashboard: () => void;
}

export function StepCompletion({ data, onGoToDashboard }: StepCompletionProps) {
	const summaryItems = [
		{
			label: "Organization",
			value: data.organizationName || "Not set",
		},
		{
			label: "Bot name",
			value: data.botName || "Sketch",
		},
		{
			label: "Slack",
			value: data.slackConnected
				? `Connected to "${data.slackWorkspace ?? "Workspace"}"`
				: "Not connected",
			connected: data.slackConnected,
		},
		{
			label: "WhatsApp",
			value: data.whatsappConnected
				? `Connected — ${data.whatsappPhone ?? "Phone"}`
				: "Not connected",
			connected: data.whatsappConnected,
		},
		{
			label: "LLM",
			value:
				data.llmProvider === "anthropic"
					? "Anthropic (Sonnet)"
					: "AWS Bedrock (Sonnet)",
			connected: true,
		},
		{
			label: "Team",
			value:
				data.invitedCount > 0
					? `${data.invitedCount} member${data.invitedCount > 1 ? "s" : ""} invited`
					: "No team members yet",
			connected: data.invitedCount > 0,
		},
	] as const;

	return (
		<div className="w-full max-w-[480px] text-center">
			<div className="mb-6 flex justify-center">
				<div className="flex size-16 items-center justify-center rounded-full bg-success/10">
					<Check weight="bold" className="size-7 text-success" />
				</div>
			</div>

			<h1 className="mb-2 text-xl font-semibold">Sketch is ready</h1>
			<p className="mb-8 text-sm text-muted-foreground">
				Your instance is configured and ready to go.
			</p>

			<div className="divide-y rounded-lg border bg-card text-left">
				{summaryItems.map((item) => (
					<div
						key={item.label}
						className="flex items-center justify-between px-4 py-3"
					>
						<span className="text-sm text-muted-foreground">{item.label}</span>
						<div className="flex items-center gap-1.5">
							{"connected" in item &&
								(item.connected ? (
									<Check
										weight="bold"
										className="size-3.5 text-success"
									/>
								) : (
									<Minus className="size-3.5 text-muted-foreground" />
								))}
							<span className="text-sm font-medium">{item.value}</span>
						</div>
					</div>
				))}
			</div>

			<Button className="mt-6 w-full" onClick={onGoToDashboard}>
				Go to Dashboard
			</Button>
		</div>
	);
}

