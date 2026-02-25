/**
 * Channels page — displays Slack and WhatsApp platform cards with connection status.
 * Slack shows configured/not-configured only. WhatsApp shows real connection state.
 */
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChannelStatus } from "@/lib/api";
import { api } from "@/lib/api";
import { Check, DotsThree, SlackLogo, Warning, WhatsappLogo, XCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { dashboardRoute } from "./dashboard";

export const channelsRoute = createRoute({
	getParentRoute: () => dashboardRoute,
	path: "/channels",
	component: ChannelsPage,
});

function ChannelsPage() {
	const { data, isLoading } = useQuery({
		queryKey: ["channels", "status"],
		queryFn: () => api.channels.status(),
		refetchInterval: 10000,
	});

	return (
		<div className="mx-auto max-w-3xl px-6 py-8">
			<h1 className="text-xl font-bold">Channels</h1>
			<p className="mt-1 text-sm text-muted-foreground">Manage your messaging platform connections</p>

			<div className="mt-6 space-y-4">
				{isLoading ? (
					<>
						<Skeleton className="h-32 rounded-lg" />
						<Skeleton className="h-32 rounded-lg" />
					</>
				) : (
					data?.channels.map((channel) => <PlatformCard key={channel.platform} channel={channel} />)
				)}
			</div>
		</div>
	);
}

function PlatformCard({ channel }: { channel: ChannelStatus }) {
	if (channel.platform === "slack") {
		return <SlackCard channel={channel} />;
	}
	return <WhatsAppCard channel={channel} />;
}

function SlackCard({ channel }: { channel: ChannelStatus }) {
	const isConfigured = channel.configured;

	return (
		<div
			className={`rounded-lg border p-4 ${isConfigured ? "border-border bg-card" : "border-dashed border-border bg-card"}`}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="flex size-9 items-center justify-center rounded-full bg-muted">
						<SlackLogo size={20} />
					</div>
					<span className="text-sm font-medium">Slack</span>
				</div>
				{isConfigured && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="size-7">
								<DotsThree size={16} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem disabled>Disconnect</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			<div className="ml-12 mt-2">
				{isConfigured ? (
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Check size={14} className="text-success" />
						<span>Configured</span>
					</div>
				) : (
					<>
						<p className="text-sm text-muted-foreground">Not connected</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Add Slack tokens to <code className="font-mono">.env</code> to connect
						</p>
					</>
				)}
			</div>
		</div>
	);
}

function WhatsAppCard({ channel }: { channel: ChannelStatus }) {
	const [showPairDialog, setShowPairDialog] = useState(false);
	const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

	const isConfigured = channel.configured;
	const isConnected = channel.connected === true;
	const isDisconnected = isConfigured && !isConnected;

	let borderClass = "border-dashed border-border";
	if (isConnected) borderClass = "border-border";
	if (isDisconnected) borderClass = "border-warning/50";

	return (
		<>
			<div className={`rounded-lg border bg-card p-4 ${borderClass}`}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-full bg-muted">
							<WhatsappLogo size={20} />
						</div>
						<span className="text-sm font-medium">WhatsApp</span>
					</div>
					<div className="flex items-center gap-2">
						{!isConfigured && (
							<Button variant="outline" size="sm" onClick={() => setShowPairDialog(true)}>
								Pair
							</Button>
						)}
						{isDisconnected && (
							<Button variant="outline" size="sm">
								Reconnect
							</Button>
						)}
						{isConfigured && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" className="size-7">
										<DotsThree size={16} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => setShowPairDialog(true)}>Re-pair</DropdownMenuItem>
									<DropdownMenuItem className="text-destructive" onClick={() => setShowDisconnectDialog(true)}>
										Disconnect
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>

				<div className="ml-12 mt-2">
					{isConnected && (
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Check size={14} className="text-success" />
							<span>Connected</span>
						</div>
					)}
					{isDisconnected && (
						<div className="flex items-center gap-1.5 text-xs text-warning">
							<Warning size={14} />
							<span>Disconnected</span>
						</div>
					)}
					{!isConfigured && (
						<>
							<p className="text-sm text-muted-foreground">Not connected</p>
							<p className="mt-1 text-xs text-muted-foreground">Pair a WhatsApp number to get started</p>
						</>
					)}
				</div>
			</div>

			<WhatsAppPairDialog open={showPairDialog} onOpenChange={setShowPairDialog} />

			<AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Disconnect WhatsApp?</AlertDialogTitle>
						<AlertDialogDescription>
							This will disconnect your WhatsApp number. Users will no longer be able to message the bot via WhatsApp.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={() => setShowDisconnectDialog(false)}>
							Disconnect
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function WhatsAppPairDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const { data, isLoading, error } = useQuery({
		queryKey: ["whatsapp", "pair"],
		queryFn: () => api.channels.status().then(() => fetch("/api/whatsapp/pair").then((r) => r.json())),
		enabled: open,
		refetchOnWindowFocus: false,
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Pair WhatsApp</DialogTitle>
					<DialogDescription>Scan this QR code with WhatsApp to connect your number.</DialogDescription>
				</DialogHeader>
				<div className="flex items-center justify-center py-4">
					{isLoading && <div className="text-sm text-muted-foreground">Generating QR code...</div>}
					{error && (
						<div className="flex items-center gap-2 text-sm text-destructive">
							<XCircle size={16} />
							<span>Failed to generate QR code</span>
						</div>
					)}
					{data?.qr && (
						<div className="rounded-lg border bg-white p-4">
							<img
								src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr)}`}
								alt="WhatsApp QR Code"
								className="size-[200px]"
							/>
						</div>
					)}
					{data?.status === "already_connected" && (
						<div className="flex items-center gap-2 text-sm text-success">
							<Check size={16} />
							<span>Already connected</span>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
