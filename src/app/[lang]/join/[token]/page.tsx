import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { GoogleMark } from "@/components/landing/GoogleMark";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { signInWithGoogle } from "@/server/actions/auth";
import { acceptInvite } from "@/server/actions/groups";
import { getCurrentUser } from "@/server/auth";
import { peekInvite } from "@/server/db/groups";

export const metadata: Metadata = { robots: { index: false } };

export default async function JoinPage({
  params,
  searchParams,
}: PageProps<"/[lang]/join/[token]">) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <div className="min-h-dvh">
      <header className="bg-rail text-rail-ink px-4 py-4 sm:px-8">
        <span className="display text-2xl uppercase">
          Pesut <span className="text-band">Tagih</span>
        </span>
      </header>
      <span className="hull-stripe block" aria-hidden />
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-8">
        <Suspense
          fallback={
            <div className="bg-surface-sunk h-56 animate-pulse rounded-[10px]" aria-hidden />
          }
        >
          <JoinContent lang={lang} t={t} params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function JoinContent({
  lang,
  t,
  params,
  searchParams,
}: {
  lang: Locale;
  t: Dictionary;
  params: PageProps<"/[lang]/join/[token]">["params"];
  searchParams: PageProps<"/[lang]/join/[token]">["searchParams"];
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  const here = `/${lang}/join/${token}`;

  if (!user) {
    return (
      <Panel>
        <h1 className="display text-[2rem] uppercase">{t.join.signInFirst}</h1>
        <form action={signInWithGoogle} className="mt-5">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="next" value={here} />
          <button type="submit" className={buttonClass("primary")}>
            <span className="grid size-6 place-items-center rounded-full bg-white">
              <GoogleMark className="size-3.5" />
            </span>
            {t.landing.google}
          </button>
        </form>
      </Panel>
    );
  }

  const [invite, query] = await Promise.all([peekInvite(token), searchParams]);
  if (!invite || query.error) {
    return (
      <Panel>
        <p role="alert" className="text-debt font-semibold">
          {t.join.invalid}
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <h1 className="display text-[2.25rem] uppercase">
        {format(t.join.title, { group: invite.groupName })}
      </h1>
      <p className="text-ink-soft mt-3">{format(t.join.body, { count: invite.memberCount })}</p>
      <form action={acceptInvite} className="mt-6">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="token" value={token} />
        <button type="submit" className={buttonClass("primary")}>
          {t.join.accept}
        </button>
      </form>
    </Panel>
  );
}
