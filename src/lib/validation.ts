import { z } from "zod";
const text = (max = 500) => z.string().trim().max(max);
const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const weeklyAvailabilitySchema = z
  .array(
    z
      .object({
        weekday: z.number().int().min(0).max(6),
        start_time: time,
        end_time: time,
      })
      .refine((slot) => slot.start_time < slot.end_time, {
        message: "Each end time must follow its start time on the same day",
      }),
  )
  .max(28)
  .refine(
    (slots) =>
      !slots.some((a, i) =>
        slots.some(
          (b, j) =>
            i < j &&
            a.weekday === b.weekday &&
            a.start_time < b.end_time &&
            b.start_time < a.end_time,
        ),
      ),
    { message: "Availability periods on the same day must not overlap" },
  );
export const cleanerInviteSchema = z.object({
  name: text(100).min(2),
  email: z.email().max(254),
  availability: weeklyAvailabilitySchema.refine((slots) => slots.length > 0, {
    message: "Choose at least one working day and its hours",
  }),
});
export const enquirySchema = z.object({
  name: text(100).min(2),
  email: z.email().max(254),
  phone: text(30).regex(/^[+\d\s().-]{7,30}$/),
  postcode: text(10).regex(
    /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
    "Enter a UK postcode",
  ),
  frequency: z.enum(["weekly", "fortnightly", "discuss"]),
  home_size: text(50).min(1),
  preferred_days: z
    .array(
      z.enum([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ]),
    )
    .max(7),
  notes: text(2000).default(""),
  website: text(200).default(""),
  started_at: z.number().int().optional(),
});
export const customerSchema = z.object({
  id: z.uuid().optional(),
  name: text(100).min(2),
  email: z.email().or(z.literal("")),
  phone: text(30),
  address: text(500).min(2),
  postcode: text(10).min(2),
  preferences: text(2000).default(""),
  internal_notes: text(4000).default(""),
});
const rate = z.number().int().min(0).max(100000);
const rateFields = {
  customer_rate_pence: rate.min(1),
  admin_rate_pence: rate,
  cleaner_rate_pence: rate,
};
const balancedRates = (p: {
  customer_rate_pence: number;
  admin_rate_pence: number;
  cleaner_rate_pence: number;
}) => p.customer_rate_pence === p.admin_rate_pence + p.cleaner_rate_pence;
const balanceMessage =
  "Customer hourly rate must equal the admin share plus cleaner cash pay";
export const bookingRatesSchema = z
  .object(rateFields)
  .refine(balancedRates, { message: balanceMessage });
export const bookingSchema = z
  .object({
    ...rateFields,
    customer_id: z.uuid(),
    cleaner_id: z.uuid(),
    date,
    time,
    duration_minutes: z.number().int().min(30).max(480),
    interval_weeks: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    occurrences: z.number().int().min(1).max(52),
    duration_weeks: z.number().int().min(1).max(52).optional(),
    instructions: text(2000).default(""),
  })
  .refine(balancedRates, { message: balanceMessage })
  .refine((p) => p.interval_weeks !== 0 || p.occurrences === 1, {
    message: "One-off visits have one occurrence",
  })
  .refine(
    (p) =>
      p.interval_weeks === 0 ||
      (p.duration_weeks ?? p.occurrences * p.interval_weeks) <= 52,
    {
      message: "Recurring bookings can cover at most 52 weeks",
    },
  )
  .refine(
    (p) =>
      p.interval_weeks === 0 ||
      p.duration_weeks === undefined ||
      p.occurrences === Math.ceil(p.duration_weeks / p.interval_weeks),
    {
      message:
        "The number of visits must match the booking period and frequency",
    },
  );
const section = z.object({
  heading: text(150).min(1),
  text: text(3000).min(1),
});
export const contentSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(["page", "blog"]),
  slug: text(150).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: text(150).min(2),
  excerpt: text(500).default(""),
  seo_title: text(70).default(""),
  seo_description: text(170).default(""),
  body: z.record(z.string(), z.unknown()),
  sections: z.array(section).max(12).default([]),
  image_path: text(1000).default(""),
  image_alt: text(200).default(""),
  author: text(100).default(""),
  category: text(100).default(""),
  status: z.enum(["draft", "published"]),
  published_at: z.iso.datetime().or(z.literal("")).optional(),
});
export const operationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cleaner_availability"),
    data: z.object({
      cleaner_id: z.uuid(),
      availability: weeklyAvailabilitySchema,
    }),
  }),
  z.object({ action: z.literal("customer"), data: customerSchema }),
  z.object({ action: z.literal("booking"), data: bookingSchema }),
  z.object({
    action: z.literal("visit_finances"),
    data: z
      .object({ id: z.uuid(), ...rateFields })
      .refine(balancedRates, { message: balanceMessage }),
  }),
  z.object({
    action: z.literal("visit"),
    data: z.object({
      id: z.uuid(),
      starts_at: z.iso.datetime().optional(),
      cleaner_id: z.uuid().optional(),
      status: z.enum(["scheduled", "cancelled"]).optional(),
    }),
  }),
  z.object({
    action: z.literal("transition"),
    data: z.object({ id: z.uuid(), status: z.enum(["started", "completed"]) }),
  }),
  z.object({
    action: z.literal("enquiry"),
    data: z.object({
      id: z.uuid(),
      status: z.enum(["new", "contacted", "converted", "closed"]),
    }),
  }),
  z.object({
    action: z.literal("leave"),
    data: z
      .object({
        starts_on: date,
        ends_on: date,
        reason: text(1000).default(""),
      })
      .refine((p) => p.ends_on >= p.starts_on, {
        message: "End date must follow start date",
      }),
  }),
  z.object({
    action: z.literal("availability"),
    data: z
      .object({
        weekday: z.number().int().min(0).max(6),
        start_time: time,
        end_time: time,
      })
      .refine((p) => p.start_time < p.end_time, {
        message: "End time must follow start time",
      }),
  }),
  z.object({
    action: z.literal("review"),
    data: z.object({
      id: z.uuid(),
      kind: z.enum(["leave", "availability"]),
      status: z.enum(["approved", "declined"]),
    }),
  }),
  z.object({ action: z.literal("content"), data: contentSchema }),
  z.object({
    action: z.literal("task"),
    data: z.object({
      id: z.uuid().optional(),
      customer_id: z.uuid().or(z.literal("")).optional(),
      conversation_id: z.uuid().or(z.literal("")).optional(),
      title: text(200).min(2),
      due_on: date,
      done: z.boolean().default(false),
    }),
  }),
  z.object({
    action: z.literal("conversation"),
    data: z.object({
      id: z.uuid(),
      customer_id: z.uuid().or(z.literal("")).optional(),
      note: text(4000).optional(),
    }),
  }),
]);
export type Operation = z.infer<typeof operationSchema>;
