import type { ChatViewSummaryPanelVariant } from "@/v4/legacyChatViewTypes.js";
import { DEFAULT_TRANSCRIPT_WIDTH, type TranscriptWidth } from "@/lib/transcriptWidth.js";

const CONVERSATION_DRAFT_CONTENT_WIDTH_CLASS_NAME = "max-w-2xl";
// 正文列宽度三档。Tailwind 只能静态扫描完整类名，所以每档都写成字面量。
// - 864px 起左侧 turn navigator 占 3rem，正文两侧各留 3rem（calc(100% - 6rem)）。
// - 1280px 起右侧状态面板 inline 展开（w-80 + 左移 10.5rem），带面板时须留出 24rem。
// - medium 与改动前的固定宽度逐字一致，是默认档。
// - narrow 固定上限 42rem（与草稿态输入框同宽），窄窗口下仍是 w-full，不会溢出。
// - wide 沿用相同留白，只把上限放宽到 96rem，避免超宽屏行长失控。
const CONVERSATION_CONTENT_WIDTH_CLASS_NAMES: Record<
  TranscriptWidth,
  { withStatusPanel: string; withoutStatusPanel: string }
> = {
  narrow: {
    withStatusPanel: "w-full max-w-2xl",
    withoutStatusPanel: "w-full max-w-2xl",
  },
  medium: {
    withStatusPanel:
      "w-full @min-[864px]/conversation:w-[calc(100%_-_6rem)] @min-[864px]/conversation:max-w-4xl @min-[1280px]/conversation:w-[calc(100%_-_24rem)] @min-[1280px]/conversation:max-w-6xl",
    withoutStatusPanel:
      "w-full @min-[864px]/conversation:w-[calc(100%_-_6rem)] @min-[864px]/conversation:max-w-4xl @min-[1280px]/conversation:w-[calc(100%_-_24rem)] @min-[1280px]/conversation:max-w-6xl",
  },
  wide: {
    withStatusPanel:
      "w-full @min-[864px]/conversation:w-[calc(100%_-_6rem)] @min-[864px]/conversation:max-w-[96rem] @min-[1280px]/conversation:w-[calc(100%_-_24rem)]",
    withoutStatusPanel:
      "w-full @min-[864px]/conversation:w-[calc(100%_-_6rem)] @min-[864px]/conversation:max-w-[96rem]",
  },
};
const CONVERSATION_STATUS_PANEL_WIDE_OFFSET_CLASS_NAME =
  "@min-[1280px]/conversation:-translate-x-42";

type ConversationStatusPanelResolvedVariant = ChatViewSummaryPanelVariant | "auto";

export function getConversationContentWidthClassName(params: {
  centeredEmptyLayout: boolean;
  statusPanelLayout: "none" | "auto" | "inline";
  transcriptWidth?: TranscriptWidth;
}): string {
  if (params.centeredEmptyLayout) return CONVERSATION_DRAFT_CONTENT_WIDTH_CLASS_NAME;

  const classNames =
    CONVERSATION_CONTENT_WIDTH_CLASS_NAMES[params.transcriptWidth ?? DEFAULT_TRANSCRIPT_WIDTH];
  // 宽布局统一使用 1280px，避免面板状态变化时触发不同断点造成内容列跳变。
  return params.statusPanelLayout === "none"
    ? classNames.withoutStatusPanel
    : classNames.withStatusPanel;
}

export function resolveConversationStatusPanelVariant(params: {
  variantOverride: ConversationStatusPanelResolvedVariant | null;
}): ConversationStatusPanelResolvedVariant {
  // 自动模式必须保留到 DOM，由 conversation container query 裁决实际形态；
  // React 不再通过 ResizeObserver 把容器宽度翻译成业务状态。
  return params.variantOverride ?? "auto";
}

export function shouldUseConversationStatusPanelInlineLayout(params: {
  hasContent: boolean;
  variant: ConversationStatusPanelResolvedVariant;
}): boolean {
  return params.hasContent && params.variant !== "mini";
}

export function getConversationStatusPanelOffsetClassName(
  layout: "none" | "auto" | "inline",
): string | undefined {
  // 状态面板和会话宽布局统一在 1280px 启用，保证面板状态切换不改变响应分水岭。
  return layout === "none" ? undefined : CONVERSATION_STATUS_PANEL_WIDE_OFFSET_CLASS_NAME;
}
