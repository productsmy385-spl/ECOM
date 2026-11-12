import { AdiraLoader } from "@ecom/ui/loader";

/** Shown while a storefront page streams in: the animated Adira logo. */
export default function Loading() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <AdiraLoader size={80} label="Loading page" />
    </div>
  );
}
