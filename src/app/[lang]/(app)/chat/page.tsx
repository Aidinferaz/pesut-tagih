import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PesutChat } from "@/components/chat/PesutChat";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { aiEnabled } from "@/server/ai/model";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: PageProps<"/[lang]/chat">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).chat.title };
}

export default async function ChatPage({ params }: PageProps<"/[lang]/chat">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto grid max-w-[90rem] gap-5 px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
      <h1 className="display text-[2.5rem] uppercase sm:text-[3rem]">{t.chat.title}</h1>
      <Suspense
        fallback={
          <div className="bg-surface-sunk h-[32rem] animate-pulse rounded-[10px]" aria-hidden />
        }
      >
        <SignedInChat lang={lang} />
      </Suspense>
    </main>
  );
}

async function SignedInChat({ lang }: { lang: Locale }) {
  await requireUser(lang);
  return <PesutChat enabled={aiEnabled()} />;
}
