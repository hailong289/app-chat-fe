import { NextRequest, NextResponse } from "next/server";
import http from "node:http";
import https from "node:https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const FORWARDED_HEADERS = ["range", "if-range", "if-none-match", "if-modified-since"];
const FETCH_TIMEOUT_MS = 60000; // allow slower B2 responses
const RETRIES = 1;

const httpAgent = new http.Agent({ keepAlive: true, timeout: FETCH_TIMEOUT_MS });
const httpsAgent = new https.Agent({ keepAlive: true, timeout: FETCH_TIMEOUT_MS });

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  try {
    const forwardHeaders = new Headers();
    FORWARDED_HEADERS.forEach((h) => {
      const val = req.headers.get(h);
      if (val) forwardHeaders.set(h, val);
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let lastError: unknown;
    let upstream: Response | null = null;

    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const res = await fetch(target.toString(), {
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            ...Object.fromEntries(forwardHeaders.entries()),
            accept: req.headers.get("accept") || "*/*",
            "user-agent": "app-chat-file-proxy/1.0",
          },
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          console.error("File proxy upstream error", {
            url: target.toString(),
            status: res.status,
            statusText: res.statusText,
            body: text?.slice(0, 500),
            attempt,
          });
          lastError = new Error(`Upstream error ${res.status}`);
          continue;
        }

        upstream = res;
        break;
      } catch (err) {
        lastError = err;
        if (attempt === RETRIES) break;
      }
    }

    if (!upstream || !upstream.body) {
      clearTimeout(timer);
      console.error("File proxy upstream error", {
        url: target.toString(),
        error: lastError,
      });
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: 502 }
      );
    }

    clearTimeout(timer);
    const headers = new Headers();
    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    headers.set("content-type", contentType);

    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) {
      headers.set("content-disposition", contentDisposition);
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("content-length", contentLength);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const isAbort = (error as Error)?.name === "AbortError";
    console.error("File proxy error", { url: req.url, error });
    return NextResponse.json(
      {
        error: isAbort
          ? "Upstream request timed out"
          : "Unable to fetch requested file",
      },
      { status: isAbort ? 504 : 502 }
    );
  }
}
