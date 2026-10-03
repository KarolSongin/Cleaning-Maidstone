import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ localQuery: vi.fn() }));
vi.mock("@/lib/local-db", () => mocks);
import { register } from "@/instrumentation";
const clock = globalThis as typeof globalThis & {
  maidstonePipelineTimer?: ReturnType<typeof setInterval>;
};
afterEach(() => {
  clearInterval(clock.maidstonePipelineTimer);
  delete clock.maidstonePipelineTimer;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  mocks.localQuery.mockReset();
});
const local = () => {
  vi.useFakeTimers();
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("DEMO_MODE", "local");
  vi.stubEnv("VERCEL", "");
};
describe("persistent local pipeline clock", () => {
  it("starts once, does not open the database at startup, and updates without a browser request", async () => {
    local();
    mocks.localQuery.mockResolvedValue([]);
    await register();
    await register();
    expect(vi.getTimerCount()).toBe(1);
    expect(mocks.localQuery).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.localQuery).toHaveBeenCalledWith(
      "service_role",
      "select public.run_customer_pipeline_job()",
    );
    expect(mocks.localQuery).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.localQuery).toHaveBeenCalledTimes(2);
  });
  it("never starts a process clock in live/serverless or edge environments", async () => {
    local();
    vi.stubEnv("DEMO_MODE", "");
    await register();
    vi.stubEnv("DEMO_MODE", "local");
    vi.stubEnv("VERCEL", "1");
    await register();
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.localQuery).not.toHaveBeenCalled();
  });
  it("skips overlapping runs while a database job is still running", async () => {
    local();
    let finish!: () => void;
    mocks.localQuery
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue([]);
    await register();
    vi.advanceTimersByTime(60000);
    vi.advanceTimersByTime(60000);
    expect(mocks.localQuery).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.localQuery).toHaveBeenCalledTimes(2);
  });
  it("retries a failed run on the next minute without logging private data", async () => {
    local();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.localQuery
      .mockRejectedValueOnce(new Error("Private database detail"))
      .mockResolvedValue([]);
    await register();
    await vi.advanceTimersByTimeAsync(120000);
    expect(mocks.localQuery).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls.flat().join(" ")).not.toContain(
      "Private database detail",
    );
  });
});
