import { api } from "@/lib/api";
import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./root";

export const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	beforeLoad: async () => {
		const status = await api.setup.status();
		if (!status.completed) {
			throw redirect({ to: "/onboarding" });
		}
		throw redirect({ to: "/channels" });
	},
});
