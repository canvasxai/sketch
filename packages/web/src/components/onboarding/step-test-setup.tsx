import { useEffect, useState } from "react";

import { ChatCircle, Check, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

interface StepTestSetupProps {
	botName: string;
	organizationName: string;
	slackConnected: boolean;
	whatsappConnected: boolean;
	whatsappPhone?: string;
	onNext: () => void;
	onSkip: () => void;
}

export function StepTestSetup({
	botName,
	organizationName,
	slackConnected,
	whatsappConnected,
	whatsappPhone,
	onNext,
	onSkip,
}: StepTestSetupProps) {
	const [messageReceived, setMessageReceived] = useState(false);
	const [showHint, setShowHint] = useState(false);

	useEffect(() => {
		if (messageReceived) return;

		const hintTimer = setTimeout(() => {
			setShowHint(true);
		}, 10_000);

		// Simulate receiving a message for now
		const receiveTimer = setTimeout(() => {
			setMessageReceived(true);
		}, 5_000);

		return () => {
			clearTimeout(hintTimer);
			clearTimeout(receiveTimer);
		};
	}, [messageReceived]);

	return (
		<div className="w-full max-w-[480px]">
			<div className="mb-1">
				<h1 className="text-xl font-semibold">Test your setup</h1>
			</div>
			<p className="mb-6 text-sm text-muted-foreground">
				Send a message to Sketch to make sure everything works.
			</p>

			<div className="mb-6 space-y-3">
				{slackConnected && (
					<div className="rounded-lg border bg-card p-4">
						<p className="text-sm">
							Open Slack and send a message to{" "}
							<span className="font-medium">@{botName}</span> in any channel or via DM.
						</p>
					</div>
				)}
				{whatsappConnected && (
					<div className="rounded-lg border bg-card p-4">
						<p className="text-sm">
							Send &ldquo;Hello&rdquo; to Sketch on WhatsApp at{" "}
							<span className="font-mono font-medium">{whatsappPhone}</span>
						</p>
					</div>
				)}
			</div>

			<div className="rounded-lg border bg-card p-5">
				{!messageReceived ? (
					<div className="flex flex-col items-center py-6">
						<div className="relative mb-4">
							<div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
								<SpinnerGap className="size-5 animate-spin text-primary" />
							</div>
							<div className="animate-ping absolute inset-0 rounded-full bg-primary/5" />
						</div>
						<p className="text-sm text-muted-foreground">Waiting for your message...</p>
						{showHint && (
							<p className="mt-3 text-center text-xs text-muted-foreground">
								Haven&apos;t received a message yet? Make sure you&apos;re messaging the right number
								or bot.
							</p>
						)}
					</div>
				) : (
					<div className="space-y-4">
						<div className="mb-3 flex items-center gap-2">
							<div className="flex size-6 items-center justify-center rounded-full bg-success/10">
								<Check weight="bold" className="size-3.5 text-success" />
							</div>
							<span className="text-sm font-medium text-success">Message received!</span>
						</div>

						<div className="space-y-3">
							<div className="flex justify-end">
								<div className="max-w-[80%] rounded-lg bg-primary px-3 py-2">
									<p className="text-sm text-primary-foreground">Hello!</p>
								</div>
							</div>

							<div className="flex items-start gap-2">
								<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
									<ChatCircle
										weight="fill"
										className="size-3.5 text-primary-foreground"
									/>
								</div>
								<div>
									<p className="mb-1 text-xs text-muted-foreground">
										{botName} from {organizationName}
									</p>
									<div className="rounded-lg bg-muted/50 px-3 py-2">
										<p className="text-sm">
											Hi there! I&apos;m {botName}, your AI assistant from {organizationName}. How
											can I help you today?
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			<div className="mt-6 space-y-2">
				<Button
					className="w-full"
					disabled={!messageReceived}
					onClick={onNext}
				>
					Continue
				</Button>
				<button
					type="button"
					onClick={onSkip}
					className="w-full py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					Skip
				</button>
			</div>
		</div>
	);
}

