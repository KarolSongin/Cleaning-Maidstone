import { createHash } from "node:crypto";
import twilio from "twilio";
export type CallEvent = {
  provider: string;
  event_key: string;
  root_call_id: string;
  call_leg_id: string;
  caller: string;
  direction: string;
  status: string;
  occurred_at: string;
  duration_seconds: number;
  recording_status?: string;
  recording_sid?: string;
  retention_days?: number;
  authoritative_caller?: boolean;
};
export interface PhoneProvider {
  name: string;
  verify: (
    url: string,
    params: Record<string, string>,
    signature: string,
  ) => boolean;
  event: (params: Record<string, string>, root?: string) => CallEvent;
}
export function normaliseTwilio(
  params: Record<string, string>,
  root?: string,
): CallEvent {
  const leg = params.DialCallSid || params.CallSid;
  const status = params.DialCallStatus || params.CallStatus || "initiated";
  const key = [
    leg,
    params.SequenceNumber || "",
    status,
    params.RecordingSid || "",
    params.RecordingStatus || "",
  ].join(":");
  return {
    provider: "twilio",
    event_key: createHash("sha256").update(key).digest("hex"),
    root_call_id: root || params.ParentCallSid || params.CallSid,
    call_leg_id: leg,
    caller:
      params.ParentCallSid || params.DialCallSid
        ? "unknown"
        : params.From || "unknown",
    direction: params.Direction || "inbound",
    status,
    occurred_at:
      params.Timestamp && Number.isFinite(Date.parse(params.Timestamp))
        ? new Date(params.Timestamp).toISOString()
        : new Date().toISOString(),
    duration_seconds: Math.max(
      0,
      Number(params.DialCallDuration || params.CallDuration || 0) || 0,
    ),
    ...(params.RecordingStatus
      ? {
          recording_status:
            params.RecordingStatus === "completed"
              ? "available"
              : params.RecordingStatus === "absent"
                ? "failed"
                : "processing",
        }
      : {}),
  };
}
export function twilioAdapter(token: string): PhoneProvider {
  return {
    name: "twilio",
    verify: (url, params, signature) =>
      twilio.validateRequest(token, signature, url, params),
    event: normaliseTwilio,
  };
}
export function recordingEnabled() {
  return (
    process.env.CALL_RECORDING_ENABLED === "true" &&
    !!process.env.CALL_RECORDING_NOTICE &&
    Number(process.env.CALL_RECORDING_RETENTION_DAYS) > 0 &&
    Number(process.env.CALL_RECORDING_RETENTION_DAYS) <= 365
  );
}
export function voiceResponse(rootSid: string) {
  const response = new twilio.twiml.VoiceResponse();
  const destination = process.env.TWILIO_STAFF_DESTINATION;
  const base = process.env.TWILIO_WEBHOOK_BASE_URL?.replace(/\/$/, "");
  if (!destination || !base) {
    response.say(
      "The call connection is not configured. Please contact Cleaning Maidstone directly.",
    );
    response.hangup();
    return response.toString();
  }
  if (recordingEnabled()) response.say(process.env.CALL_RECORDING_NOTICE!);
  const query = "?rootCallSid=" + encodeURIComponent(rootSid);
  const dial = response.dial({
    answerOnBridge: true,
    action: base + "/api/phone/dial/" + query,
    method: "POST",
    record: recordingEnabled() ? "record-from-answer-dual" : "do-not-record",
    ...(recordingEnabled()
      ? {
          recordingStatusCallback: base + "/api/phone/recording/" + query,
          recordingStatusCallbackMethod: "POST",
          recordingStatusCallbackEvent: ["completed", "absent"],
        }
      : {}),
  });
  dial.number(
    {
      statusCallback: base + "/api/phone/events/" + query,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    },
    destination,
  );
  return response.toString();
}
