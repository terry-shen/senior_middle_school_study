/**
 * 会话级别的"当前学习上下文"：让心跳等全局埋点知道学生正在看哪一节。
 * 仅内存保存，不持久化。
 */
let currentSectionId: number | null = null;

export function setCurrentSectionId(id: number | null): void {
  currentSectionId = id;
}

export function getCurrentSectionId(): number | null {
  return currentSectionId;
}
