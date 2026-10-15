/**
 * 存档：3 个手动存档位 + 1 个自动存档位
 * 存的东西 = 引擎状态（当前节点 id + 场景状态：背景 / BGM / 台上立绘）
 */
import type { EngineState } from '../engine/types';

/** 存档位 id */
export type SlotId = 'slot1' | 'slot2' | 'slot3' | 'auto';

/** 所有存档位（界面上按这个顺序显示） */
export const SLOT_IDS: SlotId[] = ['slot1', 'slot2', 'slot3', 'auto'];

/** 存档位显示名 */
export const SLOT_LABELS: Record<SlotId, string> = {
  slot1: '存档 1',
  slot2: '存档 2',
  slot3: '存档 3',
  auto: '自动存档',
};

/** 一条存档 */
export type SaveData = {
  slotId: SlotId;
  /** 保存时间 ISO */
  savedAt: string;
  /** 存档界面展示用：场景名 / 当前台词 / 说话人 */
  sceneName: string;
  speakerName: string;
  text: string;
  /** 引擎状态（读档就是把它塞回引擎） */
  state: EngineState;
};

/** 作品标题 -> localStorage key slug */
function slugify(title: string): string {
  return (
    title
      .trim()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
      .slice(0, 40) || 'untitled'
  );
}

/** 每个作品一套存档，避免同一台电脑上多个游戏互相覆盖 */
export function saveStorageKey(storyTitle: string): string {
  return `galgame.saves.v1.${slugify(storyTitle)}`;
}

/** 读取全部存档 */
export function loadSaves(storyTitle: string): Partial<Record<SlotId, SaveData>> {
  try {
    const raw = localStorage.getItem(saveStorageKey(storyTitle));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<SlotId, SaveData>>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

/** 写入一个存档位 */
export function writeSave(
  storyTitle: string,
  data: SaveData,
): { ok: boolean; message?: string } {
  try {
    const all = loadSaves(storyTitle);
    all[data.slotId] = data;
    localStorage.setItem(saveStorageKey(storyTitle), JSON.stringify(all));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: String(error) };
  }
}

/** 删除一个存档位 */
export function deleteSave(storyTitle: string, slotId: SlotId): void {
  try {
    const all = loadSaves(storyTitle);
    delete all[slotId];
    localStorage.setItem(saveStorageKey(storyTitle), JSON.stringify(all));
  } catch {
    // 忽略
  }
}

/** 是否存在任何存档（决定标题画面的"读取存档"是否可用） */
export function hasAnySave(storyTitle: string): boolean {
  return Object.keys(loadSaves(storyTitle)).length > 0;
}

/**
 * 已解锁的结局：单独记录，打通立即解锁、删存档也不丢。
 *
 * localStorage key 里的"身份"用 meta.gameId（导出时由编辑器生成的唯一 ID），
 * 没有 gameId 时退回作品标题 —— 这样：
 * - 每次导出都是新 gameId → 新导出的游戏一打开结局全是锁定，不同批次互不污染；
 * - 同一份导出的游戏里，解锁记录独立于存档存在。
 */
function endingsIdentity(meta: { gameId?: string; title: string }): string {
  return meta.gameId || meta.title;
}

export function loadReachedEndings(meta: { gameId?: string; title: string }): string[] {
  try {
    const raw = localStorage.getItem(`galgame.endings.v1.${slugify(endingsIdentity(meta))}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addReachedEnding(meta: { gameId?: string; title: string }, endingId: string): string[] {
  const current = loadReachedEndings(meta);
  const next = current.includes(endingId) ? current : [...current, endingId];
  try {
    localStorage.setItem(`galgame.endings.v1.${slugify(endingsIdentity(meta))}`, JSON.stringify(next));
  } catch {
    // 忽略（比如浏览器隐私模式禁写）
  }
  return next;
}
