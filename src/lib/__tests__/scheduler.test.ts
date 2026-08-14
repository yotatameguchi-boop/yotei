import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSchedule } from "../scheduler";
import { splitGoalIntoSubtasks } from "../task-splitter";
import { createId, type Goal, type Habit } from "../types";

function makeRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

describe("splitGoalIntoSubtasks", () => {
  it("splits a goal into evenly sized chunks", () => {
    const goal: Goal = {
      id: createId(),
      title: "Study",
      description: "",
      totalMinutes: 180,
      deadline: new Date().toISOString(),
      chunkMinutes: 60,
      priority: 1,
      subtasks: [],
    };

    const subtasks = splitGoalIntoSubtasks(goal);
    assert.equal(subtasks.length, 3);
    assert.equal(subtasks[0]?.estimatedMinutes, 60);
    assert.equal(subtasks[2]?.estimatedMinutes, 60);
  });

  it("keeps existing subtasks when present", () => {
    const existing = [
      {
        id: createId(),
        title: "Custom",
        estimatedMinutes: 30,
        completed: false,
      },
    ];
    const goal: Goal = {
      id: createId(),
      title: "Study",
      description: "",
      totalMinutes: 180,
      deadline: new Date().toISOString(),
      chunkMinutes: 60,
      priority: 1,
      subtasks: existing,
    };

    assert.deepEqual(splitGoalIntoSubtasks(goal), existing);
  });
});

describe("generateSchedule", () => {
  it("places habits in preferred time windows", () => {
    const range = makeRange();
    const habit: Habit = {
      id: createId(),
      name: "Morning run",
      durationMinutes: 30,
      preferredTime: "morning",
      days: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    };

    const result = generateSchedule({
      habits: [habit],
      goals: [],
      googleEvents: [],
      rangeStart: range.start,
      rangeEnd: range.end,
    });

    assert.ok(result.scheduled.length >= 1);
    const first = result.scheduled[0];
    assert.equal(first?.kind, "habit");
    assert.ok(new Date(first!.start).getHours() >= 7);
    assert.ok(new Date(first!.start).getHours() < 12);
  });

  it("avoids overlapping google events", () => {
    const range = makeRange();
    const day = new Date();
    day.setHours(10, 0, 0, 0);

    const eventEnd = new Date(day);
    eventEnd.setHours(12, 0, 0, 0);

    const habit: Habit = {
      id: createId(),
      name: "Work block",
      durationMinutes: 60,
      preferredTime: "morning",
      days: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    };

    const result = generateSchedule({
      habits: [habit],
      goals: [],
      googleEvents: [
        {
          id: "busy",
          title: "Meeting",
          start: day.toISOString(),
          end: eventEnd.toISOString(),
          source: "google",
        },
      ],
      rangeStart: range.start,
      rangeEnd: range.end,
    });

    for (const block of result.scheduled) {
      const start = new Date(block.start).getTime();
      const end = new Date(block.end).getTime();
      const busyStart = day.getTime();
      const busyEnd = eventEnd.getTime();
      const overlaps = start < busyEnd && busyStart < end;
      assert.equal(overlaps, false);
    }
  });

  it("schedules task subtasks before deadline", () => {
    const range = makeRange();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 5);
    deadline.setHours(23, 0, 0, 0);

    const goal: Goal = {
      id: createId(),
      title: "Build feature",
      description: "",
      totalMinutes: 120,
      deadline: deadline.toISOString(),
      chunkMinutes: 60,
      priority: 1,
      subtasks: [],
    };

    const result = generateSchedule({
      habits: [],
      goals: [goal],
      googleEvents: [],
      rangeStart: range.start,
      rangeEnd: range.end,
    });

    assert.ok(result.scheduled.length >= 2);
    for (const block of result.scheduled) {
      assert.ok(new Date(block.end) <= deadline);
    }
  });
});
