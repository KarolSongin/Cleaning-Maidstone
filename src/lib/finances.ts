import type { BookingRates, Visit } from "./models";

export function poundsToPence(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const pence = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(pence) && pence <= 100000 ? pence : null;
}
export const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100,
  );
export const visitMinutes = (visit: Pick<Visit, "starts_at" | "ends_at">) =>
  (new Date(visit.ends_at).getTime() - new Date(visit.starts_at).getTime()) /
  60000;
export function visitAmounts(rates: BookingRates, minutes: number) {
  const customer = Math.round((rates.customer_rate_pence * minutes) / 60);
  const cleaner = Math.round((rates.cleaner_rate_pence * minutes) / 60);
  return { customer, admin: customer - cleaner, cleaner };
}
export function ratesFromForm(form: FormData): BookingRates {
  const value = (name: string) => {
    const result = poundsToPence(String(form.get(name) ?? ""));
    if (result === null)
      throw new Error(
        "Enter hourly amounts with at most two decimal places (up to £1,000).",
      );
    return result;
  };
  const rates = {
    customer_rate_pence: value("customer_rate"),
    admin_rate_pence: value("admin_rate"),
    cleaner_rate_pence: value("cleaner_rate"),
  };
  if (
    !rates.customer_rate_pence ||
    rates.customer_rate_pence !==
      rates.admin_rate_pence + rates.cleaner_rate_pence
  )
    throw new Error(
      "Customer hourly rate must equal the admin share plus cleaner cash pay.",
    );
  return rates;
}
