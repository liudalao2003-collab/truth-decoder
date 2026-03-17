/**
 * 核心说明书：
 * 这是一个物理级隔离的全局日志引擎。它在整个业务线中的作用是：
 * 1. 统一接管全栈的日志打印，提供 🟢🟡🔵🔴 四种标准化工业探针。
 * 2. 强行阻断生产环境 (Production) 的一切明文输出，防止 Vercel 部署后发生内存泄漏或商业机密被恶意抓包。
 */

// 严格限定 payload 类型，坚决抵制 any 投毒
type LogPayload = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined;

// 预判当前环境，只在开发环境下开启阀门
const IS_DEV = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * 🟢 发起探针：用于记录动作触发与入参
   */
  start: (action: string, payload?: LogPayload): void => {
    if (!IS_DEV) return;
    console.log(`🟢 [模块_发起] -> 动作/参数: ${action}`, payload ?? '');
  },

  /**
   * 🟡 异步探针：用于记录网络请求、数据库查询等耗时目标的锁定
   */
  async: (target: string): void => {
    if (!IS_DEV) return;
    console.log(`🟡 [模块_异步] -> 目标: ${target}`);
  },

  /**
   * 🔵 成功探针：用于记录业务闭环与核心产物
   */
  success: (result: LogPayload): void => {
    if (!IS_DEV) return;
    console.log(`🔵 [模块_成功] -> 产物:`, result);
  },

  /**
   * 🔴 崩溃探针：用于记录异常捕获与死因分析
   */
  crash: (error: unknown): void => {
    if (!IS_DEV) return;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`🔴 [模块_崩溃] -> 原因:`, errorMessage);
  }
};