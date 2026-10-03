// The persistent local demo has a server clock; live deployments use pg_cron
// or the authenticated job endpoint rather than a serverless process timer.
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.DEMO_MODE !== "local" ||
    process.env.VERCEL
  )
    return;
  const clock = globalThis as typeof globalThis & {
    maidstonePipelineTimer?: ReturnType<typeof setInterval>;
  };
  if (clock.maidstonePipelineTimer) return;
  const { localQuery } = await import("@/lib/local-db");
  let running = false;
  clock.maidstonePipelineTimer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await localQuery(
        "service_role",
        "select public.run_customer_pipeline_job()",
      );
    } catch {
      console.error(
        "Customer pipeline clock could not update stages; it will retry next minute.",
      );
    } finally {
      running = false;
    }
  }, 60000);
  clock.maidstonePipelineTimer.unref();
}
