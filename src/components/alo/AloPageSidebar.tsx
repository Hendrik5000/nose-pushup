import { Link } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  HeartPulse,
  House,
  MessageCircle,
  MessageSquarePlus,
  Moon,
  Plus,
  Search,
  Settings2,
  Watch,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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

type AloSidebarCommand =
  | "mira-new-chat"
  | "mira-view-chat"
  | "mira-view-history"
  | "mira-view-tasks"
  | "mira-open-settings"
  | "nexus-open-list"
  | "nexus-new-room"
  | "nexus-new-dm"
  | "nexus-open-search"
  | "nexus-export-current";

export type AloPageSidebarCommands = Partial<Record<AloSidebarCommand, () => void>>;
type SidebarCommandRegistration = (commands: AloPageSidebarCommands, activeItem?: string) => void;

const SidebarCommandContext = createContext<SidebarCommandRegistration | null>(null);

export function useAloPageSidebarCommands(commands: AloPageSidebarCommands, activeItem?: string) {
  const register = useContext(SidebarCommandContext);
  useEffect(() => {
    if (!register) return;
    register(commands, activeItem);
    return () => register({}, undefined);
  }, [register, commands, activeItem]);
}

type MenuEntry = {
  id: string;
  label: string;
  Icon: LucideIcon;
} & ({ command: AloSidebarCommand; href?: never } | { href: string; command?: never });

type AppMenu = {
  name: string;
  subtitle: string;
  groupLabel: string;
  Icon: LucideIcon;
  items: MenuEntry[];
  quickActions: MenuEntry[];
};

const appMenus: Record<AloPageSection, AppMenu> = {
  mira: {
    name: "Mira",
    subtitle: "Alo · KI für Alltag und Ideen",
    groupLabel: "Mira-Bereiche",
    Icon: Bot,
    quickActions: [
      { id: "mira-new-chat", label: "Neuer Chat", Icon: Plus, command: "mira-new-chat" },
    ],
    items: [
      {
        id: "mira-view-chat",
        label: "Mira-Chat",
        Icon: MessageCircle,
        command: "mira-view-chat",
      },
      {
        id: "mira-view-history",
        label: "Gesprächsverlauf",
        Icon: Activity,
        command: "mira-view-history",
      },
      {
        id: "mira-view-tasks",
        label: "Aufgaben & Beispiele",
        Icon: MessageSquarePlus,
        command: "mira-view-tasks",
      },
      {
        id: "mira-open-settings",
        label: "KI-Einstellungen",
        Icon: Settings2,
        command: "mira-open-settings",
      },
    ],
  },
  nexus: {
    name: "Nexus",
    subtitle: "Alo · Räume und Direktnachrichten",
    groupLabel: "Nexus Chat",
    Icon: MessageCircle,
    quickActions: [
      {
        id: "nexus-new-room",
        label: "Neuer Raum",
        Icon: MessageSquarePlus,
        command: "nexus-new-room",
      },
      { id: "nexus-new-dm", label: "Neue Direktnachricht", Icon: Plus, command: "nexus-new-dm" },
    ],
    items: [
      {
        id: "nexus-open-list",
        label: "Chats & Räume",
        Icon: MessageCircle,
        command: "nexus-open-list",
      },
      {
        id: "nexus-open-search",
        label: "Nachrichten suchen",
        Icon: Search,
        command: "nexus-open-search",
      },
      {
        id: "nexus-export-current",
        label: "Aktiven Chat exportieren",
        Icon: Activity,
        command: "nexus-export-current",
      },
    ],
  },
  health: {
    name: "Alo Health",
    subtitle: "Aktivität, Schlaf und Wohlbefinden",
    groupLabel: "Gesundheitsbereiche",
    Icon: HeartPulse,
    quickActions: [
      { id: "health-entry", label: "Werte erfassen", Icon: Plus, href: "#health-entry" },
      {
        id: "health-connect",
        label: "Datenquelle verbinden",
        Icon: Watch,
        href: "#health-sources",
      },
    ],
    items: [
      { id: "health-today", label: "Heute", Icon: HeartPulse, href: "#health-today" },
      { id: "health-activity", label: "Aktivität", Icon: Activity, href: "#health-activity" },
      { id: "health-sleep", label: "Schlaf & Erholung", Icon: Moon, href: "#health-sleep" },
      { id: "health-sources", label: "Datenquellen", Icon: Watch, href: "#health-sources" },
    ],
  },
};

