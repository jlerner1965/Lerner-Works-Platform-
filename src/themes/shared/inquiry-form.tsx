"use client";

import { useId, useState, type FormEvent } from "react";

export interface InquiryFormProps {
  endpoint: string | null;
  heading: string;
  intro: string;
  sourcePath: string;
  locations: Array<{ id: string; label: string }>;
  /** Preselected location (store/place detail pages). */
  locationId?: string;
  styles: {
    wrapper: string;
    input: string;
    label: string;
    button: string;
    error: string;
    success: string;
    legend: string;
  };
}

type Errors = Partial<Record<"name" | "email" | "phone" | "message" | "form", string>>;

const CONSENT_VERSION = "2026-09-v1";

export function InquiryForm(props: InquiryFormProps) {
  const id = useId();
  const [values, setValues] = useState({ name: "", email: "", phone: "", message: "", locationId: props.locationId ?? "" });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [token] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));

  const validate = (): Errors => {
    const e: Errors = {};
    if (!values.name.trim()) e.name = "Enter your name.";
    else if (values.name.length > 120) e.name = "Name must be 120 characters or fewer.";
    if (!values.email.trim()) e.email = "Enter your email address.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) e.email = "Enter a valid email address.";
    if (values.phone.length > 40) e.phone = "Phone must be 40 characters or fewer.";
    if (!values.message.trim()) e.message = "Enter a message.";
    else if (values.message.length > 4000) e.message = "Message must be 4000 characters or fewer.";
    return e;
  };

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!props.endpoint) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`${id}-summary`)?.focus();
      return;
    }
    setState("submitting");
    try {
      const form = new FormData(ev.currentTarget);
      const res = await fetch(props.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone,
          message: values.message,
          locationId: values.locationId || null,
          sourcePath: props.sourcePath,
          consentVersion: CONSENT_VERSION,
          idempotencyKey: token,
          website: String(form.get("website") ?? ""),
        }),
      });
      const body = (await res.json().catch(() => null)) as { receipt?: string; error?: string; fieldErrors?: Errors } | null;
      if (res.ok && body?.receipt) {
        setReceipt(body.receipt);
        setState("done");
        return;
      }
      setErrors({ ...(body?.fieldErrors ?? {}), form: body?.error ?? "Your message could not be sent. Please try again." });
      setState("idle");
      document.getElementById(`${id}-summary`)?.focus();
    } catch {
      setErrors({ form: "Your message could not be sent because the connection failed. Your text is still here; please try again." });
      setState("idle");
    }
  }

  const s = props.styles;
  if (!props.endpoint) {
    return (
      <div className={s.wrapper}>
        <h2>{props.heading}</h2>
        <p className={s.legend}>Form submissions are disabled in previews. The published page accepts inquiries.</p>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className={s.wrapper} role="status" aria-live="polite">
        <h2>Thank you</h2>
        <p className={s.success}>
          Your inquiry was received. Receipt reference: <strong>{receipt}</strong>. Keep this reference if you follow up.
        </p>
      </div>
    );
  }
  const errorList = Object.entries(errors).filter(([k, v]) => v && k !== "form");
  return (
    <form className={s.wrapper} onSubmit={onSubmit} noValidate aria-describedby={`${id}-summary`}>
      <h2>{props.heading}</h2>
      {props.intro ? <p>{props.intro}</p> : null}
      <div id={`${id}-summary`} tabIndex={-1} role="alert" aria-live="assertive">
        {errors.form ? <p className={s.error}>{errors.form}</p> : null}
        {errorList.length ? (
          <div className={s.error}>
            <p>Please fix the following:</p>
            <ul>
              {errorList.map(([k, v]) => (
                <li key={k}>
                  <a href={`#${id}-${k}`}>{v}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div>
        <label htmlFor={`${id}-name`} className={s.label}>
          Name <span aria-hidden="true">*</span>
        </label>
        <input id={`${id}-name`} name="name" required autoComplete="name" className={s.input} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? `${id}-name-err` : undefined} />
        {errors.name ? <p id={`${id}-name-err`} className={s.error}>{errors.name}</p> : null}
      </div>
      <div>
        <label htmlFor={`${id}-email`} className={s.label}>
          Email <span aria-hidden="true">*</span>
        </label>
        <input id={`${id}-email`} name="email" type="email" required autoComplete="email" className={s.input} value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? `${id}-email-err` : undefined} />
        {errors.email ? <p id={`${id}-email-err`} className={s.error}>{errors.email}</p> : null}
      </div>
      <div>
        <label htmlFor={`${id}-phone`} className={s.label}>
          Phone <span className={s.legend}>(optional)</span>
        </label>
        <input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" className={s.input} value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} aria-invalid={errors.phone ? true : undefined} />
        {errors.phone ? <p className={s.error}>{errors.phone}</p> : null}
      </div>
      {props.locations.length > 0 ? (
        <div>
          <label htmlFor={`${id}-location`} className={s.label}>
            About which location? <span className={s.legend}>(optional)</span>
          </label>
          <select id={`${id}-location`} name="locationId" className={s.input} value={values.locationId} onChange={(e) => setValues({ ...values, locationId: e.target.value })}>
            <option value="">General inquiry</option>
            {props.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label htmlFor={`${id}-message`} className={s.label}>
          Message <span aria-hidden="true">*</span>
        </label>
        <textarea id={`${id}-message`} name="message" required rows={5} className={s.input} value={values.message} onChange={(e) => setValues({ ...values, message: e.target.value })} aria-invalid={errors.message ? true : undefined} aria-describedby={errors.message ? `${id}-message-err` : undefined} />
        {errors.message ? <p id={`${id}-message-err`} className={s.error}>{errors.message}</p> : null}
      </div>
      {/* Honeypot: hidden from people and assistive technology; bots that fill it are rejected. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <p className={s.legend}>Required fields are marked with *. We use your details only to answer this inquiry.</p>
      <button type="submit" className={s.button} disabled={state === "submitting"} aria-busy={state === "submitting"}>
        {state === "submitting" ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}
