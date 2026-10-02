import { Temporal } from "@js-temporal/polyfill";
export function occurrenceInstants(
  date: string,
  time: string,
  weeks: number,
  count: number,
) {
  const day = Temporal.PlainDate.from(date);
  return Array.from({ length: count }, (_, i) =>
    day
      .add({ weeks: weeks * i })
      .toPlainDateTime(Temporal.PlainTime.from(time))
      .toZonedDateTime("Europe/London", { disambiguation: "reject" })
      .toInstant()
      .toString(),
  );
}
export function londonInstant(date: string, time: string) {
  return Temporal.PlainDate.from(date)
    .toPlainDateTime(Temporal.PlainTime.from(time))
    .toZonedDateTime("Europe/London", { disambiguation: "reject" })
    .toInstant()
    .toString();
}
export function londonDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    ...options,
  }).format(new Date(value));
}
