import { useMemo, useRef } from "react";
import type { ConversationRowTarget } from "@zcode/shared/zcode-protocol-v4";
import type { ConversationRowRenderContext } from "@/v4/conversationRowContext.js";
import type { ConversationTurnRenderUnit } from "@/v4/conversationTurnRenderUnits.js";

/**
 * 用户消息上的 "Fork chat" 复用 assistant 的 forkAssistant 命令（唯一 stable resolver），
 * 只是在 renderer 里替用户挑选 fork 边界：
 *
 * - includeTurn：本条消息所在轮已有可 fork 的轮尾 assistant（row.actions.canFork），
 *   在轮尾分叉，等价于点击该轮 assistant 的 Fork。
 * - beforeMessage：本轮仍在运行、出错或没有回复时，在之前最近一个可 fork 的轮尾分叉，
 *   新会话不含本条消息，本条消息文本放进新会话的输入框。
 * - 窗口内找不到任何可 fork 边界（例如首轮仍在运行）时不提供入口。
 *
 * 可用性仍完全取决于 CLI 投影的 canFork，renderer 不新增第二套 fork 守卫。
 */
export type UserInputForkMode = "includeTurn" | "beforeMessage";

export interface UserInputForkPlan {
  mode: UserInputForkMode;
  target: ConversationRowTarget;
}

export type UserInputForkHandler = (plan: UserInputForkPlan, composerText: string) => void;

export function resolveUserInputForkPlans(
  units: readonly ConversationTurnRenderUnit[],
): ReadonlyMap<number, UserInputForkPlan> {
  const plans = new Map<number, UserInputForkPlan>();
  let previousBoundary: ConversationRowTarget | null = null;
  for (const unit of units) {
    const tail = unit.latestAssistantTextRow;
    const ownBoundary: ConversationRowTarget | null =
      tail?.actions?.canFork === true && tail.entityId
        ? { rowId: tail.rowId, entityId: tail.entityId }
        : null;
    for (const row of unit.renderRows) {
      if (row.kind !== "userInput" || !row.entityId) continue;
      if (ownBoundary) {
        plans.set(row.rowId, { mode: "includeTurn", target: ownBoundary });
      } else if (previousBoundary) {
        plans.set(row.rowId, { mode: "beforeMessage", target: previousBoundary });
      }
    }
    if (ownBoundary) previousBoundary = ownBoundary;
  }
  return plans;
}

function signatureOf(plans: ReadonlyMap<number, UserInputForkPlan>): string {
  let signature = "";
  for (const [rowId, plan] of plans) {
    signature += `${rowId}:${plan.mode}:${plan.target.rowId}:${plan.target.entityId ?? ""};`;
  }
  return signature;
}

/**
 * 把 fork 计划注入行渲染上下文（只给 TurnGroup 用）。流式输出时 render units 每个 chunk
 * 都会重建，而 fork 计划只在轮边界变化时才变：按签名保持引用稳定，避免所有行随 chunk 重渲染。
 */
export function useUserInputForkRowContext(
  rowContext: ConversationRowRenderContext,
  units: readonly ConversationTurnRenderUnit[],
  onFork: UserInputForkHandler | undefined,
): ConversationRowRenderContext {
  const plans = useMemo(() => resolveUserInputForkPlans(units), [units]);
  const signature = signatureOf(plans);
  const stableRef = useRef({ signature, plans });
  if (stableRef.current.signature !== signature) stableRef.current = { signature, plans };
  const stablePlans = stableRef.current.plans;
  return useMemo(
    () =>
      onFork
        ? { ...rowContext, userInputForkPlans: stablePlans, onForkUserInput: onFork }
        : rowContext,
    [onFork, rowContext, stablePlans],
  );
}
