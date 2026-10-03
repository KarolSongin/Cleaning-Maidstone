import { test, expect, type Page } from "@playwright/test";
const origin = "http://127.0.0.1:3001";
const rates = {
  customer_rate_pence: 1800,
  admin_rate_pence: 300,
  cleaner_rate_pence: 1500,
};
async function login(page: Page) {
  await page.goto("/login/");
  await page.getByRole("button", { name: "Admin demo", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
}
async function operation(page: Page, action: string, data: unknown) {
  const r = await page.request.post("/api/operations/", {
    headers: { origin },
    data: { action, data },
  });
  expect(r.status(), await r.text()).toBe(200);
  return r.json();
}
const workspace = async (page: Page) =>
  (await page.request.get("/api/operations/")).json();
async function fixture(page: Page, label: string) {
  const name = `${label} ${test.info().project.name}`;
  const customer = await operation(page, "customer", {
    name: `${name} Customer`,
    email: "profiles@example.test",
    phone: "",
    address: "7 Synthetic Profile Lane",
    postcode: "ME14 1AA",
  });
  const response = await page.request.post("/api/cleaners/invite/", {
    headers: { origin },
    data: {
      name: `${name} Cleaner`,
      email: "cleaner-profiles@example.test",
      availability: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        start_time: "08:00",
        end_time: "20:00",
      })),
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  return {
    customer_id: customer.id,
    cleaner_id: (await response.json()).id,
    customerName: `${name} Customer`,
    cleanerName: `${name} Cleaner`,
  };
}
async function book(
  page: Page,
  f: Awaited<ReturnType<typeof fixture>>,
  date: string,
  extra = {},
) {
  return operation(page, "booking", {
    customer_id: f.customer_id,
    cleaner_id: f.cleaner_id,
    date,
    time: "09:00",
    duration_minutes: 90,
    interval_weeks: 0,
    occurrences: 1,
    ...rates,
    ...extra,
  });
}
function writes(page: Page) {
  const actions: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/operations/"))
      actions.push(r.postDataJSON().action);
  });
  return actions;
}

