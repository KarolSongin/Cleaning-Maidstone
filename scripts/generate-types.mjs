import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "node:fs/promises";
const db = new PGlite({ extensions: { btree_gist } });
await db.exec(
  `create schema auth; create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public,auth to anon,authenticated,service_role; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
);
const migrations = await Promise.all(
  [
    "202610020001_foundation.sql",
    "202610020004_transcription_jobs.sql",
    "202610030001_cleaner_availability.sql",
  ].map((n) => fs.readFile("supabase/migrations/" + n, "utf8")),
);
for (const sql of migrations) await db.exec(sql);
const types = (t) =>
  t.endsWith("[]")
    ? types(t.slice(0, -2)) + "[]"
    : /^(integer|smallint|bigint|numeric|double precision|real)$/.test(t)
      ? "number"
      : t === "boolean"
        ? "boolean"
        : t === "jsonb" || t === "json"
          ? "Json"
          : t === "void"
            ? "undefined"
            : t === "trigger"
              ? "unknown"
              : "string";
const columns = (
  await db.query(
    `select table_name,column_name,is_nullable,column_default,data_type,udt_name from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
  )
).rows;
const tables = {};
for (const c of columns) {
  (tables[c.table_name] ??= []).push(c);
}
let out = `// Generated from applied migrations by npm run db:types:demo. Do not edit.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n`;
for (const [name, cols] of Object.entries(tables)) {
  out += `${name}: { Row: {\n`;
  for (const c of cols)
    out += `${c.column_name}: ${types(c.data_type === "ARRAY" ? "text[]" : c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};\n`;
  out += "}; Insert: {\n";
  for (const c of cols)
    out += `${c.column_name}${c.column_default || c.is_nullable === "YES" || c.column_name === "id" ? "?" : ""}: ${types(c.data_type === "ARRAY" ? "text[]" : c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};\n`;
  out += "}; Update: {\n";
  for (const c of cols)
    out += `${c.column_name}?: ${types(c.data_type === "ARRAY" ? "text[]" : c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};\n`;
  out += "}; Relationships: [] };\n";
}
out += "}; Views: Record<string, never>; Functions: {\n";
const funcs = (
  await db.query(
    `select p.proname,pg_get_function_result(p.oid) as result,pg_get_function_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname not like 'gbt_%' and p.proname not like 'btree_%' order by p.proname`,
  )
).rows;
const applicationFunctions = new Set(
  [
    ...migrations
      .join("\n")
      .matchAll(/create(?: or replace)? function public\.([a-z_]+)/g),
  ].map((m) => m[1]),
);
for (const f of funcs) {
  if (!applicationFunctions.has(f.proname)) continue;
  if (f.result === "trigger" || f.proname.startsWith("fetchval")) continue;
  let ret = types(f.result);
  if (f.result.startsWith("TABLE(")) {
    ret =
      "{" +
      f.result
        .slice(6, -1)
        .split(", ")
        .map((c) => {
          const [n, ...t] = c.split(" ");
          return n + ": " + types(t.join(" "));
        })
        .join(";") +
      "}[]";
  }
  const args = f.args
    ? f.args
        .split(", ")
        .map((c) => {
          const [n, ...t] = c.split(" ");
          return n + ": " + types(t.join(" "));
        })
        .join(";")
    : "";
  out += `${f.proname}: { Args: ${args ? "{" + args + "}" : "Record<string, never>"}; Returns: ${ret} };\n`;
}
out +=
  "}; Enums: Record<string, never>; CompositeTypes: Record<string, never> } };\n";
await fs.writeFile("src/lib/database.types.ts", out);
await db.close();
console.log(
  "Generated",
  Object.keys(tables).length,
  "table types from the applied migration",
);
