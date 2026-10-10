import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DevEmailSignIn } from "@/components/landing/DevEmailSignIn";
import { GoogleMark } from "@/components/landing/GoogleMark";
import { LandingPesut } from "@/components/landing/LandingPesut";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";
import { buttonClass } from "@/components/ui/Button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { signInWithGoogle } from "@/server/actions/auth";
import { getCurrentUser, safeNext } from "@/server/auth";
import { env } from "@/server/env";

export default async function Landing({ params, searchParams }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <div className="min-h-dvh">
      <header className="bg-rail text-rail-ink">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between px-4 py-4 sm:px-8 lg:px-10">
          <span className="display text-2xl uppercase">
            Pesut <span className="text-band">Tagih</span>
          </span>
          <div className="flex items-center gap-2">
            <ThemeSwitch />
            <LanguageSwitch />
          </div>
        </div>
        <span className="hull-stripe block" aria-hidden />
      </header>

      <main className="mx-auto max-w-[90rem] px-4 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-14">
        <Suspense>
          <SignedInRedirect lang={lang} />
        </Suspense>

        <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div>
            <h1 className="display text-[3.5rem] uppercase sm:text-[5rem] lg:text-[6rem]">
              {t.landing.headline}
            </h1>
            <p className="text-ink-soft mt-5 max-w-[34rem] text-lg">{t.landing.lede}</p>

            <Suspense>
              <SignInError searchParams={searchParams} message={t.landing.signinError} />
            </Suspense>

            <form action={signInWithGoogle} className="mt-8">
              <input type="hidden" name="lang" value={lang} />
              <Suspense fallback={<input type="hidden" name="next" value="" />}>
                <NextField searchParams={searchParams} lang={lang} />
              </Suspense>
              <button type="submit" className={buttonClass("primary", "min-h-13 px-6 text-base")}>
                <span className="grid size-7 place-items-center rounded-full bg-white">
                  <GoogleMark className="size-4" />
                </span>
                {t.landing.google}
              </button>
            </form>
            <p className="text-muted mt-3 text-sm font-semibold">{t.landing.privacy}</p>

            {env.DEV_EMAIL_LOGIN && (
              <Suspense>
                <DevEmailSignInSlot searchParams={searchParams} lang={lang} />
              </Suspense>
            )}
          </div>

          <LandingPesut />
        </section>

        <section aria-labelledby="problems" className="mt-16 lg:mt-24">
          <h2 id="problems" className="display text-[2.25rem] uppercase sm:text-[3rem]">
            {t.landing.problemsTitle}
          </h2>
          <ol className="border-line-strong mt-6 border-t-2">
            {t.landing.problems.map((row) => (
              <li
                key={row.problem}
                className="border-line grid gap-1 border-b-2 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8"
              >
                <p className="display text-debt text-2xl uppercase line-through decoration-2">
                  {row.problem}
                </p>
                <p className="text-ink text-[1.0625rem]">{row.answer}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

type Search = PageProps<"/[lang]">["searchParams"];

async function SignedInRedirect({ lang }: { lang: string }) {
  if (await getCurrentUser()) redirect(`/${lang}/home`);
  return null;
}

async function SignInError({ searchParams, message }: { searchParams: Search; message: string }) {
  const { error } = await searchParams;
  if (error !== "signin") return null;
  return (
    <p
      role="alert"
      className="border-debt text-debt mt-6 max-w-md rounded-md border-2 px-4 py-3 font-semibold"
    >
      {message}
    </p>
  );
}

async function NextField({ searchParams, lang }: { searchParams: Search; lang: string }) {
  const { next } = await searchParams;
  return (
    <input
      type="hidden"
      name="next"
      value={safeNext(typeof next === "string" ? next : null, `/${lang}/home`)}
    />
  );
}

async function DevEmailSignInSlot({ searchParams, lang }: { searchParams: Search; lang: string }) {
  const { next } = await searchParams;
  return (
    <DevEmailSignIn next={safeNext(typeof next === "string" ? next : null, `/${lang}/home`)} />
  );
}
