import { CheckIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const steps = [
	{ number: 1, label: "Account" },
	{ number: 2, label: "Identity" },
	{ number: 3, label: "Channels" },
	{ number: 4, label: "LLM" },
];

interface ProgressIndicatorProps {
	currentStep: number;
	maxStepReached?: number;
	onStepClick?: (step: number) => void;
}

export function ProgressIndicator({ currentStep, maxStepReached, onStepClick }: ProgressIndicatorProps) {
	const effectiveMaxStep = maxStepReached ?? currentStep;

	return (
		<div className="mb-8 flex items-center gap-1 sm:gap-2">
			{steps.map((step, i) => {
				const isCompleted = effectiveMaxStep > step.number;
				const isCurrent = currentStep === step.number;
				const canNavigateToStep = Boolean(onStepClick) && step.number <= effectiveMaxStep && !isCurrent;

				return (
					<div key={step.number} className="flex items-center gap-1 sm:gap-2">
						<button
							type="button"
							onClick={
								canNavigateToStep && onStepClick
									? () => {
											onStepClick(step.number);
										}
									: undefined
							}
							className={cn("flex items-center gap-1.5", canNavigateToStep && "cursor-pointer hover:opacity-80")}
							disabled={!canNavigateToStep}
							aria-label={step.label}
						>
							<div
								className={cn(
									"flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
									isCompleted && "bg-primary/15 text-primary",
									isCurrent && "bg-primary text-primary-foreground",
									!isCompleted && !isCurrent && "bg-muted text-muted-foreground",
								)}
							>
								{isCompleted ? <CheckIcon weight="bold" className="size-3.5" /> : step.number}
							</div>
							<span
								className={cn(
									"hidden text-xs font-medium sm:inline text-left",
									isCurrent && "text-foreground",
									!isCurrent && "text-muted-foreground",
								)}
							>
								{step.label}
							</span>
						</button>
						{i < steps.length - 1 && (
							<div className={cn("h-px w-4 sm:w-8", effectiveMaxStep > step.number ? "bg-primary/30" : "bg-border")} />
						)}
					</div>
				);
			})}
		</div>
	);
}
