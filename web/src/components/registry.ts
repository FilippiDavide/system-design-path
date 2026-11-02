import type { ComponentType } from "react";
import { ch01Diagrams, ch01Labs } from "@/components/diagrams/ch01";
import { ch02Diagrams, ch02Labs } from "@/components/diagrams/ch02";
import { ch03Diagrams, ch03Labs } from "@/components/diagrams/ch03";
import { ch04Diagrams, ch04Labs } from "@/components/diagrams/ch04";
import { ch05Diagrams, ch05Labs } from "@/components/diagrams/ch05";
import { ch06Diagrams, ch06Labs } from "@/components/diagrams/ch06";
import { ch07Diagrams, ch07Labs } from "@/components/diagrams/ch07";
import { ch08Diagrams, ch08Labs } from "@/components/diagrams/ch08";
import { ch09Diagrams, ch09Labs } from "@/components/diagrams/ch09";
import { ch10Diagrams, ch10Labs } from "@/components/diagrams/ch10";
import { ch11Diagrams, ch11Labs } from "@/components/diagrams/ch11";
import { ch12Diagrams, ch12Labs } from "@/components/diagrams/ch12";
import { ch13Diagrams, ch13Labs } from "@/components/diagrams/ch13";
import { ch14Diagrams, ch14Labs } from "@/components/diagrams/ch14";

/**
 * A lab is an interactive component anchored after a section of the
 * summary. `afterSection` is the slugified heading text (see
 * `slugify` in lib/markdown.ts).
 */
export interface LabEntry {
  id: string;
  title: string;
  /** One line shown in the Labs index. */
  blurb: string;
  afterSection: string;
  component: ComponentType;
}

/**
 * Custom diagrams replace the Nth mermaid block of a chapter (0-based).
 * Anything not listed here falls back to a Mermaid render.
 */
export const DIAGRAMS: Record<string, Record<number, ComponentType>> = {
  ch01: ch01Diagrams,
  ch02: ch02Diagrams,
  ch03: ch03Diagrams,
  ch04: ch04Diagrams,
  ch05: ch05Diagrams,
  ch06: ch06Diagrams,
  ch07: ch07Diagrams,
  ch08: ch08Diagrams,
  ch09: ch09Diagrams,
  ch10: ch10Diagrams,
  ch11: ch11Diagrams,
  ch12: ch12Diagrams,
  ch13: ch13Diagrams,
  ch14: ch14Diagrams,
};

export const LABS: Record<string, LabEntry[]> = {
  ch01: ch01Labs,
  ch02: ch02Labs,
  ch03: ch03Labs,
  ch04: ch04Labs,
  ch05: ch05Labs,
  ch06: ch06Labs,
  ch07: ch07Labs,
  ch08: ch08Labs,
  ch09: ch09Labs,
  ch10: ch10Labs,
  ch11: ch11Labs,
  ch12: ch12Labs,
  ch13: ch13Labs,
  ch14: ch14Labs,
};
