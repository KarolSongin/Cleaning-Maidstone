import { describe, it, expect } from "vitest";
import twilio from "twilio";
import { twilioAdapter, normaliseTwilio, voiceResponse } from "@/lib/phone";
import { enquirySchema, operationSchema } from "@/lib/validation";
describe("provider signatures and local adapters", () => {
  it("validates the exact URL and rejects altered data and invalid signatures", () => {
    const url = "https://example.test/api/phone/events/?rootCallSid=CA123";
    const params = {
      CallSid: "CA123",
      CallStatus: "completed",
      AccountSid: "AC123",
    };
    const token = "synthetic-test-token";
    const adapter = twilioAdapter(token);
    const signature = twilio.getExpectedTwilioSignature(token, url, params);
    expect(adapter.verify(url, params, signature)).toBe(true);
    expect(
      adapter.verify(url, { ...params, CallStatus: "ringing" }, signature),
    ).toBe(false);
    expect(adapter.verify(url + "x", params, signature)).toBe(false);
    expect(adapter.verify(url, params, "invalid")).toBe(false);
  });
  it("correlates forwarded legs and generates stable retry keys", () => {
    const p = {
      CallSid: "original",
      DialCallSid: "forwarded",
      From: "+447700900123",
      DialCallStatus: "completed",
      DialCallDuration: "42",
    };
    const event = normaliseTwilio(p, "original");
    expect(event.root_call_id).toBe("original");
    expect(event.call_leg_id).toBe("forwarded");
    expect(event.duration_seconds).toBe(42);
    expect(event.event_key).toBe(normaliseTwilio(p, "original").event_key);
  });
  it("does not enable recording without explicit configuration", () => {
    expect(voiceResponse("CA123")).not.toContain("record-from-answer");
  });
});
describe("server input validation", () => {
  it("rejects incomplete enquiries and impossible recurring requests", () => {
    expect(enquirySchema.safeParse({ name: "X", email: "bad" }).success).toBe(
      false,
    );
    expect(
      operationSchema.safeParse({
        action: "booking",
        data: {
          customer_id: "44444444-4444-4444-8444-444444444444",
          cleaner_id: "22222222-2222-4222-8222-222222222222",
          date: "2027-01-01",
          time: "09:00",
          duration_minutes: 180,
          interval_weeks: 0,
          occurrences: 2,
        },
      }).success,
    ).toBe(false);
  });
});
