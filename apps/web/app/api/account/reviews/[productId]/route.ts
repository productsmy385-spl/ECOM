import { myReviewState, submitReview } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const check = (id: string) => {
  if (!UUID.test(id)) throw Object.assign(new Error("Not found."), { status: 404 });
  return id;
};

export const GET = customerRoute<{ productId: string }>(({ c, params }) => myReviewState(c, check(params.productId)));
/** POST { rating, title?, body } — verified buyers only; goes to moderation. */
export const POST = customerRoute<{ productId: string }>(async ({ req, c, params }) => submitReview(c, check(params.productId), await req.json()), { limit: 10 });
