import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { RailGroups, RailGroupsSkeleton } from "@/components/shell/RailGroups";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function AppLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <AppShell
      locale={lang}
      t={t}
      groupsSlot={
        <Suspense fallback={<RailGroupsSkeleton />}>
          <RailGroups locale={lang} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
