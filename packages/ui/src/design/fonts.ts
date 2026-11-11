/**
 * Design fonts as next/font CSS variables (--font-playfair, --font-dancing,
 * --font-bebas). Sora and Inter are already loaded by each app's root layout.
 * Not preloaded: they're only needed on design screens.
 */
import { Bebas_Neue, Dancing_Script, Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap", preload: false });
const dancing = Dancing_Script({ variable: "--font-dancing", subsets: ["latin"], display: "swap", preload: false });
const bebas = Bebas_Neue({ variable: "--font-bebas", weight: "400", subsets: ["latin"], display: "swap", preload: false });

/** Add to <html className>. */
export const designFontVariables = `${playfair.variable} ${dancing.variable} ${bebas.variable}`;
