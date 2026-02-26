import { useState } from "react";

import { ChatCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepBotIdentityProps {
	onNext: (data: { organizationName: string; botName: string }) => void;
}

export function StepBotIdentity({ onNext }: StepBotIdentityProps) {
	const [organizationName, setOrganizationName] = useState("");
	const [botName, setBotName] = useState("Sketch");
	const [errors, setErrors] = useState<Record<string, string>>({});

	const validate = () => {
		const newErrors: Record<string, string> = {};
		if (!organizationName.trim()) {
			newErrors.organizationName = "Organization name is required";
		}
		if (!botName.trim()) {
			newErrors.botName = "Bot name is required";
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		onNext({ organizationName: organizationName.trim(), botName: botName.trim() });
	};

	const previewBotName = botName.trim() || "Sketch";
	const previewOrgName = organizationName.trim() || "your organization";

	return (
		<div className="w-full max-w-[480px]">
			<div className="mb-1">
				<h1 className="text-xl font-semibold">Set up your bot</h1>
			</div>
			<p className="mb-6 text-sm text-muted-foreground">
				This information helps Sketch identify itself when responding to your team.
			</p>

			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="orgName">Organization Name</Label>
					<Input
						id="orgName"
						value={organizationName}
						onChange={(e) => setOrganizationName(e.target.value)}
						placeholder="Acme Corp"
						aria-invalid={!!errors.organizationName}
					/>
					{errors.organizationName && (
						<p className="text-xs text-destructive">{errors.organizationName}</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="botName">Bot Name</Label>
					<Input
						id="botName"
						value={botName}
						onChange={(e) => setBotName(e.target.value)}
						placeholder="Sketch"
						aria-invalid={!!errors.botName}
					/>
					{errors.botName && <p className="text-xs text-destructive">{errors.botName}</p>}
				</div>

				<div className="rounded-lg border bg-card p-4">
					<p className="mb-3 text-xs text-muted-foreground">Preview</p>
					<div className="flex items-start gap-3">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary">
							<ChatCircle weight="fill" className="size-4 text-primary-foreground" />
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium">
								{previewBotName}{" "}
								<span className="text-xs font-normal text-muted-foreground">
									from {previewOrgName}
								</span>
							</p>
							<div className="rounded-lg bg-muted/50 px-3 py-2">
								<p className="text-sm text-muted-foreground">
									Hi! I&apos;m {previewBotName} from {previewOrgName}. How can I help you today?
								</p>
							</div>
						</div>
					</div>
				</div>

				<Button type="submit" className="w-full">
					Continue
				</Button>
			</form>
		</div>
	);
}

