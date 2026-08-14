"use client";

import { splitGoalIntoSubtasks } from "@/lib/task-splitter";
import { createId, type Goal } from "@/lib/types";
import { formatDateInput } from "@/lib/storage";

type GoalFormProps = {
  goals: Goal[];
  onChange: (goals: Goal[]) => void;
};

export function GoalForm({ goals, onChange }: GoalFormProps) {
  function addGoal() {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    deadline.setHours(18, 0, 0, 0);

    onChange([
      ...goals,
      {
        id: createId(),
        title: "新しいゴール",
        description: "",
        totalMinutes: 180,
        deadline: deadline.toISOString(),
        chunkMinutes: 60,
        priority: goals.length + 1,
        subtasks: [],
      },
    ]);
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    onChange(
      goals.map((goal) => {
        if (goal.id !== id) {
          return goal;
        }

        const next = { ...goal, ...patch };
        if ("totalMinutes" in patch || "chunkMinutes" in patch || "title" in patch) {
          next.subtasks = splitGoalIntoSubtasks({ ...next, subtasks: [] });
        }
        return next;
      }),
    );
  }

  function removeGoal(id: string) {
    onChange(goals.filter((goal) => goal.id !== id));
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">ゴールとタスク</h2>
          <p className="text-sm text-[var(--muted)]">
            ゴールを分割し、空き時間に組み込みます。
          </p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={addGoal}>
          追加
        </button>
      </div>

      <div className="space-y-4">
        {goals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">ゴールがまだありません。</p>
        ) : null}

        {goals.map((goal) => {
          const subtasks = splitGoalIntoSubtasks(goal);
          return (
            <div key={goal.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-medium">ゴール名</span>
                  <input
                    className="field"
                    value={goal.title}
                    onChange={(event) => updateGoal(goal.id, { title: event.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-medium">説明</span>
                  <textarea
                    className="field min-h-20"
                    value={goal.description}
                    onChange={(event) =>
                      updateGoal(goal.id, { description: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">総時間（分）</span>
                  <input
                    className="field"
                    type="number"
                    min={15}
                    step={15}
                    value={goal.totalMinutes}
                    onChange={(event) =>
                      updateGoal(goal.id, { totalMinutes: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">1セッション（分）</span>
                  <input
                    className="field"
                    type="number"
                    min={15}
                    step={15}
                    value={goal.chunkMinutes}
                    onChange={(event) =>
                      updateGoal(goal.id, { chunkMinutes: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">期限</span>
                  <input
                    className="field"
                    type="datetime-local"
                    value={formatDateInput(goal.deadline)}
                    onChange={(event) =>
                      updateGoal(goal.id, {
                        deadline: new Date(event.target.value).toISOString(),
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">優先度</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    value={goal.priority}
                    onChange={(event) =>
                      updateGoal(goal.id, { priority: Number(event.target.value) })
                    }
                  />
                </label>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">自動分割タスク</p>
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  {subtasks.map((subtask) => (
                    <li key={subtask.id} className="chip mr-2 inline-flex">
                      {subtask.title} · {subtask.estimatedMinutes}分
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                className="btn-secondary mt-3 text-sm"
                onClick={() => removeGoal(goal.id)}
              >
                削除
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
