import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { assertIngestAuthorized } from "@/lib/ingest-auth";

interface TranslationCacheEntry {
  contentHash: string;
  translatedContent: string;
  updatedAt: string;
}

type TranslationCacheStore = Record<string, TranslationCacheEntry>;

interface SignalMetadataShape {
  translation_cache?: Record<string, TranslationCacheStore>;
  [key: string]: unknown;
}

function pruneCacheEntries(store: TranslationCacheStore, maxSize = 30): TranslationCacheStore {
  const entries = Object.entries(store);
  if (entries.length <= maxSize) return store;
  entries.sort((a, b) => (b[1].updatedAt > a[1].updatedAt ? 1 : -1));
  return Object.fromEntries(entries.slice(0, maxSize));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const signalId = searchParams.get("signalId");
    const namespace = searchParams.get("namespace");
    const cacheKey = searchParams.get("cacheKey");
    const contentHash = searchParams.get("contentHash");

    if (!signalId || !namespace || !cacheKey || !contentHash) {
      return NextResponse.json({ success: false, error: "Invalid query" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("signals")
      .select("metadata")
      .eq("id", signalId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const metadata = (data.metadata ?? {}) as SignalMetadataShape;
    const bucket = metadata.translation_cache?.[namespace] ?? {};
    const entry = bucket[cacheKey];

    if (!entry || entry.contentHash !== contentHash || !entry.translatedContent) {
      return NextResponse.json({ success: false, error: "Cache miss" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { translatedContent: entry.translatedContent },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown cache read error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await assertIngestAuthorized(req);
    if (!auth.ok || auth.kind !== "user") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      signalId?: string;
      namespace?: string;
      cacheKey?: string;
      contentHash?: string;
      translatedContent?: string;
    };

    if (!body.signalId || !body.namespace || !body.cacheKey || !body.contentHash || !body.translatedContent) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const { data: row, error: readErr } = await supabaseAdmin
      .from("signals")
      .select("owner_id, metadata")
      .eq("id", body.signalId)
      .maybeSingle();

    if (readErr || !row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const signalRow = row as { owner_id: string | null; metadata: SignalMetadataShape | null };
    if (signalRow.owner_id !== auth.userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const metadata: SignalMetadataShape = signalRow.metadata ?? {};
    const translationCache = metadata.translation_cache ?? {};
    const bucket = translationCache[body.namespace] ?? {};

    bucket[body.cacheKey] = {
      contentHash: body.contentHash,
      translatedContent: body.translatedContent,
      updatedAt: new Date().toISOString(),
    };

    translationCache[body.namespace] = pruneCacheEntries(bucket);

    const { error: updateErr } = await supabaseAdmin
      .from("signals")
      .update({ metadata: { ...metadata, translation_cache: translationCache } })
      .eq("id", body.signalId);

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown cache write error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
