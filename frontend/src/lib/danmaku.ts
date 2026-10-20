import type { ContentAuthor, UserIdentity } from './user';

export type DanmakuMode = 'scroll' | 'top' | 'bottom';

export interface DanmakuItem {
  id: string;
  text: string;
  time: number;
  mode: DanmakuMode;
  color: string;
  size: 18 | 24 | 32;
  createdAt: string;
  userId: string;
  videoId: string;
  user: ContentAuthor;
}

export type DanmakuUser = UserIdentity;

export interface DanmakuPreferences {
  visible: boolean;
  opacity: number;
}

export const DANMAKU_PREFERENCES_KEY = 'vault-danmaku-preferences-v1';
export const DEFAULT_DANMAKU_PREFERENCES: DanmakuPreferences = {
  visible: true,
  opacity: 0.9,
};

export function readDanmakuPreferences(): DanmakuPreferences {
  try {
    const value = window.localStorage.getItem(DANMAKU_PREFERENCES_KEY);
    if (!value) return DEFAULT_DANMAKU_PREFERENCES;

    const parsed = JSON.parse(value) as Partial<DanmakuPreferences>;
    return {
      visible: typeof parsed.visible === 'boolean' ? parsed.visible : true,
      opacity: typeof parsed.opacity === 'number'
        ? Math.min(1, Math.max(0.2, parsed.opacity))
        : DEFAULT_DANMAKU_PREFERENCES.opacity,
    };
  } catch {
    return DEFAULT_DANMAKU_PREFERENCES;
  }
}

export function writeDanmakuPreferences(preferences: DanmakuPreferences) {
  try {
    window.localStorage.setItem(DANMAKU_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are optional; playback must continue if storage is unavailable.
  }
}

export function mergeDanmaku(current: DanmakuItem[], incoming: DanmakuItem[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => a.time - b.time || a.createdAt.localeCompare(b.createdAt));
}

export function formatDanmakuTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
