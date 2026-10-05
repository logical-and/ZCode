import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

/** 超过该位移视为拖选文字，不进入编辑。 */
const CLICK_TO_EDIT_DRAG_TOLERANCE_PX = 4;
/**
 * 单击后稍等再进入编辑：双击/三击选词选段时第二次点击会在这段时间内到达并取消编辑，
 * 否则第一次点击就把气泡换成编辑器，选词永远无法完成。
 */
const CLICK_TO_EDIT_DELAY_MS = 250;
/** 气泡内自带行为的元素（链接、展开按钮、披露、提及等）保留自己的点击语义。 */
const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, summary, label, [role="button"], [role="link"], [contenteditable="true"]';

function hasSelectionWithin(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  return (
    (selection.anchorNode !== null && element.contains(selection.anchorNode)) ||
    (selection.focusNode !== null && element.contains(selection.focusNode)) ||
    selection.getRangeAt(0).intersectsNode(element)
  );
}

function isInteractiveTarget(target: EventTarget, bubble: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(INTERACTIVE_SELECTOR);
  return interactive !== null && bubble.contains(interactive);
}

/**
 * 用户消息气泡「单击即编辑」。不进入编辑的情况：拖选文字、按下时气泡内已有选区
 * （这次点击只是取消选区）、双击/三击选词、带修饰键（Shift 扩展选区等）、
 * 点在气泡内的交互元素上。键盘用户走动作行里的 Edit 按钮。
 */
export function useUserInputBubbleClickToEdit(onOpenEdit: (() => void) | undefined) {
  const pointerDownRef = useRef<{ x: number; y: number; hadSelection: boolean } | null>(null);
  const timerRef = useRef<number | null>(null);

  const cancelPendingEdit = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingEdit, [cancelPendingEdit]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    pointerDownRef.current = {
      x: event.clientX,
      y: event.clientY,
      hadSelection: hasSelectionWithin(event.currentTarget),
    };
  }, []);

  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      cancelPendingEdit();
      const pointerDown = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!onOpenEdit || event.button !== 0 || event.detail > 1 || event.defaultPrevented) return;
      if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      const bubble = event.currentTarget;
      if (isInteractiveTarget(event.target, bubble)) return;
      if (
        pointerDown &&
        (pointerDown.hadSelection ||
          Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) >
            CLICK_TO_EDIT_DRAG_TOLERANCE_PX)
      ) {
        return;
      }
      if (hasSelectionWithin(bubble)) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (hasSelectionWithin(bubble)) return;
        onOpenEdit();
      }, CLICK_TO_EDIT_DELAY_MS);
    },
    [cancelPendingEdit, onOpenEdit],
  );

  return onOpenEdit ? { onPointerDown, onClick } : null;
}
