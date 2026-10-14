import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const requestHeaders = await headers();
  const languages = (requestHeaders.get("accept-language") ?? "")
    .split(",")
    .map((part) => {
      const [tag, quality] = part.trim().toLowerCase().split(";q=");
      const q = quality === undefined ? 1 : Number(quality);
      return { locale: tag?.split("-")[0], quality: Number.isFinite(q) ? q : 0 };
    })
    .filter((item) => item.quality > 0)
    .sort((a, b) => b.quality - a.quality);
  redirect(languages.find((item) => item.locale === "es") ? "/es" : "/en");
}
