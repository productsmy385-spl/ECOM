import "server-only";
import { getWebsiteSettings } from "@ecom/services";
import { cache } from "react";

/** Website settings for this request (template, sections, contact, SEO). */
export const websiteSettings = cache(() => getWebsiteSettings());
