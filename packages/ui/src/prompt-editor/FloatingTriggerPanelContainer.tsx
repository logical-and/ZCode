import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * 会话滚动区内编辑器（已发送消息的行内编辑）的 `/`、`@` 提示面板容器。
 *
 * 默认容器是贴在编辑器上沿的 absolute 条，面板向上展开；编辑首条消息时上方几乎没有空间，
 * 面板会被滚动区（overflow-y-auto）顶部裁切。这里把容器 portal 到 body 并用 fixed 定位，
 * 每次面板打开时优先放在上方（与底部 Composer 一致），上方放不下时改放下方，
 * 并把列表高度收紧到可见滚动区内剩余的空间，保证面板完整可见。
 */

type Side = "top" | "bottom";

/** 面板放在下方时与编辑器的间距（放在上方时由面板自身的 `mb-1` 留出）。 */
const PANEL_GAP_PX = 4;
/** `MentionPanel` 列表的默认最大高度（14rem）。 */
const LIST_MAX_PX = 224;
/** 列表可用高度低于该值时，即使已锁定方向也尝试换到另一侧。 */
const LIST_MIN_PX = 72;
/** `MentionPanel` 读取的列表最大高度 CSS 变量。 */
const TRIGGER_PANEL_LIST_MAX_HEIGHT_VAR = "--prompt-trigger-panel-list-max-height";

interface Bounds {
  top: number;
  bottom: number;
}

/** 会话时间线滚动容器（见 `ConversationTimeline`）。 */
const TIMELINE_SCROLLER_SELECTOR = '[data-v4-timeline-scroll="true"]';

/** 最近的、实际可纵向滚动的祖先元素。 */
function findScrollContainer(anchor: Element): Element | null {
  const timeline = anchor.closest(TIMELINE_SCROLLER_SELECTOR);
  if (timeline) {
    return timeline;
  }
  for (let node = anchor.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

/** 锚点所在滚动容器的可见纵向范围（再与窗口取交集）。 */
function resolveBounds(anchor: Element): Bounds {
  const viewport = { top: 0, bottom: window.innerHeight };
  const scroller = findScrollContainer(anchor);
  if (!scroller) {
    return viewport;
  }
  const rect = scroller.getBoundingClientRect();
  return { top: Math.max(viewport.top, rect.top), bottom: Math.min(viewport.bottom, rect.bottom) };
}

/** 面板除列表外的高度（说明、边框等）；列表高度单独限制。 */
function measurePanelChrome(container: HTMLElement): number {
  const list = container.querySelector<HTMLElement>('[role="listbox"]');
  return Math.max(0, container.offsetHeight - (list?.offsetHeight ?? 0));
}

export function FloatingTriggerPanelContainer({
  anchorRef,
  onContainerChange,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onContainerChange: (container: HTMLDivElement | null) => void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    onContainerChange(container);
    return () => onContainerChange(null);
  }, [container, onContainerChange]);

  useEffect(() => {
    if (!container) {
      return;
    }
    // 面板打开时选定的方向；打开期间保持不变，避免输入过滤导致列表高度变化时上下来回跳。
    let lockedSide: Side | null = null;
    let frameId: number | null = null;

    const update = () => {
      frameId = null;
      const anchor = anchorRef.current;
      if (!anchor || container.childElementCount === 0) {
        lockedSide = null;
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const bounds = resolveBounds(anchor);
      const chrome = measurePanelChrome(container);
      const spaceAbove = anchorRect.top - bounds.top - PANEL_GAP_PX;
      const spaceBelow = bounds.bottom - anchorRect.bottom - PANEL_GAP_PX;
      const needed = chrome + LIST_MAX_PX;

      let side: Side =
        lockedSide ??
        (spaceAbove >= needed
          ? "top"
          : spaceBelow >= needed
            ? "bottom"
            : spaceAbove >= spaceBelow
              ? "top"
              : "bottom");
      const sideSpace = (s: Side) => (s === "top" ? spaceAbove : spaceBelow);
      const otherSide: Side = side === "top" ? "bottom" : "top";
      if (sideSpace(side) < chrome + LIST_MIN_PX && sideSpace(otherSide) > sideSpace(side)) {
        side = otherSide;
      }
      lockedSide = side;

      const listMax = Math.max(0, Math.min(LIST_MAX_PX, Math.floor(sideSpace(side) - chrome)));
      const anchorVisible = anchorRect.bottom > bounds.top && anchorRect.top < bounds.bottom;
      const style = container.style;
      style.left = `${anchorRect.left}px`;
      style.width = `${anchorRect.width}px`;
      if (side === "top") {
        style.top = "";
        style.bottom = `${window.innerHeight - anchorRect.top}px`;
      } else {
        style.bottom = "";
        style.top = `${anchorRect.bottom + PANEL_GAP_PX}px`;
      }
      style.setProperty(TRIGGER_PANEL_LIST_MAX_HEIGHT_VAR, `${listMax}px`);
      style.visibility = anchorVisible ? "" : "hidden";
      container.dataset.side = side;
    };

    const schedule = () => {
      if (frameId === null) {
        frameId = requestAnimationFrame(update);
      }
    };

    // 面板开关会改变子节点；输入过滤和异步结果会改变面板高度。
    const mutationObserver = new MutationObserver(() => {
      if (container.childElementCount === 0) {
        lockedSide = null;
      }
      // 打开时同步定位（MutationObserver 回调在绘制前执行），首帧即在正确位置。
      update();
    });
    mutationObserver.observe(container, { childList: true });
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(container);
    if (anchorRef.current) {
      resizeObserver.observe(anchorRef.current);
    }
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [anchorRef, container]);

  return createPortal(
    <div ref={setContainer} className="fixed z-50" data-prompt-trigger-panel-floating="true" />,
    document.body,
  );
}
