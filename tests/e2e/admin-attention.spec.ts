import { test, expect } from "./fixtures";
import type { Page, Locator } from "@playwright/test";

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
async function badgeCount(link: Locator) {
  const badge = link.locator(".nav-attention");
  return (await badge.count()) ? Number(await badge.textContent()) : 0;
}
async function expectCount(link: Locator, count: number) {
  if (count)
    await expect(link.locator(".nav-attention")).toHaveText(String(count));
  else await expect(link.locator(".nav-attention")).toHaveCount(0);
}

test("admin menu tracks outstanding actions across pages and people keep their colours", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin");
  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  const cleanersLink = nav.getByRole("link", { name: "Cleaners", exact: true });
  const initialCleanerCount = await badgeCount(cleanersLink);
  await nav.getByRole("link", { name: "Customers", exact: true }).click();
  await expect(page.locator("td .person-name-customer").first()).toHaveCSS(
    "background-color",
    "rgb(248, 229, 172)",
  );
  await expect(page.getByLabel("Customer name", { exact: true })).toHaveCSS(
    "background-color",
    "rgb(248, 229, 172)",
  );

  // Another logged-in person creates requests while the admin stays on Customers.
  const cleanerContext = await browser.newContext({
    viewport: page.viewportSize()!,
  });
  try {
    const cleanerPage = await cleanerContext.newPage();
    await login(cleanerPage, "cleaner");
    await expect(cleanerPage.locator(".nav-attention")).toHaveCount(0);
    await expect(
      cleanerPage.locator(".ops-topbar .person-name-cleaner"),
    ).toHaveCSS("background-color", "rgb(247, 214, 226)");
    const year = test.info().project.name === "desktop" ? 2037 : 2038;
    const first = `${year}-06-01`;
    const last = `${year}-06-02`;
    const leavePanel = cleanerPage.locator("section.panel").filter({
      has: cleanerPage.getByRole("heading", {
        name: "Request time off",
        exact: true,
      }),
    });
    await leavePanel.getByLabel("From", { exact: true }).fill(first);
    await leavePanel.getByLabel("To", { exact: true }).fill(last);
    await leavePanel
      .getByLabel("Note for your admin")
      .fill(`Notification review ${year}`);
    await leavePanel
      .getByRole("button", { name: "Send leave request", exact: true })
      .click();
    await expect(leavePanel.getByRole("status")).toContainText(
      "Saved successfully",
    );
    const availability = cleanerPage.locator("section.panel").filter({
      has: cleanerPage.getByRole("heading", {
        name: "Request an availability change",
        exact: true,
      }),
    });
    await availability.locator('select[name="weekday"]').selectOption("0");
    await availability
      .getByLabel("Available from", { exact: true })
      .fill("06:15");
    await availability
      .getByLabel("Available until", { exact: true })
      .fill("06:45");
    await availability
      .getByRole("button", { name: "Send availability request", exact: true })
      .click();
    await expect(availability.getByRole("status")).toContainText(
      "Saved successfully",
    );

    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expectCount(cleanersLink, initialCleanerCount + 2);
    await expect(cleanersLink).toHaveAccessibleDescription(
      `${initialCleanerCount + 2} time-off or availability requests awaiting review`,
    );
    await expect(page).toHaveURL(/\/admin\/customers\/$/);
    await cleanersLink.click();
    await expectCount(cleanersLink, initialCleanerCount + 2);
    const card = page.getByRole("article", {
      name: `Time off for Jamie Morgan: ${first} to ${last}`,
      exact: true,
    });
    await expect(card.locator("h3 .person-name-cleaner")).toHaveCSS(
      "background-color",
      "rgb(247, 214, 226)",
    );
    await card.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(card.locator(".badge-approved")).toHaveText("approved");
    await expectCount(cleanersLink, initialCleanerCount + 1);
    const changes = page.locator("section.panel").filter({
      has: page.getByRole("heading", {
        name: "Availability changes for review",
        exact: true,
      }),
    });
    const request = changes
      .getByRole("listitem")
      .filter({ hasText: /Sunday 06:15(?::00)?–06:45(?::00)?/ })
      .filter({ has: page.locator(".badge-pending") });
    await request.getByRole("button", { name: "Decline", exact: true }).click();
    await expectCount(cleanersLink, initialCleanerCount);
  } finally {
    await cleanerContext.close();
  }

  await nav.getByRole("link", { name: "Overview", exact: true }).click();
  await expectCount(cleanersLink, initialCleanerCount);
  const overviewLink = nav.getByRole("link", { name: "Overview", exact: true });
  const initialTaskCount = await badgeCount(overviewLink);
  const taskTitle = `Menu follow-up ${test.info().project.name}`;
  await page.getByLabel("Task", { exact: true }).fill(taskTitle);
  await page.getByLabel("Due date", { exact: true }).fill("2020-01-01");
  await page
    .getByRole("button", { name: "Add follow-up", exact: true })
    .click();
  await expectCount(overviewLink, initialTaskCount + 1);
  await page
    .getByRole("listitem")
    .filter({ hasText: taskTitle })
    .getByRole("button", { name: "Complete", exact: true })
    .click();
  await expectCount(overviewLink, initialTaskCount);

  await nav
    .getByRole("link", { name: "Customer pipeline", exact: true })
    .click();
  await expectCount(cleanersLink, initialCleanerCount);
  await expect(
    page.locator(".pipeline-card .person-name-customer").first(),
  ).toHaveCSS("background-color", "rgb(248, 229, 172)");
  await page.screenshot({
    path: `test-results/menu-people-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
