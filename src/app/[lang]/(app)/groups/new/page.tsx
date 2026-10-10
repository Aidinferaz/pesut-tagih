import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CreateGroupForm } from "@/components/groups/CreateGroupForm";
import { Panel } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/server/auth";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/groups/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).groups.newTitle };
}

export default async function NewGroupPage({ params }: PageProps<"/[lang]/groups/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <h1 className="display mb-6 text-[2.5rem] uppercase sm:text-[3rem]">{t.groups.newTitle}</h1>
      <Panel>
        <Suspense>
          <SignedIn lang={lang} />
        </Suspense>
        <CreateGroupForm />
      </Panel>
    </main>
  );
}

async function SignedIn({ lang }: { lang: Locale }) {
  await requireUser(lang);
  return null;
}
