/**
 * 会话正文列（消息、工具行、输入框）的宽度偏好。
 * medium 即此前固定的宽度，作为默认值，保证老用户升级后布局不变。
 */
export type TranscriptWidth = "narrow" | "medium" | "wide";

export const TRANSCRIPT_WIDTHS: readonly TranscriptWidth[] = ["wide", "medium", "narrow"];

export const DEFAULT_TRANSCRIPT_WIDTH: TranscriptWidth = "medium";

export const TRANSCRIPT_WIDTH_STORAGE_KEY = "zcode-transcript-width";

export function normalizeTranscriptWidth(value: unknown): TranscriptWidth {
  return value === "narrow" || value === "wide" ? value : DEFAULT_TRANSCRIPT_WIDTH;
}
