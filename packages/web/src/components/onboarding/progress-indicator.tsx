import { Check } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const steps = [
	{ number: 1, label: "Account" },
	{ number: 2, label: "Identity" },
	{ number: 3, label: "Channels" },
	{ number: 4, label: "LLM" },
	{ number: 5, label: "Test" },
	{ number: 6, label: "Team" },
];

interface ProgressIndicatorProps {
	currentStep: number;
}

export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
	return (
		<div className="mb-8 flex items-center gap-1 sm:gap-2">
			{steps.map((step, i) => {
				const isCompleted = currentStep > step.number;
				const isCurrent = currentStep === step.number;

				return (
					<div key={step.number} className="flex items-center gap-1 sm:gap-2">
						<div className="flex items-center gap-1.5">
							<div
								className={cn(
									"flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
									isCompleted && "bg-primary/15 text-primary",
									isCurrent && "bg-primary text-primary-foreground",
									!isCompleted && !isCurrent && "bg-muted text-muted-foreground",
								)}
							>
								{isCompleted ? <Check weight="bold" className="size-3.5" /> : step.number}
							</div>
							<span
								className={cn(
									"hidden text-xs font-medium sm:inline",
									isCurrent && "text-foreground",
									!isCurrent && "text-muted-foreground",
								)}
							>
								{step.label}
							</span>
						</div>
						{i < steps.length - 1 && (
							<div className={cn("h-px w-4 sm:w-8", currentStep > step.number ? "bg-primary/30" : "bg-border")} />
						)}
					</div>
				);
			})}
		</div>
	);
}
