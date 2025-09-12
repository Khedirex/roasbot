import { Color, Thresholds, doesValueMatchColor } from "./colors";

export type Strategy = {
  id: string;
  name: string;
  active: boolean;
  startHour: string; // "HH:mm"
  endHour: string;   // "HH:mm"
  pattern: Color[];
  winAt: number;
  mgCount: number;
  thresholds?: Thresholds; // { blue?: 3.0, pink?: 1.4 }
};

export function patternMatches(values: number[], pattern: Color[], t: Thresholds = {}): boolean {
  const n = pattern.length;
  if (values.length < n) return false;
  const window = values.slice(-n);
  for (let i = 0; i < n; i++) {
    if (!doesValueMatchColor(window[i], pattern[i], t)) return false;
  }
  return true;
}

export function isStrategyActiveNow(strategy: Strategy, now = new Date()): boolean {
  if (!strategy.active) return false;
  const hhmm = (d: Date) => d.toTimeString().slice(0, 5);
  const cur = hhmm(now);
  return strategy.startHour <= cur && cur <= strategy.endHour;
}
