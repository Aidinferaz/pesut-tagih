import { redirect } from "next/navigation";

// Until sign-in exists, the root of each language opens the design preview.
export default async function LangRoot({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  redirect(`/${lang}/home`);
}
