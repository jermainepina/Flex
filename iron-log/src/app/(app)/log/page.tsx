import { LogStartForm } from "@/components/log-start-form";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pre-workout start page: pick a template/date/name and rest preset, then
 * launch into /log/active. Template-card links (`/log?template=<id>`) land
 * here with that template preselected.
 */
export default async function LogStartPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template: templateParam } = await searchParams;
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name")
    .order("name");

  const initialTemplateId =
    templateParam &&
    UUID_RE.test(templateParam) &&
    (templates ?? []).some((t) => t.id === templateParam)
      ? templateParam
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        titleA="Start"
        titleB="Workout"
      />
      <LogStartForm
        templates={templates ?? []}
        initialTemplateId={initialTemplateId}
      />
    </div>
  );
}