type AloPageSidebarProps = {
  active: AloPageSection;
  children: ReactNode;
};

export function AloPageSidebar({ active, children }: AloPageSidebarProps) {
  const [activeItem, setActiveItem] = useState<string>();
  const commandsRef = useRef<AloPageSidebarCommands>({});
  const registerCommands = useCallback<SidebarCommandRegistration>((commands, selected) => {
    commandsRef.current = commands;
    setActiveItem(selected);
  }, []);

  return (
    <SidebarCommandContext.Provider value={registerCommands}>
      <SidebarProvider
        className="alo-page-sidebar-provider"
        style={{ "--sidebar-width": "clamp(12rem, 16vw, 16rem)" } as CSSProperties}
      >
        <Sidebar collapsible="offcanvas" className="alo-page-sidebar">
          <AloPageNavigation active={active} activeItem={activeItem} commandsRef={commandsRef} />
        </Sidebar>
        <div className="alo-page-sidebar-content">{children}</div>
      </SidebarProvider>
    </SidebarCommandContext.Provider>
  );
}

function AloPageNavigation({
  active,
  activeItem,
  commandsRef,
}: {
  active: AloPageSection;
  activeItem?: string;
  commandsRef: { current: AloPageSidebarCommands };
}) {
  const { setOpenMobile } = useSidebar();
  const menu = appMenus[active];

  const runCommand = (id: AloSidebarCommand) => {
    commandsRef.current[id]?.();
    setOpenMobile(false);
  };

  const renderEntries = (entries: MenuEntry[], quick = false) =>
    entries.map(({ id, label, Icon, command, href }) => {
      const isActive = activeItem === id;
      const className = `alo-page-sidebar-link${quick ? " alo-page-sidebar-quick-action" : ""}`;
      return (
        <SidebarMenuItem key={id}>
          <SidebarMenuButton
            asChild
            size="lg"
            isActive={isActive}
            tooltip={label}
            className={className}
          >
            {command ? (
              <button
                type="button"
                data-alo-sidebar-action={id}
                aria-current={isActive ? "page" : undefined}
                onClick={() => runCommand(command)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ) : (
              <a
                href={href}
                aria-current={isActive ? "location" : undefined}
                onClick={() => setOpenMobile(false)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </a>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <nav
      id="alo-page-sidebar-navigation"
      aria-label={`${menu.name}-Menü`}
      className="alo-page-sidebar-nav"
      data-app={active}
    >
      <SidebarHeader className="alo-page-sidebar-header">
        <Link
          to="/"
          className="alo-page-sidebar-brand"
          aria-label="Zur Alo-Startseite"
          onClick={() => setOpenMobile(false)}
        >
          <span className="alo-page-sidebar-mark" aria-hidden="true">
            <menu.Icon />
          </span>
          <span className="alo-page-sidebar-brand-copy">
            <strong>{menu.name}</strong>
            <small>{menu.subtitle}</small>
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
        {menu.quickActions.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Schnellzugriff</SidebarGroupLabel>
            <SidebarMenu>{renderEntries(menu.quickActions, true)}</SidebarMenu>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>{menu.groupLabel}</SidebarGroupLabel>
          <SidebarMenu>{renderEntries(menu.items)}</SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="alo-page-sidebar-footer">
        <Link to="/" onClick={() => setOpenMobile(false)}>
          <House aria-hidden="true" />
          <span>Alle Apps</span>
        </Link>
        <Link to="/profile" onClick={() => setOpenMobile(false)}>
          <Settings2 aria-hidden="true" />
          <span>Einstellungen</span>
        </Link>
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
