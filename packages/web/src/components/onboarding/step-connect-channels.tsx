import { useCallback, useState } from "react";

import { ArrowSquareOutIcon, CheckIcon, CopySimpleIcon, SlackLogoIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface ChannelState {
	slack: {
		connected: boolean;
		connecting: boolean;
		workspaceName?: string;
	};
}

interface StepConnectChannelsProps {
	botName: string;
	initialSlackConnected?: boolean;
	initialSlackWorkspace?: string;
	onNext: (data: {
		slackConnected: boolean;
		slackWorkspace?: string;
		whatsappConnected: boolean;
		whatsappPhone?: string;
	}) => void;
}

export function StepConnectChannels({
	botName,
	initialSlackConnected,
	initialSlackWorkspace,
	onNext,
}: StepConnectChannelsProps) {
	const [channels, setChannels] = useState<ChannelState>({
		slack: {
			connected: Boolean(initialSlackConnected),
			connecting: false,
			workspaceName: initialSlackWorkspace ?? (initialSlackConnected ? "Workspace" : undefined),
		},
	});

	const [slackBotToken, setSlackBotToken] = useState("");
	const [slackAppToken, setSlackAppToken] = useState("");
	const [manifestCopied, setManifestCopied] = useState(false);

	const slackConnectMutation = useMutation({
		mutationFn: async () => {
			const botToken = slackBotToken.trim();
			const appToken = slackAppToken.trim();
			const verified = await api.setup.verifySlack(botToken, appToken);
			await api.setup.slack(botToken, appToken);
			return verified;
		},
		onSuccess: (result) => {
			setChannels((prev) => ({
				...prev,
				slack: {
					connected: true,
					connecting: false,
					workspaceName: result.workspaceName ?? "Workspace",
				},
			}));
			setSlackBotToken("");
			setSlackAppToken("");
			toast.success("Connected to Slack.");
		},
		onError: (error: Error) => {
			setChannels((prev) => ({
				...prev,
				slack: { ...prev.slack, connecting: false },
			}));
			toast.error(error.message);
		},
	});

	const handleSlackConnect = useCallback(async () => {
		if (!slackBotToken.trim() || !slackAppToken.trim()) return;

		setChannels((prev) => ({
			...prev,
			slack: { ...prev.slack, connecting: true },
		}));

		slackConnectMutation.mutate();
	}, [slackBotToken, slackAppToken, slackConnectMutation]);

	const handleSlackDisconnect = () => {
		setChannels((prev) => ({
			...prev,
			slack: { connected: false, connecting: false, workspaceName: undefined },
		}));
		setSlackBotToken("");
		setSlackAppToken("");
	};

	const handleCopyManifest = useCallback(async () => {
		const manifestBotName = botName.trim() || "Sketch";

		const manifest = JSON.stringify(
			{
				display_information: {
					name: manifestBotName,
				},
				features: {
					bot_user: {
						display_name: manifestBotName,
						always_online: true,
					},
				},
				oauth_config: {
					scopes: {
						bot: [
							"app_mentions:read",
							"channels:history",
							"channels:read",
							"chat:write",
							"groups:history",
							"groups:read",
							"im:history",
							"im:read",
							"im:write",
							"mpim:history",
							"mpim:read",
							"reactions:read",
							"reactions:write",
							"team:read",
							"users:read",
							"files:read",
							"files:write",
						],
					},
				},
				settings: {
					event_subscriptions: {
						bot_events: ["app_mention", "message.channels", "message.groups", "message.im", "message.mpim"],
					},
					interactivity: {
						is_enabled: true,
					},
					org_deploy_enabled: false,
					socket_mode_enabled: true,
					token_rotation_enabled: false,
				},
			},
			null,
			2,
		);

		try {
			if (typeof navigator === "undefined" || !navigator.clipboard) {
				throw new Error("Clipboard API not available");
			}

			await navigator.clipboard.writeText(manifest);
			setManifestCopied(true);
			toast.success("Slack manifest copied to clipboard.");

			setTimeout(() => {
				setManifestCopied(false);
			}, 2000);
		} catch (error) {
			toast.error("Unable to copy manifest. Please try again or copy manually.");
			console.error(error);
		}
	}, [botName]);
	const canContinue = channels.slack.connected;

	const handleContinue = () => {
		onNext({
			slackConnected: channels.slack.connected,
			slackWorkspace: channels.slack.workspaceName,
			whatsappConnected: false,
			whatsappPhone: undefined,
		});
	};

	return (
		<div className="w-full max-w-[600px]">
			<div className="mb-1">
				<h1 className="text-xl font-semibold">Connect your channels</h1>
			</div>
			<p className="mb-6 text-sm text-muted-foreground">
				Connect at least one channel so your team can start messaging Sketch.
			</p>

			<div className="space-y-4">
				{/* Slack Card */}
				<div className="rounded-lg border bg-card p-5">
					<div className="mb-4 flex items-center justify-between">
						<div className="flex items-center gap-2.5">
							<SlackLogoIcon className="size-5" />
							<span className="text-sm font-medium">Slack</span>
						</div>
						{channels.slack.connected ? (
							<Badge variant="secondary" className="gap-1 border-0 bg-success/10 text-success">
								<CheckIcon weight="bold" className="size-3" />
								Connected to &ldquo;{channels.slack.workspaceName}&rdquo;
							</Badge>
						) : (
							<Badge variant="secondary" className="text-muted-foreground">
								Not connected
							</Badge>
						)}
					</div>

					{channels.slack.connected ? (
						<button
							type="button"
							onClick={handleSlackDisconnect}
							className="text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							Disconnect
						</button>
					) : (
						<>
							<ol className="mb-4 list-inside list-decimal space-y-1.5 text-xs text-muted-foreground">
								<li>Copy the manifest below</li>
								<li>Go to api.slack.com/apps → &ldquo;Create New App&rdquo; → &ldquo;From a Manifest&rdquo;</li>
								<li>Select your workspace and paste the manifest</li>
								<li>Click &ldquo;Install to Workspace&rdquo;</li>
								<li>Copy the Bot Token (OAuth &amp; Permissions page) and App-Level Token</li>
								<li>Paste both tokens below</li>
							</ol>

							<div className="mb-4 flex items-center gap-2">
								<Button variant="outline" size="sm" onClick={handleCopyManifest}>
									{manifestCopied ? (
										<>
											<CheckIcon className="size-3.5 text-emerald-500" weight="bold" />
											Copied
										</>
									) : (
										<>
											<CopySimpleIcon className="size-3.5" />
											Copy Manifest
										</>
									)}
								</Button>
								<Button variant="ghost" size="sm" asChild>
									<a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">
										Open Slack API
										<ArrowSquareOutIcon className="size-3.5" />
									</a>
								</Button>
							</div>

							<div className="space-y-3">
								<div className="space-y-1.5">
									<Label htmlFor="botToken" className="text-xs">
										Bot Token
									</Label>
									<Input
										id="botToken"
										value={slackBotToken}
										onChange={(e) => setSlackBotToken(e.target.value)}
										placeholder="xoxb-..."
										disabled={channels.slack.connecting}
										className="font-mono text-xs"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="appToken" className="text-xs">
										App-Level Token
									</Label>
									<Input
										id="appToken"
										value={slackAppToken}
										onChange={(e) => setSlackAppToken(e.target.value)}
										placeholder="xapp-..."
										disabled={channels.slack.connecting}
										className="font-mono text-xs"
									/>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={handleSlackConnect}
									disabled={!slackBotToken.trim() || !slackAppToken.trim() || channels.slack.connecting}
								>
									{channels.slack.connecting ? (
										<>
											<SpinnerGapIcon className="size-3.5 animate-spin" />
											Connecting...
										</>
									) : (
										"Connect"
									)}
								</Button>
							</div>
						</>
					)}
				</div>
			</div>

			<div className="mt-6">
				<Button className="w-full" disabled={!canContinue} onClick={handleContinue}>
					Continue
				</Button>
				{!canContinue && (
					<p className="mt-2 text-center text-xs text-muted-foreground">Connect at least one channel to continue</p>
				)}
			</div>
		</div>
	);
}
