import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Figtree } from "next/font/google";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { I18nProvider } from "@/i18n/provider";
import { THEME_SCRIPT } from "@/lib/theme";
import "../globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-big-shoulders",
  display: "swap",
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return {
    title: { default: t.meta.title, template: `%s · ${t.meta.title}` },
    description: t.meta.description,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b5d5e" },
    { media: "(prefers-color-scheme: dark)", color: "#062a2c" },
  ],
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${display.variable} ${sans.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <I18nProvider value={{ locale: lang, t }}>{children}</I18nProvider>
      </body>
    </html>
  );
}
