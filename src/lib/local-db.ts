import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "node:fs/promises";
import path from "node:path";
import type { Actor } from "./models";

export const DEMO_ADMIN = "11111111-1111-4111-8111-111111111111";
export const DEMO_CLEANER = "22222222-2222-4222-8222-222222222222";
export const DEMO_SECOND_CLEANER = "33333333-3333-4333-8333-333333333333";
export function demoEnabled() {
  return process.env.DEMO_MODE === "local" && !process.env.VERCEL;
}
export const localBootstrap = `
create schema if not exists auth;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public,auth to anon,authenticated,service_role;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant execute on function auth.uid() to anon,authenticated,service_role;
`;
export async function initialiseDatabase(db: PGlite, seed = false) {
  const exists = await db.query<{ exists: boolean }>(
    "select exists(select 1 from information_schema.tables where table_schema='public' and table_name='profiles')",
  );
  if (!exists.rows[0].exists) {
    await db.transaction(async (tx) => {
      await tx.exec(localBootstrap);
      await tx.exec(
        await fs.readFile(
          path.join(
            process.cwd(),
            "supabase/migrations/202610020001_foundation.sql",
          ),
          "utf8",
        ),
      );
    });
  }
  const jobs = await db.query<{ exists: boolean }>(
    "select exists(select 1 from information_schema.tables where table_schema='public' and table_name='transcription_jobs')",
  );
  if (!jobs.rows[0].exists)
    await db.exec(
      await fs.readFile(
        path.join(
          process.cwd(),
          "supabase/migrations/202610020004_transcription_jobs.sql",
        ),
        "utf8",
      ),
    );
  const hours = await db.query<{ exists: boolean }>(
    "select to_regprocedure('public.save_cleaner_availability(jsonb)') is not null as exists",
  );
  if (!hours.rows[0].exists)
    await db.transaction(async (tx) => {
      await tx.exec(
        await fs.readFile(
          path.join(
            process.cwd(),
            "supabase/migrations/202610030001_cleaner_availability.sql",
          ),
          "utf8",
        ),
      );
    });
  const periods = await db.query<{ exists: boolean }>(
    "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='booking_series' and column_name='ends_on')",
  );
  if (!periods.rows[0].exists)
    await db.transaction(async (tx) => {
      await tx.exec(
        await fs.readFile(
          path.join(
            process.cwd(),
            "supabase/migrations/202610030002_recurring_bookings.sql",
          ),
          "utf8",
        ),
      );
    });
  const finances = await db.query<{ exists: boolean }>(
    "select to_regclass('public.visit_finances') is not null as exists",
  );
  if (!finances.rows[0].exists)
    await db.transaction(async (tx) => {
      await tx.exec(
        await fs.readFile(
          path.join(
            process.cwd(),
            "supabase/migrations/202610030003_booking_finances.sql",
          ),
          "utf8",
        ),
      );
    });
  if (!exists.rows[0].exists && seed) await seedDatabase(db);
}
async function seedDatabase(db: PGlite) {
  await db.exec(`insert into auth.users(id,raw_user_meta_data) values('${DEMO_ADMIN}','{"display_name":"Alex · demo admin"}'),('${DEMO_CLEANER}','{"display_name":"Jamie · demo cleaner"}'),('${DEMO_SECOND_CLEANER}','{"display_name":"Taylor · demo cleaner"}');
 update profiles set role='admin' where id='${DEMO_ADMIN}';
 insert into cleaners(id,name) values('${DEMO_CLEANER}','Jamie Morgan'),('${DEMO_SECOND_CLEANER}','Taylor Reed');
 insert into availability(cleaner_id,weekday,start_time,end_time) select c.id,d,'08:00','20:00' from cleaners c cross join generate_series(0,6) d;
 insert into customers(id,name,email,phone,address,postcode,preferences,internal_notes) values('44444444-4444-4444-8444-444444444444','Sam Ellis','sam@example.test','+447700900123','12 Example Lane (synthetic address)','ME14 1AA','Kitchen and bathrooms first.','Synthetic internal CRM note — never visible to cleaners.');
 insert into visits(customer_id,cleaner_id,starts_at,ends_at,instructions) values('44444444-4444-4444-8444-444444444444','${DEMO_CLEANER}',((current_date+1)+time '09:00') at time zone 'Europe/London',((current_date+1)+time '12:00') at time zone 'Europe/London','Synthetic job. Prioritise kitchen, bathrooms and reachable surfaces.');
 insert into follow_up_tasks(title,due_on) values('Sample: confirm next week’s preferred days',current_date+1);`);
  await db.query(
    `insert into content(kind,slug,title,excerpt,seo_title,seo_description,body,author,category,status,published_at) values('blog','preparing-for-your-first-regular-clean','A little preparation, a better first clean','Five practical things to discuss before your first regular visit.','Preparing for your first regular clean | Cleaning Maidstone','Agree your priorities, equipment, surfaces and access before your first regular domestic clean.',$1,'Cleaning Maidstone','At home','published',now())`,
    [
      JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "A useful first clean starts with a conversation about your home. Here are five things to have ready.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Choose your priorities" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Tell your cleaner which rooms matter most and what you would like completed within the agreed time. Mention delicate surfaces, allergies and pets. Leave a safe working vacuum cleaner and a suitable mop ready. Confirm access and parking before the appointment.",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Weekly and fortnightly availability depends on the local diary. An enquiry is the first step; it does not confirm a booking.",
              },
            ],
          },
        ],
      }),
    ],
  );
}
const globalDb = globalThis as typeof globalThis & {
  maidstoneDb?: Promise<PGlite>;
};
export async function getLocalDb() {
  if (!demoEnabled()) throw new Error("Local demo is disabled");
  globalDb.maidstoneDb ??= (async () => {
    await fs.mkdir(path.join(process.cwd(), ".local"), { recursive: true });
    const name = process.env.DEMO_DATABASE_NAME || "database";
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(name))
      throw new Error("Use a simple local demo database name");
    const databasePath = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      ".local",
      name,
    );
    const db = new PGlite(databasePath, {
      extensions: { btree_gist },
    });
    await db.waitReady;
    await initialiseDatabase(db, true);
    return db;
  })();
  return globalDb.maidstoneDb;
}
export async function localQuery<T>(
  actor: Actor | "anon" | "service_role",
  sql: string,
  params: unknown[] = [],
) {
  const db = await getLocalDb();
  return db.transaction(async (tx) => {
    const role = typeof actor === "string" ? actor : "authenticated";
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      typeof actor === "string" ? "" : actor.id,
    ]);
    return (await tx.query<T>(sql, params)).rows;
  });
}
