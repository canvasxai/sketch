import { AppSidebar } from "@/components/app-sidebar";
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
				<SidebarTrigger className="absolute left-3 top-3 z-20" />
				<main className="flex-1 overflow-auto pt-10">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
