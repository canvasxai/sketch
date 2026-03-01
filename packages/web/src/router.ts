import { createRouter } from "@tanstack/react-router";
import { channelsRoute } from "./routes/channels";
import { dashboardRoute } from "./routes/dashboard";
import { indexRoute } from "./routes/index";
import { loginRoute } from "./routes/login";
import { onboardingRoute } from "./routes/onboarding";
import { rootRoute } from "./routes/root";
import { teamRoute } from "./routes/team";

const routeTree = rootRoute.addChildren([
	loginRoute,
	onboardingRoute,
	indexRoute,
	dashboardRoute.addChildren([channelsRoute, teamRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
