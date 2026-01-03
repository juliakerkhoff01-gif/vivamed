import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "vivamed_streak_state_v1";
const SEEN_BADGES_KEY = "vivamed_seen_badges_v1";

export type DayState = {
  caseDone?: boolean;
  drillDone?: boolean;
  completed?: boolean;
};

export type BadgeId =
  | "first_goal"
  | "streak_3"
  | "streak_7"
  | "streak_14"
  | "streak_30"
  | "days_7"
  | "days_14"
  | "days_30";

export type BadgeDef = {
  id: BadgeId;
  title: string;
  description: string;
};

export type StreakState = {
  version: 1;
  lastCompletedDateKey?: string; // yyyy-mm-dd
  currentStreak: number;
  bestStreak: number;
  completedDaysTotal: number;
  days: Record<string, DayState>;
  unlockedBadges: Partial<Record<BadgeId, string>>; // badgeId -> dateKey
};

export type StreakSummary = {
  todayKey: string;
  today: DayState;
  currentStreak: number;
  bestStreak: number;
  completedDaysTotal: number;
  badges: { def: BadgeDef; unlockedOn?: string }[];
};

export type NewlyUnlockedBadge = { def: BadgeDef; unlockedOn: string };

const BADGES: BadgeDef[] = [
  { id: "first_goal", title: "Erster Haken", description: "Tagesziel zum ersten Mal erfüllt." },

  { id: "streak_3", title: "3er Streak", description: "3 Tage am Stück Tagesziel erfüllt." },
  { id: "streak_7", title: "7er Streak", description: "7 Tage am Stück Tagesziel erfüllt." },
  { id: "streak_14", title: "2 Wochen am Stück", description: "14 Tage am Stück Tagesziel erfüllt." },
  { id: "streak_30", title: "30er Streak", description: "30 Tage am Stück Tagesziel erfüllt." },

  { id: "days_7", title: "7 Tage aktiv", description: "An 7 Tagen insgesamt Tagesziel erfüllt." },
  { id: "days_14", title: "Konstanz 14", description: "An 14 Tagen insgesamt Tagesziel erfüllt." },
  { id: "days_30", title: "Konstanz 30", description: "An 30 Tagen insgesamt Tagesziel erfüllt." },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function dateKeyLocal(d = new Date()): string {
  // Lokalzeit (wichtig: NICHT toISOString, weil UTC!)
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map((x) => Number(x));
  // local noon, stabil bei DST
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function addDays(key: string, delta: number): string {
  const dt = parseKey(key);
  dt.setDate(dt.getDate() + delta);
  return dateKeyLocal(dt);
}

function defaultState(): StreakState {
  return {
    version: 1,
    currentStreak: 0,
    bestStreak: 0,
    completedDaysTotal: 0,
    days: {},
    unlockedBadges: {},
  };
}

export async function loadStreakState(): Promise<StreakState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw) as StreakState;
    if (!parsed || parsed.version !== 1) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      days: parsed.days ?? {},
      unlockedBadges: parsed.unlockedBadges ?? {},
    };
  } catch {
    return defaultState();
  }
}

async function saveStreakState(state: StreakState) {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

function syncBadges(state: StreakState, completedOnKey: string): boolean {
  let changed = false;

  const shouldUnlock: Partial<Record<BadgeId, boolean>> = {
    first_goal: state.completedDaysTotal >= 1,

    streak_3: state.bestStreak >= 3,
    streak_7: state.bestStreak >= 7,
    streak_14: state.bestStreak >= 14,
    streak_30: state.bestStreak >= 30,

    days_7: state.completedDaysTotal >= 7,
    days_14: state.completedDaysTotal >= 14,
    days_30: state.completedDaysTotal >= 30,
  };

  (Object.keys(shouldUnlock) as BadgeId[]).forEach((id) => {
    if (shouldUnlock[id] && !state.unlockedBadges[id]) {
      state.unlockedBadges[id] = completedOnKey;
      changed = true;
    }
  });

  return changed;
}

function ensureDay(state: StreakState, key: string): DayState {
  if (!state.days[key]) state.days[key] = {};
  return state.days[key];
}

function maybeCompleteDay(state: StreakState, key: string) {
  const day = ensureDay(state, key);
  if (day.completed) return;

  if (day.caseDone && day.drillDone) {
    day.completed = true;

    const prev = state.lastCompletedDateKey;
    const yesterday = addDays(key, -1);
    if (prev && prev === yesterday) state.currentStreak += 1;
    else state.currentStreak = 1;

    state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
    state.lastCompletedDateKey = key;

    state.completedDaysTotal += 1;

    syncBadges(state, key);
  }
}

export async function markCaseDone(dateKey = dateKeyLocal()): Promise<StreakState> {
  const state = await loadStreakState();
  const day = ensureDay(state, dateKey);

  if (!day.caseDone) {
    day.caseDone = true;
    maybeCompleteDay(state, dateKey);
    await saveStreakState(state);
  }
  return state;
}

export async function markDrillDone(dateKey = dateKeyLocal()): Promise<StreakState> {
  const state = await loadStreakState();
  const day = ensureDay(state, dateKey);

  if (!day.drillDone) {
    day.drillDone = true;
    maybeCompleteDay(state, dateKey);
    await saveStreakState(state);
  }
  return state;
}

export async function getStreakSummary(dateKey = dateKeyLocal()): Promise<StreakSummary> {
  const state = await loadStreakState();
  const today = ensureDay(state, dateKey);

  // IMPORTANT: neue Badge-Definitionen auch bei bestehendem Fortschritt "nachziehen"
  // damit sie sofort sichtbar sind (ohne neuen Completion-Tag abwarten zu müssen).
  const anchorKey = state.lastCompletedDateKey ?? dateKey;
  const changed = syncBadges(state, anchorKey);
  if (changed) {
    try {
      await saveStreakState(state);
    } catch {}
  }

  return {
    todayKey: dateKey,
    today,
    currentStreak: state.currentStreak,
    bestStreak: state.bestStreak,
    completedDaysTotal: state.completedDaysTotal,
    badges: BADGES.map((def) => ({ def, unlockedOn: state.unlockedBadges[def.id] })),
  };
}

/** -----------------------------
 * Badge Pop-up helpers (Seen/Unseen)
 * ------------------------------*/
async function loadSeenBadges(): Promise<Partial<Record<BadgeId, boolean>>> {
  const raw = await AsyncStorage.getItem(SEEN_BADGES_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? {}) as any;
  } catch {
    return {};
  }
}

async function saveSeenBadges(seen: Partial<Record<BadgeId, boolean>>) {
  await AsyncStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(seen));
}

export async function getUnseenUnlockedBadges(): Promise<NewlyUnlockedBadge[]> {
  const [summary, seen] = await Promise.all([getStreakSummary(), loadSeenBadges()]);
  return (summary.badges ?? [])
    .filter((b) => !!b.unlockedOn && !seen[b.def.id])
    .map((b) => ({ def: b.def, unlockedOn: b.unlockedOn! }));
}

export async function markBadgesSeen(ids: BadgeId[]) {
  const seen = await loadSeenBadges();
  ids.forEach((id) => {
    seen[id] = true;
  });
  await saveSeenBadges(seen);
}

// Optional Debug resets
export async function resetStreakState() {
  await AsyncStorage.removeItem(KEY);
}

export async function resetSeenBadges() {
  await AsyncStorage.removeItem(SEEN_BADGES_KEY);
}
