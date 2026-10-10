import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { groups } from "@/demo/circle";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function AppLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <AppShell locale={lang} t={t} groups={groups} activeGroupId="circle">
      {children}
    </AppShell>
  );
}
