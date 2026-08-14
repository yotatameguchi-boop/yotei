import type { ScheduledBlock } from "./types";

export function buildYoteiKey(block: Pick<ScheduledBlock, "kind" | "refId" | "start">): string {
  return `${block.kind}:${block.refId}:${block.start}`;
}

export const YOTEL_EVENT_PREFIX = "[予定] ";

export function yoteiEventTitle(title: string): string {
  return title.startsWith(YOTEL_EVENT_PREFIX) ? title : `${YOTEL_EVENT_PREFIX}${title}`;
}