test("customer deletion keeps history and reporting, closes the pipeline and waits for confirmation", async ({
  page,
}) => {
  await login(page);
  const f = await fixture(page, "History");
  const series = await book(page, f, "2000-01-03", {
    interval_weeks: 1,
    duration_weeks: 3,
    occurrences: 3,
  });
  const before = await workspace(page);
  const visits = before.visits.filter(
    (v: { customer_id: string }) => v.customer_id === f.customer_id,
  );
  const finances = before.visit_finances.filter((v: { id: string }) =>
    visits.some((visit: { id: string }) => visit.id === v.id),
  );
  await page.goto("/admin/customers/");
  const row = page.getByRole("row").filter({ hasText: f.customerName });
  const remove = row.getByRole("button", {
    name: `Delete customer ${f.customerName}`,
    exact: true,
  });
  const actions = writes(page);
  await remove.click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this customer?",
    exact: true,
  });
  await expect(dialog).toContainText("Keep all visits, financial records");
  await expect(dialog.locator(".person-name-customer")).toHaveCSS(
    "background-color",
    "rgb(248, 229, 172)",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(remove).toBeFocused();
  expect(actions).toEqual([]);
  await remove.click();
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(actions).toEqual([]);
  await remove.click();
  await page.screenshot({
    path: `test-results/customer-delete-${test.info().project.name}.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Delete customer", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  expect(actions).toEqual(["delete_customer"]);
  const after = await workspace(page);
  expect(
    after.customers.find((c: { id: string }) => c.id === f.customer_id)
      .deleted_at,
  ).toBeTruthy();
  expect(
    after.visits.filter(
      (v: { customer_id: string }) => v.customer_id === f.customer_id,
    ),
  ).toEqual(visits);
  expect(
    after.visit_finances.filter((v: { id: string }) =>
      visits.some((visit: { id: string }) => visit.id === v.id),
    ),
  ).toEqual(finances);
  expect(
    after.series_finances.find((s: { id: string }) => s.id === series.id),
  ).toEqual(
    before.series_finances.find((s: { id: string }) => s.id === series.id),
  );
  expect(
    after.booking_series.some((s: { id: string }) => s.id === series.id),
  ).toBe(false);
  const lead = after.acquisition_leads.find(
    (l: { customer_id: string }) => l.customer_id === f.customer_id,
  );
  expect(lead.stage).toBe("closed");
  await page
    .getByLabel("Show deleted customer profiles", { exact: true })
    .check();
  await expect(row).toContainText("Deleted · history retained");
  await expect(
    row.getByRole("button", { name: /Delete customer/ }),
  ).toHaveCount(0);
  await row.getByRole("button", { name: "View history", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Customer history", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save customer", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/admin/pipeline/?lead=${lead.id}`);
  await expect(
    page.getByText("This customer was deleted from active profiles.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save stage change", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/calendar/");
  await expect(
    page
      .getByRole("combobox", { name: "Customer", exact: true })
      .getByRole("option", { name: f.customerName, exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/finances/");
  await expect(
    page
      .getByRole("combobox", { name: "Customer", exact: true })
      .getByRole("option", {
        name: `${f.customerName} (deleted)`,
        exact: true,
      }),
  ).toHaveCount(1);
  await page.goto("/admin/customers/");
  await expect(
    page.getByRole("row").filter({ hasText: f.customerName }),
  ).toHaveCount(0);
});

test("cleaner deletion lists assigned work, allows cover first and preserves financial history", async ({
  page,
}) => {
  await login(page);
  const f = await fixture(page, "Cover removal"),
    cover = await fixture(page, "Retained cover");
  const series = await book(page, f, "2200-07-01", {
    interval_weeks: 1,
    duration_weeks: 2,
    occurrences: 2,
  });
  const data = await workspace(page);
  const visits = data.visits.filter(
    (v: { series_id: string }) => v.series_id === series.id,
  );
  await page.goto("/admin/cleaners/");
  const actions = writes(page);
  const remove = page.getByRole("button", {
    name: `Delete cleaner ${f.cleanerName}`,
    exact: true,
  });
  await remove.click();
  const blockers = page.getByRole("region", {
    name: `Visits blocking deletion of ${f.cleanerName}`,
    exact: true,
  });
  await expect(blockers).toContainText("2 cleans need attention");
  await expect(
    blockers.getByRole("link", { name: "Open visit →", exact: true }),
  ).toHaveCount(2);
  expect(actions).toEqual([]);
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await page.screenshot({
    path: `test-results/cleaner-delete-blocked-${test.info().project.name}.png`,
  });
  for (const visit of visits)
    await operation(page, "visit", {
      id: visit.id,
      cleaner_id: cover.cleaner_id,
    });
  const before = await workspace(page);
  await remove.click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this cleaner?",
    exact: true,
  });
  await expect(dialog).toContainText("disable their portal access");
  await expect(dialog.locator(".person-name-cleaner")).toHaveCSS(
    "background-color",
    "rgb(247, 214, 226)",
  );
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  expect(actions).toEqual([]);
  await remove.click();
  await dialog
    .getByRole("button", { name: "Delete cleaner", exact: true })
    .click();
  await expect(remove).toHaveCount(0);
  expect(actions).toEqual(["delete_cleaner"]);
  const after = await workspace(page);
  expect(
    after.cleaners.find((c: { id: string }) => c.id === f.cleaner_id),
  ).toMatchObject({ active: false, deleted_at: expect.any(String) });
  expect(
    after.visits.filter(
      (v: { series_id: string }) => v.series_id === series.id,
    ),
  ).toEqual(
    before.visits.filter(
      (v: { series_id: string }) => v.series_id === series.id,
    ),
  );
  expect(
    after.series_finances.find((s: { id: string }) => s.id === series.id),
  ).toEqual(
    before.series_finances.find((s: { id: string }) => s.id === series.id),
  );
  await page
    .getByLabel("Show deleted cleaner profiles", { exact: true })
    .check();
  const profile = page
    .locator(".data-list > li")
    .filter({ hasText: f.cleanerName });
  await expect(profile).toContainText("Deleted · history retained");
  await expect(profile.getByRole("button", { name: /Edit hours/ })).toHaveCount(
    0,
  );
  await page.goto("/admin/calendar/");
  await expect(
    page
      .getByRole("combobox", { name: "Cleaner", exact: true })
      .getByRole("option", { name: f.cleanerName, exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/finances/");
  await expect(
    page
      .getByRole("combobox", { name: "Cleaner", exact: true })
      .getByRole("option", { name: `${f.cleanerName} (deleted)`, exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("deletion checks fresh assignments and rejects work added while confirmation is open", async ({
  page,
}) => {
  await login(page);
  const f = await fixture(page, "Stale removal");
  await page.goto("/admin/customers/");
  const first = await book(page, f, "2200-08-01");
  const actions = writes(page);
  const remove = page.getByRole("button", {
    name: `Delete customer ${f.customerName}`,
    exact: true,
  });
  await remove.click();
  const blockers = page.getByRole("region", {
    name: `Visits blocking deletion of ${f.customerName}`,
    exact: true,
  });
  await expect(blockers).toContainText("1 clean needs attention");
  expect(actions).toEqual([]);
  await operation(page, "visit", { id: first.id, status: "cancelled" });
  await remove.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toHaveAccessibleName("Delete this customer?");
  const later = await book(page, f, "2200-08-02");
  await dialog
    .getByRole("button", { name: "Delete customer", exact: true })
    .click();
  await expect(page.locator(".profile-deletion .alert-error")).toContainText(
    "Cancel upcoming visits",
  );
  await expect(
    blockers.getByRole("link", { name: "Open visit →", exact: true }),
  ).toHaveAttribute("href", `/admin/calendar/?visit=${later.id}`);
  expect(
    (await workspace(page)).customers.find(
      (c: { id: string }) => c.id === f.customer_id,
    ).deleted_at,
  ).toBeNull();
  await operation(page, "visit", { id: later.id, status: "cancelled" });
  await remove.click();
  await dialog
    .getByRole("button", { name: "Delete customer", exact: true })
    .click();
  await expect(remove).toHaveCount(0);
  expect(actions).toEqual(["delete_customer", "delete_customer"]);
  expect(
    (await workspace(page)).visits.filter(
      (v: { customer_id: string }) => v.customer_id === f.customer_id,
    ),
  ).toHaveLength(2);
});
