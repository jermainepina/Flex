import { CardioSession } from "@/components/cardio-session";
import { PageHeader } from "@/components/page-header";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CardioPage({
  searchParams,
}: {
  searchParams: Promise<{ minutes?: string; date?: string; name?: string }>;
}) {
  const { minutes: minutesParam, date: dateParam, name: nameParam } = await searchParams;

  const parsed = Number(minutesParam);
  const minutes =
    Number.isInteger(parsed) && parsed >= 5 && parsed <= 600 ? parsed : 30;
  const date =
    dateParam && DATE_RE.test(dateParam)
      ? dateParam
      : new Date().toLocaleDateString("en-CA");
  const name = nameParam?.trim() ? nameParam.trim().slice(0, 100) : "Cardio";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        titleA="Cardio"
        titleB="Session"
      />
      <CardioSession initialMinutes={minutes} date={date} name={name} />
    </div>
  );
}
