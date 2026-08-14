"use client";

import {
  ALL_DAYS,
  DAY_LABELS,
  TIME_OF_DAY_LABELS,
  createId,
  type DayOfWeek,
  type Habit,
  type TimeOfDay,
} from "@/lib/types";

type HabitFormProps = {
  habits: Habit[];
  onChange: (habits: Habit[]) => void;
};

const DEFAULT_HABITS: Omit<Habit, "id">[] = [
  {
    name: "朝食",
    durationMinutes: 30,
    preferredTime: "morning",
    days: ALL_DAYS,
  },
  {
    name: "昼食",
    durationMinutes: 45,
    preferredTime: "afternoon",
    days: ALL_DAYS,
  },
  {
    name: "運動",
    durationMinutes: 30,
    preferredTime: "morning",
    days: ["monday", "wednesday", "friday"],
  },
];

export function HabitForm({ habits, onChange }: HabitFormProps) {
  function addHabit() {
    onChange([
      ...habits,
      {
        id: createId(),
        name: "新しい習慣",
        durationMinutes: 30,
        preferredTime: "any",
        days: ALL_DAYS,
      },
    ]);
  }

  function addDefaults() {
    onChange([
      ...habits,
      ...DEFAULT_HABITS.map((habit) => ({ ...habit, id: createId() })),
    ]);
  }

  function updateHabit(id: string, patch: Partial<Habit>) {
    onChange(habits.map((habit) => (habit.id === id ? { ...habit, ...patch } : habit)));
  }

  function removeHabit(id: string) {
    onChange(habits.filter((habit) => habit.id !== id));
  }

  function toggleDay(habit: Habit, day: DayOfWeek) {
    const days = habit.days.includes(day)
      ? habit.days.filter((entry) => entry !== day)
      : [...habit.days, day];
    updateHabit(habit.id, { days });
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">生活習慣</h2>
          <p className="text-sm text-[var(--muted)]">
            基礎的なルーティンにかける時間を登録します。
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={addDefaults}>
            例を追加
          </button>
          <button type="button" className="btn-primary text-sm" onClick={addHabit}>
            追加
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {habits.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">習慣がまだありません。</p>
        ) : null}

        {habits.map((habit) => (
          <div key={habit.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">名前</span>
                <input
                  className="field"
                  value={habit.name}
                  onChange={(event) => updateHabit(habit.id, { name: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">時間（分）</span>
                <input
                  className="field"
                  type="number"
                  min={5}
                  step={5}
                  value={habit.durationMinutes}
                  onChange={(event) =>
                    updateHabit(habit.id, {
                      durationMinutes: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium">希望時間帯</span>
                <select
                  className="field"
                  value={habit.preferredTime}
                  onChange={(event) =>
                    updateHabit(habit.id, {
                      preferredTime: event.target.value as TimeOfDay,
                    })
                  }
                >
                  {Object.entries(TIME_OF_DAY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`chip ${habit.days.includes(day) ? "bg-white" : "opacity-50"}`}
                  onClick={() => toggleDay(habit, day)}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-secondary mt-3 text-sm"
              onClick={() => removeHabit(habit.id)}
            >
              削除
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
