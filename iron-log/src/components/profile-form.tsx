"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfile } from "@/app/(app)/profile/actions";
import { cmToFeetInches, feetInchesToCm } from "@/lib/nutrition";
import { kgToUnit, unitToKg, type WeightUnit } from "@/lib/units";

// text-base on mobile so iOS doesn't auto-zoom focused inputs
const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700";

export function ProfileForm({
  unit,
  initialHeightCm,
  initialBirthYear,
  initialSex,
  latestWeightKg,
  latestWeightDate,
}: {
  unit: WeightUnit;
  initialHeightCm: number | null;
  initialBirthYear: number | null;
  initialSex: "male" | "female" | null;
  latestWeightKg: number | null;
  latestWeightDate: string | null;
}) {
  const router = useRouter();
  const imperial = unit === "lb";
  const initialFi = initialHeightCm !== null ? cmToFeetInches(initialHeightCm) : null;

  const [heightCm, setHeightCm] = useState(
    initialHeightCm !== null ? String(initialHeightCm) : "",
  );
  const [feet, setFeet] = useState(initialFi ? String(initialFi.feet) : "");
  const [inches, setInches] = useState(initialFi ? String(initialFi.inches) : "");
  const [weight, setWeight] = useState(
    latestWeightKg !== null
      ? String(Math.round(kgToUnit(latestWeightKg, unit) * 10) / 10)
      : "",
  );
  const [birthYear, setBirthYear] = useState(
    initialBirthYear !== null ? String(initialBirthYear) : "",
  );
  const [sex, setSex] = useState<string>(initialSex ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);

    let heightOut: number | null = null;
    if (imperial) {
      if (feet.trim() !== "" || inches.trim() !== "") {
        const f = parseInt(feet || "0", 10);
        const i = parseFloat(inches || "0");
        if (!Number.isFinite(f) || !Number.isFinite(i) || f < 0 || i < 0) {
          setError("Height looks off — enter it again.");
          return;
        }
        heightOut = feetInchesToCm(f, i);
      }
    } else if (heightCm.trim() !== "") {
      heightOut = parseFloat(heightCm);
    }

    const weightOut =
      weight.trim() === "" ? null : unitToKg(parseFloat(weight), unit);
    const birthYearOut = birthYear.trim() === "" ? null : parseInt(birthYear, 10);

    startSaving(async () => {
      const result = await updateProfile({
        heightCm: heightOut,
        birthYear: birthYearOut,
        sex: sex === "male" || sex === "female" ? sex : null,
        weightKg: weightOut,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm font-medium">
        Height
        {imperial ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={8}
              inputMode="numeric"
              placeholder="5"
              value={feet}
              onChange={(e) => setFeet(e.target.value)}
              className={`${inputClass} w-20`}
              aria-label="Height feet"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">ft</span>
            <input
              type="number"
              min={0}
              max={11}
              inputMode="numeric"
              placeholder="10"
              value={inches}
              onChange={(e) => setInches(e.target.value)}
              className={`${inputClass} w-20`}
              aria-label="Height inches"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">in</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder="178"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className={`${inputClass} w-28`}
              aria-label="Height in centimeters"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">cm</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm font-medium">
        Weight
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={`${inputClass} w-28`}
            aria-label={`Weight in ${unit}`}
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{unit}</span>
        </div>
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {latestWeightDate
            ? `Saving updates today's weigh-in · last logged ${latestWeightDate}`
            : "Saving records today's weigh-in — it also shows up in Stats."}
        </span>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Birth year
          <input
            type="number"
            min={1900}
            max={2100}
            inputMode="numeric"
            placeholder="1998"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className={`${inputClass} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Sex
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className={`${inputClass} bg-white dark:bg-zinc-950`}
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
      </div>
      <p className="-mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Birth year and sex are optional — used only to make calorie suggestions
        more accurate.
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-accent self-start px-4 py-2.5 text-sm"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
