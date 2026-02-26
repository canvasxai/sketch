import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { EyeIcon, EyeSlashIcon, SparkleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { rootRoute } from "./root";

export const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	beforeLoad: async () => {
		const status = await api.setup.status();
		if (!status.completed) {
			throw redirect({ to: "/onboarding" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	const loginMutation = useMutation({
		mutationFn: () => api.auth.login(email, password),
		onSuccess: () => {
			navigate({ to: "/channels" });
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		loginMutation.mutate();
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
			<div className="mb-8 flex flex-col items-center gap-2">
				<div className="flex size-8 items-center justify-center rounded-md bg-primary">
					<SparkleIcon size={18} weight="fill" className="text-primary-foreground" />
				</div>
				<span className="text-lg font-semibold tracking-tight">Sketch</span>
			</div>

			<Card className="w-full max-w-[400px]">
				<CardHeader className="text-center">
					<h1 className="text-xl font-semibold">Admin Login</h1>
					<p className="text-sm text-muted-foreground">Sign in to manage your Sketch deployment</p>
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
								required
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<div className="relative">
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
									onClick={() => setShowPassword(!showPassword)}
								>
									{showPassword ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
								</Button>
							</div>
						</div>
						<Button type="submit" className="w-full" disabled={loginMutation.isPending}>
							{loginMutation.isPending ? "Signing in..." : "Sign in"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
