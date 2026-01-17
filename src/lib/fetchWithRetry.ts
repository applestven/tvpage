/**
 * 网络请求工具模块
 * - 所有请求默认 3 秒超时（上传接口除外）
 * - 所有请求重试 3 次后再报错
 */

// 默认超时时间 3 秒
const DEFAULT_TIMEOUT = 6000;
// 默认重试次数
const DEFAULT_MAX_RETRIES = 3;
// 重试间隔
const DEFAULT_RETRY_DELAY = 1000;

interface FetchWithRetryOptions extends RequestInit {
    /** 超时时间（毫秒），默认 3000ms。设置为 0 或 Infinity 禁用超时 */
    timeout?: number;
    /** 最大重试次数，默认 3 次 */
    maxRetries?: number;
    /** 重试间隔（毫秒），默认 1000ms */
    retryDelay?: number;
    /** 是否为上传请求（上传请求不设置超时） */
    isUpload?: boolean;
}

/**
 * 带超时控制的 fetch
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
    const { timeout, ...fetchOptions } = options;

    // 如果没有设置超时或超时为 0/Infinity，直接请求
    if (!timeout || timeout === 0 || timeout === Infinity) {
        return fetch(url, fetchOptions);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error(`请求超时（${timeout}ms）`);
        }
        throw err;
    }
}

/**
 * 带重试和超时的 fetch 请求
 * @param url 请求 URL
 * @param options 请求选项
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
    url: string,
    options: FetchWithRetryOptions = {}
): Promise<Response> {
    const {
        timeout = DEFAULT_TIMEOUT,
        maxRetries = DEFAULT_MAX_RETRIES,
        retryDelay = DEFAULT_RETRY_DELAY,
        isUpload = false,
        ...fetchOptions
    } = options;

    // 上传请求不设置超时
    const effectiveTimeout = isUpload ? 0 : timeout;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, {
                ...fetchOptions,
                timeout: effectiveTimeout,
            });
            return response;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(
                `[fetchWithRetry] 第 ${attempt}/${maxRetries} 次请求失败 (${url}):`,
                lastError.message
            );

            // 如果不是最后一次尝试，等待后重试
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, retryDelay));
            }
        }
    }

    throw new Error(
        `请求失败（已重试 ${maxRetries} 次）: ${lastError?.message || "未知错误"}`
    );
}

/**
 * 通用重试函数（用于包装任意异步操作）
 * @param fn 要执行的异步函数
 * @param maxRetries 最大重试次数，默认 3
 * @param delayMs 重试间隔（毫秒），默认 1000
 * @returns Promise<T>
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = DEFAULT_MAX_RETRIES,
    delayMs: number = DEFAULT_RETRY_DELAY
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(
                `[withRetry] 第 ${attempt}/${maxRetries} 次尝试失败:`,
                lastError.message
            );
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }

    throw new Error(
        `操作失败（已重试 ${maxRetries} 次）: ${lastError?.message || "未知错误"}`
    );
}

export { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY };
