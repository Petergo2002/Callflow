import { Workspace } from "@/components/workspace";
import { notFound } from "next/navigation";
export function generateStaticParams() {
  return ["leads", "focus", "followups", "statistics", "settings"].map(
    (section) => ({ section }),
  );
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    !["leads", "focus", "followups", "statistics", "settings"].includes(section)
  )
    notFound();
  return <Workspace section={section} />;
}
