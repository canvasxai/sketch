import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/use-theme";
import { api } from "@/lib/api";
/**
 * App sidebar — navigation, branding, and user actions.
 * Follows the designer's sidebar structure with Phosphor icons.
 */
import {
	BrainIcon,
	CaretUpDownIcon,
	ChatCircleIcon,
	GearIcon,
	LinkSimpleIcon,
	MoonIcon,
	SignOutIcon,
	SparkleIcon,
	SunIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

interface NavItem {
	label: string;
	icon: React.ReactNode;
	href: string;
	disabled?: boolean;
}

const primaryNav: NavItem[] = [
	{ label: "Channels", icon: <ChatCircleIcon size={18} />, href: "/channels" },
	{ label: "Team", icon: <UsersThreeIcon size={18} />, href: "/team", disabled: true },
	{ label: "Skills", icon: <BrainIcon size={18} />, href: "/skills", disabled: true },
];

const adminNav: NavItem[] = [
	{ label: "Integrations", icon: <LinkSimpleIcon size={18} />, href: "/integrations", disabled: true },
	{ label: "Settings", icon: <GearIcon size={18} />, href: "/settings", disabled: true },
];

export function AppSidebar({ email }: { email: string }) {
	const location = useLocation();
	const navigate = useNavigate();
	const { theme, toggleTheme } = useTheme();
	const queryClient = useQueryClient();

	const { data: identity } = useQuery({
		queryKey: ["settings", "identity"],
		queryFn: () => api.settings.identity(),
	});

	const logoutMutation = useMutation({
		mutationFn: () => api.auth.logout(),
		onSuccess: () => {
			queryClient.clear();
			navigate({ to: "/login" });
		},
	});

	const initials = email.slice(0, 2).toUpperCase();

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="px-3 py-4">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" className="pointer-events-none">
							<div className="flex size-7 items-center justify-center rounded-md bg-primary">
								<SparkleIcon size={14} weight="fill" className="text-primary-foreground" />
							</div>
							<div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
								<span className="text-base font-semibold tracking-tight">{identity?.botName ?? "Sketch"}</span>
								{identity?.orgName ? (
									<span className="text-xs text-muted-foreground truncate">{identity.orgName}</span>
								) : null}
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{primaryNav.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										isActive={location.pathname === item.href}
										onClick={() => !item.disabled && navigate({ to: item.href })}
										disabled={item.disabled}
										tooltip={item.label}
									>
										{item.icon}
										<span>{item.label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{adminNav.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										isActive={location.pathname === item.href}
										onClick={() => !item.disabled && navigate({ to: item.href })}
										disabled={item.disabled}
										tooltip={item.label}
									>
										{item.icon}
										<span>{item.label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton size="lg">
									<div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
										{initials}
									</div>
									<div className="flex flex-col text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
										<span className="font-medium">Admin</span>
										<span className="text-muted-foreground">{email}</span>
									</div>
									<CaretUpDownIcon
										size={16}
										className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden"
									/>
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent side="top" align="start" className="w-56">
								<DropdownMenuItem onSelect={toggleTheme}>
									{theme === "dark" ? <SunIcon size={16} className="mr-2" /> : <MoonIcon size={16} className="mr-2" />}
									{theme === "dark" ? "Light mode" : "Dark mode"}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => logoutMutation.mutate()}>
									<SignOutIcon size={16} className="mr-2" />
									Log out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
