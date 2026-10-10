import Link from "next/link";
import { HullSwatch } from "@/components/ui/HullSwatch";
import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth";
import { listMyGroups } from "@/server/db/groups";

export async function RailGroups({ locale }: { locale: Locale }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const groups = await listMyGroups(user.id);
  return (
    <ul className="flex flex-col">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/${locale}/groups/${group.id}`}
            className="flex items-center gap-3 rounded-md px-1 py-1.5 text-[0.9375rem] font-semibold"
          >
            <HullSwatch hull={group.hull} />
            <span className="truncate">{group.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RailGroupsSkeleton() {
  return (
    <ul className="flex flex-col gap-2 py-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="bg-rail-deep/60 h-6 animate-pulse rounded" />
      ))}
    </ul>
  );
}
