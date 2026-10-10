import {
  ArrowLeftRight,
  House,
  MessageCircle,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/id";

export type NavItem = { key: keyof Dictionary["nav"]; path: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { key: "home", path: "/home", icon: House },
  { key: "transfers", path: "/transfers", icon: ArrowLeftRight },
  { key: "activity", path: "/activity", icon: ScrollText },
  { key: "askPesut", path: "/chat", icon: MessageCircle },
  { key: "settings", path: "/settings", icon: Settings },
];
