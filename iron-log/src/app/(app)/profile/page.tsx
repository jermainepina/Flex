import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";
import { createClient } from "@/lib/supabase/server";
import { type WeightUnit } from "@/lib/units";

export default async function ProfilePage() {
  const supabase = await createClient();

  const [{ data: profile }, { data: latestWeigh }] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferred_unit, height_cm, birth_year, sex")
      .maybeSingle(),
    supabase
      .from("body_weight_logs")
      .select("date, weight_kg")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker="Body stats power your nutrition suggestions"
        titleA="Your"
        titleB="Profile"
      />
      <ProfileForm
        unit={unit}
        initialHeightCm={profile?.height_cm ?? null}
        initialBirthYear={profile?.birth_year ?? null}
        initialSex={
          profile?.sex === "male" || profile?.sex === "female" ? profile.sex : null
        }
        latestWeightKg={latestWeigh?.weight_kg ?? null}
        latestWeightDate={latestWeigh?.date ?? null}
      />
    </div>
  );
}
