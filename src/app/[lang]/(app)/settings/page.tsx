import { LogOut, Star, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddMethodForm } from "@/components/settings/AddMethodForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { QrisUpload } from "@/components/settings/QrisUpload";
import { LanguageSwitch } from "@/components/shell/LanguageSwitch";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";
import { buttonClass } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { providerName } from "@/domain/providers";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { getDictionary } from "@/i18n/get-dictionary";
import { signOut } from "@/server/actions/auth";
import { makePrimaryMethod, removePaymentMethod } from "@/server/actions/profile";
import { requireUser } from "@/server/auth";
import { getProfile, listPaymentMethods } from "@/server/db/profile";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/settings">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).settings.title };
}

export default async function SettingsPage({ params }: PageProps<"/[lang]/settings">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto grid max-w-4xl gap-5 px-4 py-6 sm:px-8 lg:gap-7 lg:py-10">
      <h1 className="display text-[2.5rem] uppercase sm:text-[3rem]">{t.settings.title}</h1>
      <Suspense
        fallback={<div className="bg-surface-sunk h-96 animate-pulse rounded-[10px]" aria-hidden />}
      >
        <SettingsContent lang={lang} t={t} />
      </Suspense>
      <Panel aria-labelledby="appearance-title">
        <PanelTitle id="appearance-title">{t.settings.appearance}</PanelTitle>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">{t.theme.label}</span>
            <ThemeSwitch tone="surface" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">{t.language.label}</span>
            <LanguageSwitch tone="surface" />
          </div>
        </div>
      </Panel>
      <form action={signOut}>
        <input type="hidden" name="lang" value={lang} />
        <button type="submit" className={buttonClass("outline")}>
          <LogOut className="size-4" aria-hidden />
          {t.settings.signOut}
        </button>
      </form>
    </main>
  );
}

async function SettingsContent({ lang, t }: { lang: Locale; t: Dictionary }) {
  const user = await requireUser(lang);
  const [profile, methods] = await Promise.all([
    getProfile(user.id),
    listPaymentMethods([user.id]),
  ]);
  if (!profile) notFound();

  return (
    <>
      <Panel aria-labelledby="profile-title">
        <PanelTitle id="profile-title">{t.settings.profile}</PanelTitle>
        <div className="mt-4">
          <ProfileForm name={profile.name} locale={profile.locale} />
        </div>
      </Panel>

      <Panel aria-labelledby="methods-title">
        <PanelTitle id="methods-title">{t.settings.methods}</PanelTitle>
        <p className="text-ink-soft mt-2 max-w-prose">{t.settings.methodsBody}</p>
        {methods.length === 0 ? (
          <p className="bg-band/25 mt-4 rounded-md px-3 py-2 text-sm font-semibold">
            {t.settings.noMethods}
          </p>
        ) : (
          <ul className="border-line mt-4 border-t-2">
            {methods.map((m, i) => (
              <li
                key={m.id}
                className="border-line flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {providerName(m.provider)}
                    {i === 0 && (
                      <span className="bg-band ml-2 rounded px-1.5 py-0.5 text-xs text-[#082f33]">
                        {t.settings.primary}
                      </span>
                    )}
                  </p>
                  <p className="text-ink-soft text-sm tabular-nums">
                    {m.accountNumber} · {m.accountName}
                  </p>
                </div>
                <QrisUpload methodId={m.id} hasQris={Boolean(m.qrisPath)} />
                {i > 0 && (
                  <form action={makePrimaryMethod}>
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className={buttonClass("ghost", "px-2 text-sm")}>
                      <Star className="size-4" aria-hidden />
                      {t.settings.makePrimary}
                    </button>
                  </form>
                )}
                <form action={removePaymentMethod}>
                  <input type="hidden" name="lang" value={lang} />
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className={buttonClass("ghost", "text-debt px-2 text-sm")}
                    aria-label={`${t.settings.remove} ${providerName(m.provider)}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5">
          <AddMethodForm defaultName={profile.name} />
        </div>
      </Panel>
    </>
  );
}
