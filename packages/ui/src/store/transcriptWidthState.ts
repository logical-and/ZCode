import { readSafeLocalStorage, writeSafeLocalStorage } from "@/lib/browserEnvironment.js";
import {
  normalizeTranscriptWidth,
  TRANSCRIPT_WIDTH_STORAGE_KEY,
  type TranscriptWidth,
} from "@/lib/transcriptWidth.js";

export interface TranscriptWidthState {
  /** 会话正文列宽度（消息、工具行与输入框共用） */
  transcriptWidth: TranscriptWidth;
  setTranscriptWidth: (width: TranscriptWidth) => void;
}

/**
 * 正文列宽度偏好：持久化到 localStorage，跨窗口同步由 store 的 BROADCAST_FIELDS 负责。
 * setter 统一归一化，广播收到的未知值也会回落到默认档。
 */
export function createTranscriptWidthSlice(
  set: (partial: Pick<TranscriptWidthState, "transcriptWidth">) => void,
): TranscriptWidthState {
  return {
    transcriptWidth: normalizeTranscriptWidth(readSafeLocalStorage(TRANSCRIPT_WIDTH_STORAGE_KEY)),
    setTranscriptWidth: (width) => {
      const transcriptWidth = normalizeTranscriptWidth(width);
      writeSafeLocalStorage(TRANSCRIPT_WIDTH_STORAGE_KEY, transcriptWidth);
      set({ transcriptWidth });
    },
  };
}
