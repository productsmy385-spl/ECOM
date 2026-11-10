import { toNextJsHandler } from "@ecom/auth";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => toNextJsHandler(getAuth()).GET(req);
export const POST = (req: Request) => toNextJsHandler(getAuth()).POST(req);
