import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const state = vi.hoisted(() => ({ db: null as PGlite | null, token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: state.token }) }),
}));
vi.mock("@/lib/local-db", async (original) => ({
  ...(await original<typeof import("@/lib/local-db")>()),
  demoEnabled: () => true,
  getLocalDb: async () => state.db!,
}));
import { initialiseDatabase, DEMO_ADMIN, DEMO_CLEANER } from "@/lib/local-db";
import { demoToken, getActor } from "@/lib/auth";

beforeAll(async () => {
  state.db = new PGlite({ extensions: { btree_gist } });
  await initialiseDatabase(state.db, true);
}, 30000);
afterAll(async () => {
  await state.db?.close();
});
it("denies an existing signed cleaner session after deletion and keeps admin access", async () => {
  state.token = await demoToken("cleaner");
  expect(await getActor()).toMatchObject({ id: DEMO_CLEANER, role: "cleaner" });
  await state.db!.query(
    "update visits set status='cancelled' where cleaner_id=$1",
    [DEMO_CLEANER],
  );
  await state.db!.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      DEMO_ADMIN,
    ]);
    await tx.query("select delete_cleaner($1)", [DEMO_CLEANER]);
  });
  expect(await getActor()).toBeNull();
  state.token = await demoToken("admin");
  expect(await getActor()).toMatchObject({ id: DEMO_ADMIN, role: "admin" });
});
