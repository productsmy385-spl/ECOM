/** Customer accounts: isolation between customers, default address rules, wishlist, profile. */
import { addresses, categories, db, inventory, products, productVariants, users } from "@ecom/db";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accountOverview,
  addToWishlist,
  createAddress,
  deleteAddress,
  getProfile,
  listAddresses,
  listWishlist,
  NotFoundError,
  removeFromWishlist,
  setDefaultAddress,
  updateAddress,
  updateProfile,
  wishlistProductIds,
} from "./index";

const run = `a${Date.now().toString(36)}`;
let alice: { userId: string };
let bob: { userId: string };
let published: string;
let draft: string;

const addr = (over: Record<string, unknown> = {}) => ({
  fullName: "Alice Rao",
  phone: "98765 43210",
  line1: "12 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560001",
  ...over,
});

beforeAll(async () => {
  const mk = async (n: string) => {
    const [u] = await db.insert(users).values({ name: n, email: `${n}.${run}@example.test` }).returning({ id: users.id });
    return { userId: u!.id };
  };
  alice = await mk("alice");
  bob = await mk("bob");
  const [cat] = await db.insert(categories).values({ name: `C ${run}`, slug: `c-${run}` }).returning({ id: categories.id });
  const mkp = async (name: string, status: "published" | "draft") => {
    const [p] = await db.insert(products).values({ name: `${name} ${run}`, slug: `${name}-${run}`.toLowerCase(), categoryId: cat!.id, status }).returning({ id: products.id });
    const [v] = await db.insert(productVariants).values({ productId: p!.id, sku: `${run}-${name}`.toUpperCase(), name: "Std", price: 49900 }).returning({ id: productVariants.id });
    await db.insert(inventory).values({ variantId: v!.id, onHand: 2 });
    return p!.id;
  };
  published = await mkp("Pub", "published");
  draft = await mkp("Draft", "draft");
});

afterAll(async () => {
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
  await db.delete(products).where(like(products.name, `% ${run}`));
  await db.delete(categories).where(eq(categories.slug, `c-${run}`));
});

describe("addresses", () => {
  let a1: string;
  let a2: string;

  it("validates Indian addresses and normalises the phone", async () => {
    await expect(createAddress(alice, addr({ postalCode: "012345" }))).rejects.toMatchObject({ name: "ZodError" });
    await expect(createAddress(alice, addr({ state: "Atlantis" }))).rejects.toMatchObject({ name: "ZodError" });
    const a = await createAddress(alice, addr());
    a1 = a.id;
    expect(a.phone).toBe("+919876543210");
    expect(a.isDefault).toBe(true); // first address becomes the default
  });

  it("keeps exactly one default", async () => {
    a2 = (await createAddress(alice, addr({ label: "Office", isDefault: true }))).id;
    let list = await listAddresses(alice);
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual([a2]);
    await setDefaultAddress(alice, a1);
    list = await listAddresses(alice);
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual([a1]);
    // Editing the default without the flag keeps it default.
    await updateAddress(alice, a1, addr({ city: "Mysuru", isDefault: false }));
    expect((await listAddresses(alice)).find((a) => a.id === a1)?.isDefault).toBe(true);
  });

  it("deleting the default promotes another", async () => {
    await deleteAddress(alice, a1);
    const list = await listAddresses(alice);
    expect(list.map((a) => a.id)).toEqual([a2]);
    expect(list[0]!.isDefault).toBe(true);
    const [row] = await db.select().from(addresses).where(eq(addresses.id, a1));
    expect(row?.deletedAt).not.toBeNull(); // soft delete
  });

  it("another customer can't read, edit, default or delete it (404)", async () => {
    expect(await listAddresses(bob)).toEqual([]);
    await expect(updateAddress(bob, a2, addr())).rejects.toBeInstanceOf(NotFoundError);
    await expect(setDefaultAddress(bob, a2)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteAddress(bob, a2)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listAddresses(alice)).map((a) => a.id)).toEqual([a2]);
  });
});

describe("wishlist", () => {
  it("is idempotent, per customer, and only accepts published products", async () => {
    await addToWishlist(alice, { productId: published });
    await addToWishlist(alice, { productId: published });
    expect(await wishlistProductIds(alice)).toEqual([published]);
    expect(await wishlistProductIds(bob)).toEqual([]);
    await expect(addToWishlist(alice, { productId: draft })).rejects.toBeInstanceOf(NotFoundError);

    const items = await listWishlist(alice);
    expect(items[0]).toMatchObject({ productId: published, price: 49900, inStock: true, available: true });

    await removeFromWishlist(bob, { productId: published }); // no effect on alice
    expect(await wishlistProductIds(alice)).toEqual([published]);
    await removeFromWishlist(alice, { productId: published });
    expect(await wishlistProductIds(alice)).toEqual([]);
  });
});

describe("profile", () => {
  it("updates name, phone, birthday and marketing preference", async () => {
    const p = await updateProfile(alice, { name: "Alice R", phone: "9123456780", dateOfBirth: "1995-04-02", marketingOptIn: true });
    expect(p).toMatchObject({ name: "Alice R", phone: "+919123456780", dateOfBirth: "1995-04-02", marketingOptIn: true });
    await expect(updateProfile(alice, { name: "A", dateOfBirth: "2999-01-01" })).rejects.toMatchObject({ name: "ZodError" });
    expect((await getProfile(bob)).name).toBe("bob");
    const o = await accountOverview(alice);
    expect(o.counts.addresses).toBe(1);
  });
});
