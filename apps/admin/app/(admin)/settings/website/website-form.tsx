"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { HOME_SECTION_LABELS, type WebsiteSettings } from "@ecom/validation";
import { type CornerStyle, type HeadingFont, type HeroStyle, WEBSITE_TEMPLATES, type WebsiteTemplate } from "@ecom/ui/website-templates";
import { ArrowDown, ArrowUp, Check, ExternalLink, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Issues = Record<string, string>;

/** A miniature storefront drawn in the template's colours. */
function TemplatePreview({ t, hero, corners }: { t: WebsiteTemplate; hero: HeroStyle; corners: CornerStyle }) {
  const r = corners === "square" ? 2 : corners === "soft" ? 6 : 12;
  const pill = corners === "rounded" ? 999 : r;
  const c = t.colors;
  return (
    <div className="overflow-hidden border-b border-border bg-white" aria-hidden="true">
      <div className="h-2" style={{ background: c.primary }} />
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="h-2 w-10 rounded-full bg-black/80" />
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-5 rounded-full bg-black/20" />
          ))}
        </span>
      </div>
      {hero === "banner" ? (
        <div className="relative mx-0 flex h-20 items-center px-3" style={{ background: `linear-gradient(90deg, #111 55%, ${c.primary})` }}>
          <div className="space-y-1">
            <span className="block h-2 w-20 rounded bg-white/90" />
            <span className="block h-1.5 w-14 rounded bg-white/50" />
            <span className="mt-1 block h-3 w-12" style={{ background: "#fff", borderRadius: pill }} />
          </div>
        </div>
      ) : hero === "centered" ? (
        <div className="flex h-20 flex-col items-center justify-center gap-1" style={{ background: c.softer }}>
          <span className="block h-2 w-24 rounded bg-black/80" />
          <span className="block h-1.5 w-16 rounded bg-black/30" />
          <span className="mt-1 block h-3 w-12" style={{ background: c.primary, borderRadius: pill }} />
        </div>
      ) : (
        <div className="flex h-20 items-center gap-2 px-3" style={{ background: c.softer }}>
          <div className="flex-1 space-y-1">
            <span className="block h-2 w-20 rounded bg-black/80" />
            <span className="block h-1.5 w-14 rounded bg-black/30" />
            <span className="mt-1 block h-3 w-12" style={{ background: c.primary, borderRadius: pill }} />
          </div>
          <span className="h-14 w-14" style={{ background: c.soft, borderRadius: r }} />
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1">
            <span className="block h-8" style={{ background: c.soft, borderRadius: r / 2 }} />
            <span className="block h-1 w-3/4 rounded bg-black/30" />
            <span className="block h-1 w-1/3 rounded" style={{ background: c.primary }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange, name }: { name: string; value: T; options: { value: T; label: string; hint: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{name}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <label key={o.value} className={cn("cursor-pointer rounded-lg border p-3 text-sm transition-colors", value === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            <span className="flex items-center justify-between font-medium">
              {o.label}
              {value === o.value && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

export function WebsiteSettingsForm({ initial, storefrontUrl }: { initial: WebsiteSettings; storefrontUrl: string }) {
  const [s, setS] = useState<WebsiteSettings>(initial);
  const [saved, setSaved] = useState<WebsiteSettings>(initial);
  const [issues, setIssues] = useState<Issues>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  const set = <K extends keyof WebsiteSettings>(k: K, v: WebsiteSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const setIn = <K extends "contact" | "social" | "seo" | "announcement">(k: K, field: keyof WebsiteSettings[K], v: unknown) =>
    setS((p) => ({ ...p, [k]: { ...p[k], [field]: v } }));
  const err = (path: string) => issues[path];

  function pickTemplate(t: WebsiteTemplate) {
    setS((p) => ({ ...p, template: t.key as WebsiteSettings["template"], heroStyle: t.defaults.heroStyle, corners: t.defaults.corners, headingFont: t.defaults.headingFont }));
  }

  function move(i: number, d: -1 | 1) {
    setS((p) => {
      const next = [...p.sections];
      const j = i + d;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...p, sections: next };
    });
  }

  async function save() {
    setBusy(true);
    setIssues({});
    try {
      const out = await api<WebsiteSettings>("/settings/website", { method: "PUT", body: s });
      setS(out);
      setSaved(out);
      toast.success("Website settings saved. The storefront is updated.");
    } catch (e) {
      if (e instanceof ApiError && e.issues) setIssues(Object.fromEntries(e.issues.map((i) => [i.path, i.message])));
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const active = WEBSITE_TEMPLATES.find((t) => t.key === s.template) ?? WEBSITE_TEMPLATES[0];

  return (
    <div className="space-y-6">
      <Section title="Template" description={`${WEBSITE_TEMPLATES.length} ready-made looks. Picking one also applies its suggested layout, which you can change below.`}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Template">
          {WEBSITE_TEMPLATES.map((t) => {
            const on = t.key === s.template;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickTemplate(t)}
                className={cn("overflow-hidden rounded-xl border-2 text-left transition-all hover:shadow-dropdown", on ? "border-primary ring-2 ring-primary/20" : "border-border")}
              >
                <TemplatePreview t={t} hero={on ? s.heroStyle : t.defaults.heroStyle} corners={on ? s.corners : t.defaults.corners} />
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {on ? <span className="rounded-full bg-primary px-2 py-0.5 text-2xs font-semibold text-primary-foreground">Active</span> : t.key === "adira-crimson" && <span className="text-2xs text-muted-foreground">Brand default</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                  <div className="mt-2 flex gap-1">
                    {[t.colors.primary, t.colors.highlight, t.colors.soft, t.colors.softer].map((c) => (
                      <span key={c} className="h-4 w-4 rounded-full border border-black/10" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Layout" description={`Fine-tune ${active.name}.`}>
        <Choice<HeroStyle>
          name="Home page hero"
          value={s.heroStyle}
          onChange={(v) => set("heroStyle", v)}
          options={[
            { value: "split", label: "Split", hint: "Text beside a framed image" },
            { value: "centered", label: "Centred", hint: "Centred text, wide image below" },
            { value: "banner", label: "Full banner", hint: "Image fills the hero, text over it" },
          ]}
        />
        <Choice<CornerStyle>
          name="Corners"
          value={s.corners}
          onChange={(v) => set("corners", v)}
          options={[
            { value: "rounded", label: "Rounded", hint: "Pill buttons, soft cards" },
            { value: "soft", label: "Soft", hint: "Gently rounded" },
            { value: "square", label: "Square", hint: "Crisp, gallery-like" },
          ]}
        />
        <Choice<HeadingFont>
          name="Heading font"
          value={s.headingFont}
          onChange={(v) => set("headingFont", v)}
          options={[
            { value: "sora", label: "Sora", hint: "Modern sans-serif (brand)" },
            { value: "playfair", label: "Playfair Display", hint: "Elegant serif" },
          ]}
        />
      </Section>

      <Section title="Home page sections" description="Show, hide and reorder what appears below the hero.">
        <ol className="divide-y divide-border rounded-lg border border-border">
          {s.sections.map((sec, i) => (
            <li key={sec.key} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
              <Checkbox
                checked={sec.enabled}
                onChange={(e) => setS((p) => ({ ...p, sections: p.sections.map((x) => (x.key === sec.key ? { ...x, enabled: e.currentTarget.checked } : x)) }))}
                label={HOME_SECTION_LABELS[sec.key]}
              />
              <span className="ml-auto flex gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${HOME_SECTION_LABELS[sec.key]} up`}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === s.sections.length - 1} aria-label={`Move ${HOME_SECTION_LABELS[sec.key]} down`}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Hero and offer banners are managed under Marketing → Banners.</p>
      </Section>

      <Section title="Announcement bar" description="A thin strip above the header, for a sale or a delivery notice.">
        <Checkbox checked={s.announcement.enabled} onChange={(e) => setIn("announcement", "enabled", e.currentTarget.checked)} label="Show the announcement bar" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Message" value={s.announcement.text} maxLength={140} onChange={(e) => setIn("announcement", "text", e.target.value)} placeholder="Diwali sale: 15% off all resin frames" error={err("announcement.text")} />
          <Input label="Link (optional)" value={s.announcement.href} onChange={(e) => setIn("announcement", "href", e.target.value)} placeholder="/shop?tag=sale" error={err("announcement.href")} />
        </div>
      </Section>

      <Section title="Store details" description="Shown in the footer and the top info strip.">
        <Input label="Tagline" value={s.tagline} maxLength={160} onChange={(e) => set("tagline", e.target.value)} placeholder="Custom photo frames and handmade resin art frames, designed by you." error={err("tagline")} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Support email" type="email" value={s.contact.email} onChange={(e) => setIn("contact", "email", e.target.value)} error={err("contact.email")} />
          <Input label="Phone" value={s.contact.phone} onChange={(e) => setIn("contact", "phone", e.target.value)} placeholder="+91 98765 43210" error={err("contact.phone")} />
          <Input label="WhatsApp number" value={s.contact.whatsapp} onChange={(e) => setIn("contact", "whatsapp", e.target.value)} placeholder="+91 98765 43210" error={err("contact.whatsapp")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea label="Address" rows={3} value={s.contact.address} maxLength={300} onChange={(e) => setIn("contact", "address", e.target.value)} error={err("contact.address")} />
          <Input label="Opening hours" value={s.contact.hours} maxLength={120} onChange={(e) => setIn("contact", "hours", e.target.value)} placeholder="Mon–Sat, 10am–7pm" error={err("contact.hours")} />
        </div>
      </Section>

      <Section title="Social links" description="Full https:// links. Empty ones are hidden.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["instagram", "Instagram"],
              ["facebook", "Facebook"],
              ["youtube", "YouTube"],
              ["pinterest", "Pinterest"],
              ["x", "X (Twitter)"],
            ] as const
          ).map(([k, label]) => (
            <Input key={k} label={label} value={s.social[k]} onChange={(e) => setIn("social", k, e.target.value)} placeholder="https://" error={err(`social.${k}`)} />
          ))}
        </div>
      </Section>

      <Section title="Search engines (SEO)" description="How the home page appears in Google results and link previews.">
        <Input label={`Title (${s.seo.title.length}/70)`} value={s.seo.title} maxLength={70} onChange={(e) => setIn("seo", "title", e.target.value)} placeholder="Adira: Custom Photo Frames & Resin Art Frames" error={err("seo.title")} />
        <Textarea label={`Description (${s.seo.description.length}/160)`} rows={2} value={s.seo.description} maxLength={160} onChange={(e) => setIn("seo", "description", e.target.value)} error={err("seo.description")} />
      </Section>

      <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-card/95 backdrop-blur lg:-mx-6">
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 lg:px-6">
          <span className="mr-auto text-sm text-muted-foreground">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
          <a href={storefrontUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
            View storefront <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button type="button" variant="outline" onClick={() => setS(saved)} disabled={!dirty || busy}>
            <RotateCcw className="h-4 w-4" /> Discard
          </Button>
          <Button type="button" onClick={save} disabled={!dirty} isLoading={busy}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
