/**
 * 编辑器项目数据结构（.galproj 的内容）
 * 与 story.json 的区别：项目文件额外保存素材二进制与节点图布局，
 * 而 story.json 只包含运行时需要的纯剧本数据。
 */
import type { EditorAsset, Story } from '@gal/shared';

/** 节点图上的坐标 */
export type NodePosition = { x: number; y: number };

/** 项目文件版本，将来做迁移用 */
export const PROJECT_FILE_VERSION = '1.0.0';

/** .galproj 项目文件结构 */
export type ProjectData = {
  fileVersion: string;
  /** 纯剧本数据 */
  story: Story;
  /** 素材 id -> 素材（含 dataURL 二进制） */
  assets: Record<string, EditorAsset>;
  /** 节点 id -> 画布坐标 */
  layout: Record<string, NodePosition>;
  /** 最后一次保存时间（ISO） */
  savedAt: string;
};

/** 新建空项目 */
export function createProject(story: Story): ProjectData {
  return {
    fileVersion: PROJECT_FILE_VERSION,
    story,
    assets: {},
    layout: {},
    savedAt: new Date().toISOString(),
  };
}
