"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { enquirySchema } from "@/lib/validation";
import { Button } from "./ui/button";
type Output = z.output<typeof enquirySchema>;
export function EnquiryForm({ demo = false }: { demo?: boolean }) {
  const [state, setState] = useState<"idle" | "success">("idle");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Output>({
    defaultValues: {
      frequency: "weekly",
      preferred_days: [],
      website: "",
      notes: "",
    },
  });
  useEffect(() => {
    setValue("started_at", Date.now());
  }, [setValue]);
  async function submit(data: Output) {
    setError("");
    try {
      const response = await fetch("/api/enquiries/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  }
  if (state === "success")
    return (
      <div className="form-success" role="status">
        <CheckCircle2 size={40} />
        <h3>
          {demo ? "Demo enquiry saved" : "Thank you. Let’s find your slot."}
        </h3>
        <p>
          {demo
            ? "This synthetic enquiry is in the local admin dashboard. It has not contacted the business."
            : "We’ll contact you to discuss availability, timing and your home’s priorities."}
        </p>
        <p>Your enquiry does not confirm a booking.</p>
        <Button variant="outline" onClick={() => setState("idle")}>
          Send another enquiry
        </Button>
      </div>
    );
  const field = (
    name: "name" | "email" | "phone" | "postcode",
    label: string,
    type = "text",
    autoComplete?: string,
  ) => (
    <label>
      {label}
      <input
        type={type}
        aria-label={label}
        autoComplete={autoComplete}
        {...register(name, {
          required:
            name === "postcode"
              ? "Enter a UK postcode"
              : "Please enter your " + label.toLowerCase(),
          validate: (value) => {
            const v = value.trim();
            if (name === "name")
              return v.length >= 2 || "Please enter your name";
            if (name === "email")
              return (
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ||
                "Enter a valid email address"
              );
            if (name === "phone")
              return (
                /^[+\d\s().-]{7,30}$/.test(v) || "Enter a valid phone number"
              );
            return (
              /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(v) ||
              "Enter a UK postcode"
            );
          },
        })}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? name + "-error" : undefined}
      />
      {errors[name] && (
        <span className="field-error" id={name + "-error"}>
          {errors[name]?.message}
        </span>
      )}
    </label>
  );
  return (
    <form className="enquiry-form" onSubmit={handleSubmit(submit)} noValidate>
      {demo && (
        <p className="demo-notice">
          Local demo · enquiries are stored here and do not contact the
          business.
        </p>
      )}
      <div className="form-grid">
        {field("name", "Your name", "text", "name")}
        {field("email", "Email address", "email", "email")}
        {field("phone", "Phone number", "tel", "tel")}
        {field("postcode", "Home postcode", "text", "postal-code")}
        <label>
          How often?
          <select {...register("frequency")}>
            <option value="weekly">Every week</option>
            <option value="fortnightly">Every fortnight</option>
            <option value="discuss">Help me decide</option>
          </select>
        </label>
        <label>
          Home size
          <select
            aria-label="Home size"
            {...register("home_size", { required: "Select your home size" })}
            aria-invalid={!!errors.home_size}
          >
            <option value="">Select bedrooms</option>
            {[
              "1 bedroom",
              "2 bedrooms",
              "3 bedrooms",
              "4 bedrooms",
              "5+ bedrooms",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          {errors.home_size && (
            <span className="field-error">{errors.home_size.message}</span>
          )}
        </label>
      </div>
      <fieldset>
        <legend>Which days work for you?</legend>
        <div className="day-options">
          {[
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ].map((day) => (
            <label key={day}>
              <input
                type="checkbox"
                value={day}
                {...register("preferred_days")}
              />
              <span>{day.slice(0, 3)}</span>
            </label>
          ))}
        </div>
        <small>
          Our current public hours are Monday to Friday. Other preferences can
          be discussed.
        </small>
      </fieldset>
      <label>
        Anything we should know?
        <textarea
          rows={3}
          placeholder="Bathrooms, priority rooms, pets, parking or suitable times…"
          {...register("notes")}
        />
      </label>
      <input
        type="hidden"
        {...register("started_at", { valueAsNumber: true })}
      />
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Enquire about availability"}
        <ArrowUpRight size={18} />
      </Button>
      <p className="form-small">
        An enquiry, not a confirmed booking. We’ll agree the details with you
        first. Read our <Link href="/privacy/">privacy notice</Link>.
      </p>
    </form>
  );
}
