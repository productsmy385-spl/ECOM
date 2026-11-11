import { deleteAddress, setDefaultAddress, updateAddress } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";

export const dynamic = "force-dynamic";

export const PATCH = customerRoute<{ id: string }>(async ({ req, c, params }) => updateAddress(c, params.id, await req.json()));
export const DELETE = customerRoute<{ id: string }>(async ({ c, params }) => {
  await deleteAddress(c, params.id);
  return { ok: true };
});
/** POST = make this the default address. */
export const POST = customerRoute<{ id: string }>(({ c, params }) => setDefaultAddress(c, params.id));
