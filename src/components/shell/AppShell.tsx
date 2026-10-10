import { Plus, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { LanguageSwitch } from "./LanguageSwitch";
import { NAV } from "./nav";
import { NavLink } from "./NavLink";
import { ThemeSwitch } from "./ThemeSwitch";

export type ShellGroup = { id: string; name: string; hull: "band" | "action" | "surface" | "debt" };

const HULL: Record<ShellGroup["hull"], string> = {
  band: "bg-band",
  action: "bg-action",
  surface: "bg-rail-ink",
  debt: "bg-debt",
};

/** A group's colour, painted as a little hull with a raised bow. */
function HullSwatch({ hull }: { hull: ShellGroup["hull"] }) {
  return (
    <i
      aria-hidden
      className={`block h-4 w-8 shrink-0 ${HULL[hull]}`}
      style={{ clipPath: "polygon(0 0, 100% 0, 82% 100%, 0 100%)" }}
    />
  );
}

function Wordmark({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <span className={`display block uppercase ${size === "lg" ? "text-[2.125rem]" : "text-2xl"}`}>
      Pesut{size === "lg" ? <br /> : " "}
      <span className="text-band">Tagih</span>
    </span>
  );
}

export function AppShell({
  locale,
  t,
  groups,
  activeGroupId,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  groups: ShellGroup[];
  activeGroupId?: string;
  children: ReactNode;
}) {
  const href = (path: string) => `/${locale}${path}`;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop rail */}
      <aside className="bg-rail text-rail-ink sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto px-5 py-7 lg:flex">
        <Link href={href("/home")} className="block rounded-md">
          <Wordmark />
          <span className="hull-stripe mt-4 block" aria-hidden />
        </Link>

        <nav aria-label={t.nav.menu} className="flex flex-col gap-1">
          {NAV.map(({ key, path, icon: Icon }) => (
            <NavLink
              key={key}
              href={href(path)}
              className="text-rail-ink-soft hover:text-rail-ink flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] font-semibold transition-colors"
              activeClassName="!bg-rail-deep !text-rail-ink"
            >
              <Icon className="size-[18px]" strokeWidth={2.25} aria-hidden />
              {t.nav[key]}
            </NavLink>
          ))}
        </nav>

        <div>
          <h2 className="text-rail-ink-soft mb-2 text-xs font-bold tracking-[0.12em] uppercase">
            {t.nav.groups}
          </h2>
          <ul className="flex flex-col">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={href(`/groups/${group.id}`)}
                  aria-current={group.id === activeGroupId ? "true" : undefined}
                  className="aria-[current]:decoration-band flex items-center gap-3 rounded-md px-1 py-1.5 text-[0.9375rem] font-semibold aria-[current]:underline aria-[current]:decoration-2"
                >
                  <HullSwatch hull={group.hull} />
                  {group.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={href("/groups/new")}
                className="text-rail-ink-soft hover:text-rail-ink mt-1 flex items-center gap-3 rounded-md px-1 py-1.5 text-sm font-semibold"
              >
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                {t.nav.newGroup}
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <ThemeSwitch />
          <LanguageSwitch />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="bg-rail text-rail-ink sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden">
        <Link href={href("/home")} className="rounded-md">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitch />
          <Link
            href={href("/settings")}
            aria-label={t.nav.settings}
            className="text-rail-ink-soft hover:text-rail-ink grid size-9 place-items-center rounded-md"
          >
            <Settings className="size-5" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
      </header>

      <div className="pb-24 lg:pb-0">{children}</div>

      {/* Mobile bottom bar: four destinations around the one action people come for. */}
      <nav
        aria-label={t.nav.menu}
        className="border-line-strong bg-surface fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t-2 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        {NAV.slice(0, 2).map(({ key, path, icon: Icon }) => (
          <MobileTab
            key={key}
            href={href(path)}
            label={t.nav[key]}
            icon={<Icon className="size-5" strokeWidth={2.25} aria-hidden />}
          />
        ))}
        <Link
          href={href("/expenses/new")}
          className="border-line-strong bg-action text-action-ink mx-auto -mt-6 grid size-14 place-items-center rounded-full border-2"
          aria-label={t.actions.addExpense}
        >
          <Plus className="size-7" strokeWidth={2.75} aria-hidden />
        </Link>
        {NAV.slice(2, 4).map(({ key, path, icon: Icon }) => (
          <MobileTab
            key={key}
            href={href(path)}
            label={t.nav[key]}
            icon={<Icon className="size-5" strokeWidth={2.25} aria-hidden />}
          />
        ))}
      </nav>
    </div>
  );
}

function MobileTab({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      href={href}
      className="text-muted flex flex-col items-center gap-0.5 rounded-md py-1 text-[0.6875rem] font-bold"
      activeClassName="!text-ink"
    >
      {icon}
      {label}
    </NavLink>
  );
}
