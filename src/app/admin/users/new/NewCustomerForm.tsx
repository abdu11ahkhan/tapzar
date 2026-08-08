"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { createCustomer } from "../../actions";
import { ACCENT_PRESETS } from "@/lib/card";
import { CARD_TEMPLATES } from "@/lib/card";

type Created = { email: string; password: string; username: string };

/**
 * Builds an account and a card for someone who is standing in front of you.
 *
 * Otherwise selling a card in person means talking the customer through
 * signing up, confirming an email and filling a form before anything can go to
 * print — with the seller waiting through all of it.
 */
export default function NewCustomerForm() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    username: "",
    headline: "",
    company: "",
    phone: "",
    location: "",
    template: "minimal",
    accentColor: "#111111",
    publish: false,
  });
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  };

  const field =
    "h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/35";
  const label = "text-[11px] font-bold uppercase tracking-widest text-white/40";

  if (created) {
    const lines = `Card: https://tap.scorlyn.com/u/${created.username}
Login: https://tap.scorlyn.com/login
Email: ${created.email}
Password: ${created.password}`;

    return (
      <div className="max-w-xl space-y-5">
        <div className="rounded-2xl border-2 border-acid/40 bg-acid/10 p-5">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-acid">
            <Check className="h-4 w-4" />
            account created
          </p>
          <p className="mt-2 text-sm text-white/60">
            Hand these over. The password is shown once here and nowhere else —
            it is not stored in readable form.
          </p>

          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/40 p-4 text-[13px] leading-relaxed text-white">
            {lines}
          </pre>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(lines);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2500);
                } catch {
                  // Clipboard needs a secure context; the text is on screen.
                }
              }}
              className="app-btn app-btn-primary"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy details"}
            </button>
            <Link href={`/u/${created.username}`} target="_blank" className="app-btn app-btn-ghost">
              Open their card
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setForm((f) => ({ ...f, email: "", password: "", fullName: "", username: "" }));
              }}
              className="app-btn app-btn-ghost"
            >
              Add another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className="max-w-2xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createCustomer(form);
          if (!r.ok) setError(r.error ?? "Could not create the account.");
          else setCreated(r.data ?? null);
        });
      }}
    >
      <section className="space-y-3">
        <p className={label}>their login</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="customer@example.com"
            className={field}
          />
          <input
            value={form.password}
            onChange={(e) => set({ password: e.target.value })}
            placeholder="Password (leave blank to generate)"
            className={field}
          />
        </div>
        <p className="text-xs text-white/35">
          The account is created already confirmed, so they can sign in
          immediately without an email round trip.
        </p>
      </section>

      <section className="space-y-3">
        <p className={label}>their card</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            value={form.fullName}
            onChange={(e) => set({ fullName: e.target.value })}
            placeholder="Full name"
            className={field}
          />
          <input
            required
            value={form.username}
            onChange={(e) => set({ username: e.target.value.toLowerCase() })}
            placeholder="Handle — tap.scorlyn.com/u/…"
            autoCapitalize="none"
            spellCheck={false}
            className={field}
          />
          <input
            value={form.headline}
            onChange={(e) => set({ headline: e.target.value })}
            placeholder="Role, e.g. Barber"
            className={field}
          />
          <input
            value={form.company}
            onChange={(e) => set({ company: e.target.value })}
            placeholder="Company"
            className={field}
          />
          <input
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="03001234567"
            className={field}
          />
          <input
            value={form.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Lahore, Pakistan"
            className={field}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className={label}>template</p>
          <select
            value={form.template}
            onChange={(e) => set({ template: e.target.value })}
            className={field}
          >
            {CARD_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#14161a]">
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className={label}>accent</p>
          <div className="flex flex-wrap gap-1.5">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => set({ accentColor: preset.value })}
                aria-label={preset.name}
                className={`h-8 w-8 rounded-full border-2 ${
                  form.accentColor === preset.value ? "border-white" : "border-white/15"
                }`}
                style={{ background: preset.value }}
              />
            ))}
          </div>
        </div>
      </section>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/12 p-3.5">
        <input
          type="checkbox"
          checked={form.publish}
          onChange={(e) => set({ publish: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-lime-400"
        />
        <span>
          <span className="block text-sm font-semibold text-white">Publish immediately</span>
          <span className="mt-0.5 block text-xs text-white/40">
            Off by default — a card built for someone is theirs to release once
            they have checked it.
          </span>
        </span>
      </label>

      {error && (
        <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-black disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Create account and card
      </button>
    </form>
  );
}
