import "server-only";
import { type Auth, createAuth } from "@ecom/auth";

let instance: Auth | undefined;

/** Created on first use, not at import, so `next build` needs no runtime secrets. */
export function getAuth(): Auth {
  instance ??= createAuth("web");
  return instance;
}
