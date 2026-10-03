import { test, expect, type Page } from "@playwright/test";
import { Temporal } from "@js-temporal/polyfill";
const origin = "http://127.0.0.1:3001";
const rates = {
  customer_rate_pence: 1800,
  admin_rate_pence: 300,
  cleaner_rate_pence: 1500,
};
async function login(page: Page, role: "admin" | "cleaner") {
  await page.goto("/login/");
  await page
    .getByRole("button", {
      name: role === "admin" ? "Admin demo" : "Cleaner demo",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    role === "admin" ? /\/admin\/$/ : /\/cleaner\/$/,
  );
}
async function operation(page: Page, action: string, data: unknown) {
  const response = await page.request.post("/api/operations/", {
    headers: { origin },
    data: { action, data },
  });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
const workspace = async (page: Page) =>
  (await page.request.get("/api/operations/")).json();
function writes(page: Page) {
  const actions: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/operations/")
    )
      actions.push(request.postDataJSON().action);
  });
  return actions;
}

test("series deletion waits for confirmation and preserves historical work and finances", async ({
  page,
}) => {
  test.setTimeout(60000);
  const project = test.info().project.name;
  await login(page, "admin");
  const customerName = `Deletion Client ${project}`;
  const client = await operation(page, "customer", {
    name: customerName,
    email: "deletion@example.test",
    phone: "",
    address: "4 Synthetic Deletion Lane",
    postcode: "ME14 1AA",
  });
  const before = await workspace(page);
  const cleaner = before.cleaners.find(
    (item: { name: string }) => item.name === "Jamie Morgan",
  );
  const start = Temporal.Now.plainDateISO("Europe/London")
    .subtract({ days: 14 })
    .toString();
  const series = await operation(page, "booking", {
    customer_id: client.id,
    cleaner_id: cleaner.id,
    date: start,
    // The financial-report journey books Jamie at 16:00 after the desktop run.
    time: project === "desktop" ? "13:00" : "14:30",
    duration_minutes: 60,
    interval_weeks: 1,
    duration_weeks: 6,
    occurrences: 6,
    ...rates,
  });
  const data = await workspace(page);
  const visits = data.visits
    .filter((visit: { series_id: string }) => visit.series_id === series.id)
    .sort((a: { starts_at: string }, b: { starts_at: string }) =>
      a.starts_at.localeCompare(b.starts_at),
    );
  await operation(page, "visit", { id: visits[5].id, status: "cancelled" });
  await login(page, "cleaner");
  for (const index of [0, 2, 3])
    await operation(page, "transition", {
      id: visits[index].id,
      status: "started",
    });
  for (const index of [0, 3])
    await operation(page, "transition", {
      id: visits[index].id,
      status: "completed",
    });
  const forbidden = await page.request.post("/api/operations/", {
    headers: { origin },
    data: { action: "delete_series", data: { id: series.id } },
  });
  expect(forbidden.status()).toBe(403);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await login(page, "admin");
  const snapshot = await workspace(page);
  const retainedIds = visits
    .slice(0, 4)
    .map((visit: { id: string }) => visit.id);
  await page.goto("/admin/recurring/");
  const card = page.getByRole("article", {
    name: `${customerName} recurring booking`,
    exact: true,
  });
  const remove = card.getByRole("button", {
    name: `Delete series for ${customerName}`,
    exact: true,
  });
  const actions = writes(page);
  await remove.click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this recurring series?",
    exact: true,
  });
  await expect(dialog).toContainText("delete 2 upcoming unstarted visits");
  await expect(dialog).toContainText(
    "Keep 4 past, completed or in-progress visits",
  );
  await expect(dialog.locator(".person-name-customer")).toHaveCSS(
    "background-color",
    "rgb(248, 229, 172)",
  );
  await expect(
    dialog.getByRole("button", { name: "Go back", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Delete series", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(remove).toBeFocused();
  expect(actions).toEqual([]);
  expect(
    (await workspace(page)).visits.filter(
      (visit: { series_id: string }) => visit.series_id === series.id,
    ),
  ).toHaveLength(6);
  await remove.click();
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(actions).toEqual([]);
  await remove.click();
  await page.screenshot({
    path: `test-results/series-delete-confirmation-${project}.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // A repeated confirm click must still result in one deletion request.
  await dialog
    .locator("[data-confirm-accept]")
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(card).toHaveCount(0);
  expect(actions).toEqual(["delete_series"]);
  const after = await workspace(page);
  expect(
    after.booking_series.some((item: { id: string }) => item.id === series.id),
  ).toBe(false);
  expect(
    after.visits.filter(
      (visit: { series_id: string }) => visit.series_id === series.id,
    ),
  ).toEqual(
    snapshot.visits.filter((visit: { id: string }) =>
      retainedIds.includes(visit.id),
    ),
  );
  expect(
    after.visit_finances.filter((finance: { id: string }) =>
      retainedIds.includes(finance.id),
    ),
  ).toEqual(
    snapshot.visit_finances.filter((finance: { id: string }) =>
      retainedIds.includes(finance.id),
    ),
  );
  expect(
    after.series_finances.find(
      (finance: { id: string }) => finance.id === series.id,
    ),
  ).toEqual(
    snapshot.series_finances.find(
      (finance: { id: string }) => finance.id === series.id,
    ),
  );
  await page.reload();
  await expect(card).toHaveCount(0);
  await login(page, "cleaner");
  const own = await workspace(page);
  expect(
    own.jobs.some((job: { id: string }) =>
      [visits[4].id, visits[5].id].includes(job.id),
    ),
  ).toBe(false);
  expect(own.jobs.some((job: { id: string }) => job.id === visits[2].id)).toBe(
    true,
  );
});

test("admin saves and visit cancellation send no changes until approved", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/admin/customers/");
  const name = `Confirm Customer ${test.info().project.name}`;
  await page.getByLabel("Customer name", { exact: true }).fill(name);
  await page.getByLabel("Home address").fill("8 Synthetic Confirm Lane");
  await page.getByLabel("Postcode", { exact: true }).fill("ME14 1AA");
  const actions = writes(page);
  await page
    .getByRole("button", { name: "Save customer", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toHaveAccessibleName("Create this customer?");
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(actions).toEqual([]);
  await expect(page.getByLabel("Customer name", { exact: true })).toHaveValue(
    name,
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save customer", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm save", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  const data = await workspace(page);
  const client = data.customers.find(
    (customer: { name: string }) => customer.name === name,
  );
  const cleaner = data.cleaners.find(
    (item: { name: string }) => item.name === "Taylor Reed",
  );
  const booked = await operation(page, "booking", {
    customer_id: client.id,
    cleaner_id: cleaner.id,
    date: test.info().project.name === "desktop" ? "2105-06-01" : "2106-06-01",
    time: "13:00",
    duration_minutes: 60,
    interval_weeks: 0,
    occurrences: 1,
    ...rates,
  });
  await page.goto(`/admin/calendar/?visit=${booked.id}`);
  const event = page.locator(".fc-event").filter({ hasText: name });
  await expect(event).toHaveCount(1);
  const cancel = page.getByRole("button", {
    name: "Cancel this occurrence",
    exact: true,
  });
  await cancel.click();
  await expect(dialog).toHaveAccessibleName("Cancel this visit?");
  expect(actions).toEqual(["customer"]);
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    (await workspace(page)).visits.find(
      (visit: { id: string }) => visit.id === booked.id,
    ).status,
  ).toBe("scheduled");
  await cancel.click();
  const cancelled = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      request.url().endsWith("/api/operations/") &&
      request.postDataJSON().action === "visit"
    );
  });
  await dialog
    .getByRole("button", { name: "Cancel visit", exact: true })
    .click();
  expect((await cancelled).status()).toBe(200);
  await expect(event).toHaveCount(0);
  expect(
    (await workspace(page)).visits.find(
      (visit: { id: string }) => visit.id === booked.id,
    ).status,
  ).toBe("cancelled");
  expect(actions).toEqual(["customer", "visit"]);
  await expect(page.locator(".ops-main .alert-error")).toHaveCount(0);
});

test("publishing and unpublishing require explicit confirmation", async ({
  page,
  request,
}) => {
  await login(page, "admin");
  await page.goto("/admin/content/");
  const slug = `confirm-article-${test.info().project.name}`;
  const title = `Confirmation Article ${test.info().project.name}`;
  await page.getByLabel("URL slug", { exact: true }).fill(slug);
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .locator(".tiptap")
    .fill("Synthetic content for confirmation checks.");
  const actions = writes(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toHaveAccessibleName("Publish these changes?");
  expect((await request.get(`/blog/${slug}/`)).status()).toBe(404);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(actions).toEqual([]);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Publish changes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Published.");
  expect((await request.get(`/blog/${slug}/`)).status()).toBe(200);
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page
    .getByRole("button", { name: "Save draft / unpublish", exact: true })
    .click();
  await expect(dialog).toHaveAccessibleName("Unpublish this content?");
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await request.get(`/blog/${slug}/`)).status()).toBe(200);
  await page
    .getByRole("button", { name: "Save draft / unpublish", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved as a draft");
  expect((await request.get(`/blog/${slug}/`)).status()).toBe(404);
  expect(actions).toEqual(["content", "content"]);
});

test("calendar dragging and cleaner request approval wait for confirmation", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const project = test.info().project.name;
  await login(page, "admin");
  const name = `Schedule Client ${project}`;
  const client = await operation(page, "customer", {
    name,
    email: "",
    phone: "",
    address: "6 Synthetic Schedule Lane",
    postcode: "ME14 1AA",
  });
  const data = await workspace(page);
  const cleaner = data.cleaners.find(
    (item: { name: string }) => item.name === "Taylor Reed",
  );
  const visit = await operation(page, "booking", {
    customer_id: client.id,
    cleaner_id: cleaner.id,
    date: project === "desktop" ? "2107-08-01" : "2108-08-01",
    time: "13:00",
    duration_minutes: 60,
    interval_weeks: 0,
    occurrences: 1,
    ...rates,
  });
  const original = (await workspace(page)).visits.find(
    (item: { id: string }) => item.id === visit.id,
  ).starts_at;
  await page.goto(`/admin/calendar/?visit=${visit.id}`);
  await page.getByRole("button", { name: "Day", exact: true }).click();
  const event = page.locator(".fc-timegrid-event").filter({ hasText: name });
  const actions = writes(page);
  const drag = async () => {
    await event.scrollIntoViewIfNeeded();
    const box = (await event.boundingBox())!;
    const start = (await page
      .locator('.fc-timegrid-slots [data-time="13:00:00"]')
      .first()
      .boundingBox())!;
    const end = (await page
      .locator('.fc-timegrid-slots [data-time="14:00:00"]')
      .first()
      .boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 8 + end.y - start.y, {
      steps: 12,
    });
    await page.mouse.up();
  };
  await drag();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toHaveAccessibleName("Change this visit?");
  expect(actions).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(event.locator(".calendar-event-time")).toContainText("13:00");
  expect(
    (await workspace(page)).visits.find(
      (item: { id: string }) => item.id === visit.id,
    ).starts_at,
  ).toBe(original);
  await drag();
  await dialog
    .getByRole("button", { name: "Confirm save", exact: true })
    .click();
  await expect(event.locator(".calendar-event-time")).toContainText("14:00");
  expect(
    Date.parse(
      (await workspace(page)).visits.find(
        (item: { id: string }) => item.id === visit.id,
      ).starts_at,
    ),
  ).toBe(Date.parse(original) + 3600000);
  expect(actions).toEqual(["visit"]);

  const cleanerContext = await browser.newContext({ baseURL: origin });
  const from = project === "desktop" ? "2110-01-01" : "2111-01-01";
  let leaveId: string;
  try {
    const cleanerPage = await cleanerContext.newPage();
    await login(cleanerPage, "cleaner");
    leaveId = (
      await operation(cleanerPage, "leave", {
        starts_on: from,
        ends_on: from,
        reason: "Confirmation review",
      })
    ).id;
  } finally {
    await cleanerContext.close();
  }
  await page.goto("/admin/cleaners/");
  const card = page.getByRole("article", {
    name: `Time off for Jamie Morgan: ${from} to ${from}`,
    exact: true,
  });
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Approve this time-off request?");
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    (await workspace(page)).leave_requests.find(
      (request: { id: string }) => request.id === leaveId,
    ).status,
  ).toBe("pending");
  expect(actions).toEqual(["visit"]);
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await expect(card.locator(".badge-approved")).toHaveText("approved");
  expect(actions).toEqual(["visit", "review"]);
});
