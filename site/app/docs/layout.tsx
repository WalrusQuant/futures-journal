import { DocSidebar } from "@/components/DocSidebar";
import { getDocsByCategory } from "@/lib/docs";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const groups = getDocsByCategory().map((g) => ({
    key: g.key,
    label: g.label,
    docs: g.docs.map((d) => ({ slugString: d.slugString, title: d.title })),
  }));

  return (
    <div className="container-page py-12">
      <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
          <DocSidebar groups={groups} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
