import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { Outlet, createRoute, redirect, useRouteContext } from "@tanstack/react-router";
import { rootRoute } from "./root";

/**
 * Auth guard: checks setup status first, then session.
 * If setup not complete → /onboarding.
 * If not authenticated → /login.
 */
async function checkAuth() {
	const status = await api.setup.status();
	if (!status.completed) {
		throw redirect({ to: "/onboarding" });
	}

	const res = await fetch("/api/auth/session");
	const data = (await res.json()) as { authenticated: boolean; email?: string };
	if (!data.authenticated) {
		throw redirect({ to: "/login" });
	}
	return data;
}

export const dashboardRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "dashboard",
	beforeLoad: async () => {
		const auth = await checkAuth();
		return { auth };
	},
	component: DashboardLayout,
});

function DashboardLayout() {
	const { auth } = useRouteContext({ from: dashboardRoute.id });

	return (
		<SidebarProvider>
			<AppSidebar email={auth.email ?? "admin"} />
			<SidebarInset>
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
				</header>
				<main className="flex-1 overflow-auto">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
