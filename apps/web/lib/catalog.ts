import "server-only";
import { getHomeData, getProductBySlug, listNavCategories } from "@ecom/services";
import { cache } from "react";

/** Request-deduplicated reads (header, page and metadata share one query). */
export const navCategories = cache(listNavCategories);
export const productBySlug = cache(getProductBySlug);
export const homeData = cache(getHomeData);
