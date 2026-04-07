"use client";

import { useCallback, useRef } from "react";
import type { LangType } from "@/hooks/useGlobalLang";

type Namespace = "dossier" | "fluff";

interface CachePayload {
  translatedContent: string;
}

interface ResolveParams {
  sourceLang: LangType;
  targetLang: LangType;
  sourceContent: string;
  produce: () => Promise<string>;
}

const memoryCache = new Map<string, string>();
const inflightCache = new Map<string, Promise<string>>();

function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return Math.abs(hash >>> 0).toString(16);
}

async function buildContentHash(input: string): Promise<string> {
  try {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return simpleHash(input);
  }
}

function buildLocalStorageKey(cacheKey: string): string {
  return `TD_TRANSLATION_CACHE:${cacheKey}`;
}

export function useBilingualCache(recordId: string | null, namespace: Namespace) {
  const serverProbeDone = useRef<Set<string>>(new Set());

  const probeServer = useCallback(
    async (cacheKey: string, hash: string): Promise<string | null> => {
      if (!recordId) return null;
      if (serverProbeDone.current.has(cacheKey)) return null;
      serverProbeDone.current.add(cacheKey);
      try {
        const query = new URLSearchParams({
          signalId: recordId,
          namespace,
          cacheKey,
          contentHash: hash,
        });
        const res = await fetch(`/api/v1/translate/cache?${query.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { success?: boolean; data?: CachePayload };
        if (!json.success || !json.data?.translatedContent) return null;
        return json.data.translatedContent;
      } catch {
        return null;
      }
    },
    [namespace, recordId]
  );

  const persistServer = useCallback(
    async (cacheKey: string, hash: string, translatedContent: string): Promise<void> => {
      if (!recordId) return;
      try {
        await fetch("/api/v1/translate/cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            signalId: recordId,
            namespace,
            cacheKey,
            contentHash: hash,
            translatedContent,
          }),
        });
      } catch {
        // 网络抖动时允许静默失败，避免阻塞主流程。
      }
    },
    [namespace, recordId]
  );

  const resolveOrCreate = useCallback(
    async ({ sourceLang, targetLang, sourceContent, produce }: ResolveParams) => {
      const hash = await buildContentHash(sourceContent);
      const cacheKey = `${namespace}:${recordId ?? "anonymous"}:${sourceLang}:${targetLang}:${hash}`;
      const localStorageKey = buildLocalStorageKey(cacheKey);

      const mem = memoryCache.get(cacheKey);
      if (mem) {
        if (process.env.NODE_ENV === "development") {
          console.log("🟡 [模块_异步] -> 目标: 命中内存翻译缓存", cacheKey);
        }
        return mem;
      }

      if (typeof window !== "undefined") {
        const persisted = localStorage.getItem(localStorageKey);
        if (persisted) {
          memoryCache.set(cacheKey, persisted);
          if (process.env.NODE_ENV === "development") {
            console.log("🟡 [模块_异步] -> 目标: 命中本地翻译缓存", cacheKey);
          }
          return persisted;
        }
      }

      const remote = await probeServer(cacheKey, hash);
      if (remote) {
        memoryCache.set(cacheKey, remote);
        if (typeof window !== "undefined") {
          localStorage.setItem(localStorageKey, remote);
        }
        if (process.env.NODE_ENV === "development") {
          console.log("🟡 [模块_异步] -> 目标: 命中服务端翻译缓存", cacheKey);
        }
        return remote;
      }

      const running = inflightCache.get(cacheKey);
      if (running) {
        if (process.env.NODE_ENV === "development") {
          console.log("🟡 [模块_异步] -> 目标: 复用翻译并发请求", cacheKey);
        }
        return running;
      }

      const runner = (async () => {
        const translated = await produce();
        memoryCache.set(cacheKey, translated);
        if (typeof window !== "undefined") {
          localStorage.setItem(localStorageKey, translated);
        }
        void persistServer(cacheKey, hash, translated);
        if (process.env.NODE_ENV === "development") {
          console.log("🔵 [模块_成功] -> 产物: 翻译缓存写入完成", cacheKey);
        }
        return translated;
      })();

      inflightCache.set(cacheKey, runner);
      try {
        return await runner;
      } finally {
        inflightCache.delete(cacheKey);
      }
    },
    [namespace, persistServer, probeServer, recordId]
  );

  return { resolveOrCreate };
}
