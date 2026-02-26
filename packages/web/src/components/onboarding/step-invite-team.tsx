import { useState } from "react";

import {
	Check,
	EnvelopeSimple,
	Plus,
	SpinnerGap,
	UsersThree,
	X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StepInviteTeamProps {
	slackConnected: boolean;
	whatsappConnected: boolean;
	onFinish: (invitedCount: number) => void;
	onSkip: () => void;
}

interface Invite {
	id: string;
	identifier: string;
	channel: "slack" | "whatsapp";
	status: "pending" | "sent";
}

export function StepInviteTeam({
	slackConnected,
	whatsappConnected,
	onFinish,
	onSkip,
}: StepInviteTeamProps) {
	const [invites, setInvites] = useState<Invite[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [bannerDismissed, setBannerDismissed] = useState(false);

	const handleAddInvite = () => {
		if (!inputValue.trim()) return;

		const isPhone = /^\+?\d[\d\s()-]+$/.test(inputValue.trim());
		const channel: "slack" | "whatsapp" = isPhone ? "whatsapp" : "slack";

		if (channel === "slack" && !slackConnected) {
			toast.error("Slack is not connected. Add a phone number for WhatsApp invite.");
			return;
		}
		if (channel === "whatsapp" && !whatsappConnected) {
			toast.error("WhatsApp is not connected. Add a Slack username for Slack invite.");
			return;
		}

		const invite: Invite = {
			id: crypto.randomUUID(),
			identifier: inputValue.trim(),
			channel,
			status: "pending",
		};

		setInvites((prev) => [...prev, invite]);
		setInputValue("");
	};

	const handleRemoveInvite = (id: string) => {
		setInvites((prev) => prev.filter((i) => i.id !== id));
	};

	const handleSendInvites = async () => {
		if (invites.length === 0) return;

		setIsSending(true);
		await new Promise((resolve) => setTimeout(resolve, 1500));

		setInvites((prev) => prev.map((i) => ({ ...i, status: "sent" as const })));
		setIsSending(false);

		toast.success(`${invites.length} invite(s) sent!`);
	};

	const sentCount = invites.filter((i) => i.status === "sent").length;
	const pendingCount = invites.filter((i) => i.status === "pending").length;

	return (
		<div className="w-full max-w-[480px]">
			<div className="mb-1">
				<h1 className="text-xl font-semibold">Invite your team</h1>
			</div>
			<p className="mb-6 text-sm text-muted-foreground">
				Team members can log in via Slack or WhatsApp — no passwords needed.
			</p>

			{!bannerDismissed && (
				<div className="mb-5 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
					<UsersThree
						weight="fill"
						className="mt-0.5 size-4 shrink-0 text-primary"
					/>
					<p className="flex-1 text-xs leading-relaxed text-muted-foreground">
						Invite your team to start using Sketch. Team members authenticate via Slack or WhatsApp —
						no accounts to create.
					</p>
					<button
						type="button"
						onClick={() => setBannerDismissed(true)}
						className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
					>
						<X className="size-3.5" />
					</button>
				</div>
			)}

			<div className="space-y-4">
				<div className="flex gap-2">
					<Input
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleAddInvite();
							}
						}}
						placeholder={
							slackConnected && whatsappConnected
								? "Slack username or phone number"
								: slackConnected
									? "Slack username"
									: "Phone number"
						}
					/>
					<Button
						variant="outline"
						size="icon"
						onClick={handleAddInvite}
						disabled={!inputValue.trim()}
					>
						<Plus className="size-4" />
					</Button>
				</div>

				{invites.length > 0 && (
					<div className="divide-y rounded-lg border">
						{invites.map((invite) => (
							<div
								key={invite.id}
								className="flex items-center justify-between px-3 py-2.5"
							>
								<div className="flex items-center gap-2.5">
									<div className="flex size-7 items-center justify-center rounded-full bg-muted">
										<EnvelopeSimple className="size-3.5 text-muted-foreground" />
									</div>
									<div>
										<p className="text-sm">{invite.identifier}</p>
										<p className="text-xs capitalize text-muted-foreground">
											via {invite.channel}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									{invite.status === "sent" ? (
										<Badge
											variant="secondary"
											className="gap-1 border-0 bg-success/10 text-success"
										>
											<Check weight="bold" className="size-2.5" />
											Sent
										</Badge>
									) : (
										<button
											type="button"
											onClick={() => handleRemoveInvite(invite.id)}
											className="text-muted-foreground transition-colors hover:text-foreground"
										>
											<X className="size-3.5" />
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				{pendingCount > 0 && (
					<Button
						variant="outline"
						className="w-full"
						onClick={handleSendInvites}
						disabled={isSending}
					>
						{isSending ? (
							<>
								<SpinnerGap className="size-4 animate-spin" />
								Sending...
							</>
						) : (
							`Send ${pendingCount} Invite${pendingCount > 1 ? "s" : ""}`
						)}
					</Button>
				)}
			</div>

			<div className="mt-6 space-y-2">
				<Button
					className="w-full"
					onClick={() => onFinish(sentCount)}
				>
					Finish Setup
				</Button>
				<button
					type="button"
					onClick={onSkip}
					className="w-full py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					Skip for now
				</button>
			</div>
		</div>
	);
}

