import {
  ALL_DAYS,
  createId,
  type Goal,
  type Habit,
} from "./types";

export function createDemoHabits(): Habit[] {
  return [
    {
      id: createId(),
      name: "朝食",
      durationMinutes: 30,
      preferredTime: "morning",
      days: ALL_DAYS,
    },
    {
      id: createId(),
      name: "昼食",
      durationMinutes: 45,
      preferredTime: "afternoon",
      days: ALL_DAYS,
    },
    {
      id: createId(),
      name: "夕食",
      durationMinutes: 45,
      preferredTime: "evening",
      days: ALL_DAYS,
    },
    {
      id: createId(),
      name: "運動",
      durationMinutes: 30,
      preferredTime: "morning",
      days: ["monday", "wednesday", "friday"],
    },
  ];
}

export function createDemoGoals(): Goal[] {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 10);
  deadline.setHours(18, 0, 0, 0);

  return [
    {
      id: createId(),
      title: "ポートフォリオサイトを公開する",
      description: "デザイン・実装・デプロイまで完了させる",
      totalMinutes: 480,
      deadline: deadline.toISOString(),
      chunkMinutes: 90,
      priority: 1,
      subtasks: [],
    },
    {
      id: createId(),
      title: "英語学習（TOEIC対策）",
      description: "リスニングと語彙を重点的に",
      totalMinutes: 300,
      deadline: deadline.toISOString(),
      chunkMinutes: 60,
      priority: 2,
      subtasks: [],
    },
  ];
}

export function createDemoGoogleEvents() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const end = new Date(tomorrow);
  end.setHours(15, 30, 0, 0);

  return [
    {
      id: "demo-meeting",
      title: "チーム定例（デモ）",
      start: tomorrow.toISOString(),
      end: end.toISOString(),
      source: "google" as const,
      color: "#647880",
    },
  ];
}
