import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "./supabase";
export async function deleteExternalTranscript(id: string) {
  if (!process.env.ASSEMBLYAI_API_KEY)
    throw new Error("TRANSCRIPT_DELETION_UNCONFIGURED");
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id))
    throw new Error("INVALID_TRANSCRIPT_ID");
  const response = await fetch(
    "https://api.assemblyai.com/v2/transcript/" + id,
    {
      method: "DELETE",
      headers: { authorization: process.env.ASSEMBLYAI_API_KEY },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    },
  );
  if (!response.ok && response.status !== 404)
    throw new Error("TRANSCRIPT_DELETION_FAILED");
}
export function secureEqual(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function transcriptionConfigured() {
  return (
    process.env.TRANSCRIPTION_ENABLED === "true" &&
    !!process.env.ASSEMBLYAI_API_KEY &&
    !!process.env.TRANSCRIPTION_WEBHOOK_SECRET &&
    !!process.env.TWILIO_WEBHOOK_BASE_URL
  );
}
export async function assemblyRequest(path: string, body?: unknown) {
  const response = await fetch("https://api.assemblyai.com/v2/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: process.env.ASSEMBLYAI_API_KEY!,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("TRANSCRIPTION_PROVIDER_UNAVAILABLE");
  return response.json();
}
export async function dispatchTranscription(job: {
  id: string;
  provider_sid: string;
  private_path: string | null;
}) {
  let bytes: ArrayBuffer;
  if (job.private_path) {
    const { data, error } = await serviceClient()
      .storage.from("call-recordings")
      .download(job.private_path);
    if (error || !data) throw new Error("AUDIO_UNAVAILABLE");
    bytes = await data.arrayBuffer();
  } else {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)
      throw new Error("PHONE_PROVIDER_UNCONFIGURED");
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${job.provider_sid}.mp3`,
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.TWILIO_ACCOUNT_SID +
                ":" +
                process.env.TWILIO_AUTH_TOKEN,
            ).toString("base64"),
        },
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
        redirect: "error",
      },
    );
    if (!r.ok || Number(r.headers.get("content-length")) > 50000000)
      throw new Error("AUDIO_UNAVAILABLE");
    bytes = await r.arrayBuffer();
  }
  if (bytes.byteLength > 50000000) throw new Error("AUDIO_TOO_LARGE");
  const upload = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      authorization: process.env.ASSEMBLYAI_API_KEY!,
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!upload.ok) throw new Error("AUDIO_UPLOAD_FAILED");
  const result = await upload.json();
  const transcript = await assemblyRequest("transcript", {
    audio_url: result.upload_url,
    language_code: "en_uk",
    webhook_url:
      process.env.TWILIO_WEBHOOK_BASE_URL!.replace(/\/$/, "") +
      "/api/transcriptions/callback/?job=" +
      job.id,
    webhook_auth_header_name: "X-Transcription-Token",
    webhook_auth_header_value: process.env.TRANSCRIPTION_WEBHOOK_SECRET,
  });
  return String(transcript.id);
}
