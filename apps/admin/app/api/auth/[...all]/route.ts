import { toNextJsHandler } from "@ecom/auth";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin";

/**
 * Next strips the "/admin" basePath from request.url before route handlers see it,
 * but Better Auth is configured with basePath "/admin/api/auth" so the URLs it
 * generates (reset links, callbacks) are correct. Restore the prefix here.
 */
function withBasePath(req: Request): Request {
  const url = new URL(req.url);
  if (url.pathname.startsWith(`${BASE_PATH}/`)) return req;
  url.pathname = BASE_PATH + url.pathname;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? req.body : undefined,
    // Required by Node's fetch when streaming a request body.
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);
}

export const GET = (req: Request) => toNextJsHandler(getAuth()).GET(withBasePath(req));
export const POST = (req: Request) => toNextJsHandler(getAuth()).POST(withBasePath(req));
