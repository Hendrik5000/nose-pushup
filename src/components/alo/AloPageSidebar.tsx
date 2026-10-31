import { Link } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  Dumbbell,
  HeartPulse,
  House,
  MessageCircle,
  Settings2,
  X,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import "@/alo-page-sidebar.css";

export type AloPageSection = "mira" | "nexus" | "health";

type AloPageSidebarProps = {
  active: AloPageSection;
  children: ReactNode;
};

type Destination = "/" | "/ai" | "/chat" | "/health" | "/exercises" | "/profile";

type NavigationItem = {
  to: Destination;
  label: string;
  Icon: typeof Activity;
  section?: AloPageSection;
};

const navigationItems: NavigationItem[] = [
  { to: "/", label: "Startseite", Icon: House },
  { to: "/ai", label: "Mira", Icon: Bot, section: "mira" },
  { to: "/chat", label: "Nexus", Icon: MessageCircle, section: "nexus" },
  { to: "/health", label: "Alo Health", Icon: HeartPulse, section: "health" },
  { to: "/exercises", label: "Training", Icon: Dumbbell },
  { to: "/profile", label: "Einstellungen", Icon: Settings2 },
];

export function AloPageSidebar({ active, children }: AloPageSidebarProps) {
  return (
    <SidebarProvider
      className="alo-page-sidebar-provider"
      style={{ "--sidebar-width": "clamp(12rem, 16vw, 16rem)" } as CSSProperties}
    >
      <Sidebar collapsible="offcanvas" className="alo-page-sidebar">
        <AloPageNavigation active={active} />
      </Sidebar>
      <div className="alo-page-sidebar-content">{children}</div>
    </SidebarProvider>
  );
}

function AloPageNavigation({ active }: { active: AloPageSection }) {
  const { setOpenMobile } = useSidebar();

  return (
    <nav
      id="alo-page-sidebar-navigation"
      aria-label="Alo-Bereiche"
      className="alo-page-sidebar-nav"
    >
      <SidebarHeader className="alo-page-sidebar-header">
        <Link to="/" className="alo-page-sidebar-brand" aria-label="Alo-Startseite">
          <span className="alo-page-sidebar-mark" aria-hidden="true">
            A
          </span>
          <span className="alo-page-sidebar-brand-copy">
            <strong>Alo</strong>
            <small>All in one</small>
          </span>
        </Link>
        <button
          type="button"
          className="alo-page-sidebar-close"
          aria-label="Bereichsmenü schließen"
          onClick={() => setOpenMobile(false)}
        >
          <X aria-hidden="true" />
        </button>
      </SidebarHeader>
      <SidebarContent className="alo-page-sidebar-scroll">
        <SidebarGroup>
          <SidebarGroupLabel>Bereiche</SidebarGroupLabel>
          <SidebarMenu>
            {navigationItems.map(({ to, label, Icon, section }) => {
              const isActive = section === active;
              return (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    asChild
                    size="lg"
                    isActive={isActive}
                    tooltip={label}
                    className="alo-page-sidebar-link"
                  >
                    <Link
                      to={to}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="alo-page-sidebar-footer">
        <span>Alo · dein persönlicher Bereich</span>
      </SidebarFooter>
    </nav>
  );
}

export function AloPageSidebarTrigger({ className = "" }: { className?: string }) {
  const { isMobile, open, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const label = expanded ? "Bereichsmenü ausblenden" : "Bereichsmenü einblenden";

  return (
    <SidebarTrigger
      className={`alo-page-sidebar-trigger ${className}`.trim()}
      aria-label={label}
      aria-controls="alo-page-sidebar-navigation"
      aria-expanded={expanded}
      title={label}
    />
  );
}
