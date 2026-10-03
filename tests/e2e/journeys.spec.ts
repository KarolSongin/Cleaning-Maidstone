import { test, expect, type Page } from "@playwright/test";
const origin = "http://127.0.0.1:3001";
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
test("public content, metadata, mobile layout and keyboard navigation", async ({
  page,
  request,
}) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const html = (await response.text()).replaceAll("<!-- -->", "");
  expect(html).toContain("Domestic cleaning");
  expect(html).toContain("Weekly domestic cleaning");
  expect(html).toContain("Fortnightly domestic cleaning");
  expect(html).toContain("Bearsted");
  expect(html).toContain("07767 211 725");
  expect(html).toContain("marta@cleaningmaidstone.co.uk");
  expect(html).toContain('rel="canonical"');
  expect(html).toContain("application/ld+json");
  expect(html.split("</head>")[0]).toContain('name="description"');
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Domestic cleaning",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page
    .locator("summary")
    .filter({ hasText: "Will I have the same cleaner each time?" })
    .click();
  await expect(
    page.getByText(
      "We aim to assign the same regular cleaner wherever possible.",
      { exact: false },
    ),
  ).toBeVisible();
  expect((await request.get("/missing-page/")).status()).toBe(404);
  const redirect = await request.get("/contact/", { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toContain("/contact-us/");
  await page.screenshot({
    path: `test-results/public-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("public service, pricing and contact pages retain useful local information", async ({
  page,
}) => {
  for (const [path, heading] of [
    ["/maidstone-domestic-cleaning/", "Regular domestic cleaning in Maidstone"],
    ["/pricing/", "Domestic cleaning prices in Maidstone"],
    ["/about-us/", "Local Maidstone cleaners"],
    ["/contact-us/", "Contact Cleaning Maidstone"],
    ["/blog/", "Practical advice"],
    ["/privacy/", "Your information, handled with care"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      heading,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const action = page.locator(".page-hero .hero-actions .button");
    const target = await action.getAttribute("href");
    expect(target?.startsWith("#")).toBe(true);
    await action.click();
    await expect(
      page.locator(target!).getByRole("heading", { level: 2 }).first(),
    ).toBeInViewport();
  }
  await page.goto("/pricing/");
  for (const price of ["£18", "£22", "£19", "£23"])
    await expect(page.locator(".pricing-table")).toContainText(price);
  await page.goto("/maidstone-domestic-cleaning/");
  await expect(
    page.getByRole("heading", {
      name: "Cleaning products, equipment and special surfaces",
    }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("laundry");
  await expect(page.locator("main")).toContainText("vacuum cleaner");
  if ((page.viewportSize()?.width || 1440) <= 760) {
    await page.locator(".mobile-nav summary").click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Contact", exact: true })
      .click();
    await expect(page).toHaveURL(/\/contact-us\/$/);
  }
});
test("cleaner calendar shows assigned jobs and denies rota changes", async ({
  page,
}) => {
  await login(page, "cleaner");
  const before = await (await page.request.get("/api/operations/")).json();
  expect(before.jobs.length).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Calendar view", exact: true })
    .click();
  await expect(page.locator(".cleaner-calendar")).toBeVisible();
  await expect(
    page.getByText("Your admin manages the rota.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const event = page.locator(".cleaner-calendar .fc-event").first();
  await expect(event).toBeVisible();
  await event.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("region", { name: "Assigned visit" });
  await expect(detail).toBeFocused();
  await expect(detail.locator("address")).toContainText("ME");
  await expect(
    page.locator(".cleaner-calendar .fc-event-draggable"),
  ).toHaveCount(0);
  await expect(page.locator(".cleaner-calendar .fc-event-resizer")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Close visit details" }).click();
  await expect(detail).toHaveCount(0);
  for (const name of ["Week", "Day"])
    await page.getByRole("button", { name, exact: true }).click();
  const job = before.jobs[0];
  for (const data of [
    { id: job.id, starts_at: "2031-01-06T09:00:00Z" },
    { id: job.id, status: "cancelled" },
  ]) {
    const denied = await page.request.post("/api/operations/", {
      headers: { origin },
      data: { action: "visit", data },
    });
    expect(denied.status()).toBe(403);
  }
  const after = await (await page.request.get("/api/operations/")).json();
  expect(after.jobs).toEqual(before.jobs);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/cleaner-calendar-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.locator(".job-card").first()).toBeVisible();
});
test("enquiry validation and persistence in the admin inbox", async ({
  page,
}) => {
  await page.goto("/#book");
  await page
    .getByRole("button", { name: "Enquire about availability" })
    .click();
  await expect(page.getByText("Enter a UK postcode")).toBeVisible();
  const name = "Enquiry " + test.info().project.name + " " + Date.now();
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("enquiry@example.test");
  await page.getByLabel("Phone number", { exact: true }).fill("07700900123");
  await page.getByLabel("Home postcode", { exact: true }).fill("ME14 1AA");
  await page
    .getByLabel("Home size", { exact: true })
    .selectOption("2 bedrooms");
  await page
    .getByLabel("Anything we should know?")
    .fill("Synthetic browser test.");
  await page.waitForFunction(
    () =>
      Date.now() -
        Number(
          (document.querySelector("input[name=started_at]") as HTMLInputElement)
            ?.value,
        ) >
      1600,
  );
  await page
    .getByRole("button", { name: "Enquire about availability" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Demo enquiry saved" }),
  ).toBeVisible();
  await login(page, "admin");
  await page.goto("/admin/customers/");
  await expect(page.getByText(name, { exact: false })).toBeVisible();
});
test("customer changes and overlapping scheduling requests persist", async ({
  page,
}) => {
  await login(page, "admin");
  const id = Date.now();
  const name = "Browser Customer " + id;
  await page.goto("/admin/customers/");
  await page.getByLabel("Customer name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill("browser@example.test");
  await page.getByLabel("Phone", { exact: true }).fill("+447700900456");
  await page.getByLabel("Home address").fill("1 Synthetic Test Street");
  await page.getByLabel("Postcode", { exact: true }).fill("ME14 1AA");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  const result = await page.request.get("/api/operations/");
  const data = await result.json();
  const customer = data.customers.find(
    (c: { name: string }) => c.name === name,
  );
  expect(customer).toBeTruthy();
  const offset = Math.floor(Date.now() / 1000) % 10000;
  const date = new Date(Date.UTC(2030, 0, 1 + offset))
    .toISOString()
    .slice(0, 10);
  const booking = {
    action: "booking",
    data: {
      customer_id: customer.id,
      cleaner_id: data.cleaners[0].id,
      date,
      time: "09:00",
      duration_minutes: 180,
      interval_weeks: 0,
      occurrences: 1,
      instructions: "Synthetic e2e instructions",
    },
  };
  const responses = await Promise.all([
    page.request.post("/api/operations/", {
      headers: { origin },
      data: booking,
    }),
    page.request.post("/api/operations/", {
      headers: { origin },
      data: booking,
    }),
  ]);
  expect(responses.map((r) => r.status()).sort()).toEqual([200, 400]);
  await page.goto("/admin/calendar/");
  await expect(
    page.getByRole("button", { name: "Month", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Month", exact: true }).click();
});
test("cleaner permissions protect admin routes, APIs and recordings", async ({
  page,
}) => {
  const anonymous = await page.request.get("/api/operations/");
  expect(anonymous.status()).toBe(401);
  await login(page, "cleaner");
  await page.goto("/admin/");
  await expect(page).toHaveURL(/\/cleaner\/$/);
  const data = await (await page.request.get("/api/operations/")).json();
  expect(data).not.toHaveProperty("customers");
  expect(data).not.toHaveProperty("conversations");
  for (const job of data.jobs) expect(job).not.toHaveProperty("internal_notes");
  const forbidden = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "customer",
      data: {
        name: "Forbidden",
        email: "test@example.test",
        phone: "",
        address: "Synthetic",
        postcode: "ME14 1AA",
      },
    },
  });
  expect(forbidden.status()).toBe(403);
  const recording = await page.request.get(
    "/api/recordings/00000000-0000-4000-8000-000000000000/",
  );
  expect(recording.status()).toBe(403);
  const noOrigin = await page.request.post("/api/operations/", {
    data: {
      action: "leave",
      data: { starts_on: "2028-02-01", ends_on: "2028-02-02" },
    },
  });
  expect(noOrigin.status()).toBe(403);
});
test("publishing and unpublishing refresh the article and sitemap", async ({
  page,
  request,
}) => {
  await login(page, "admin");
  const slug = "browser-article-" + Date.now();
  await page.goto("/admin/content/");
  await page.getByLabel("URL slug", { exact: true }).fill(slug);
  await page
    .getByLabel("Title", { exact: true })
    .fill("A browser-tested article");
  await page
    .getByLabel("Introduction", { exact: true })
    .fill("A useful synthetic publishing check.");
  await page
    .locator(".tiptap")
    .fill("This article was created during a local browser test.");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Published.");
  expect((await request.get("/blog/" + slug + "/")).status()).toBe(200);
  expect(await (await request.get("/sitemap.xml")).text()).toContain(
    "/blog/" + slug + "/",
  );
  const data = await (await page.request.get("/api/operations/")).json();
  const content = data.content.find((c: { slug: string }) => c.slug === slug);
  const articleTitle =
    "A practical guide to preparing your Maidstone home for its first regular domestic clean";
  const updated = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "content",
      data: {
        ...content,
        title: articleTitle,
        image_path: "/images/kitchen-detail.webp",
        image_alt: "Kitchen illustration for a synthetic publishing check",
        published_at: content.published_at || "",
      },
    },
  });
  expect(updated.status()).toBe(200);
  await page.goto("/blog/" + slug + "/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    articleTitle,
  );
  await expect(
    page.getByAltText("Kitchen illustration for a synthetic publishing check"),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Read the article", exact: true })
    .click();
  await expect(
    page.getByText("This article was created during a local browser test.", {
      exact: true,
    }),
  ).toBeInViewport();
  await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "content",
      data: {
        ...content,
        image_path: content.image_path || "",
        published_at: "",
        status: "draft",
      },
    },
  });
  expect((await request.get("/blog/" + slug + "/")).status()).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "/blog/" + slug + "/",
  );
  const preview = await request.get("/preview/" + content.id + "/", {
    maxRedirects: 0,
  });
  expect(preview.status()).toBe(307);
});
test("homepage publishes server-rendered copy and SEO metadata while hiding drafts", async ({
  page,
  request,
}) => {
  await login(page, "admin");
  const existing = await (await page.request.get("/api/operations/")).json();
  const previous = existing.content.find(
    (c: { kind: string; slug: string }) =>
      c.kind === "page" && c.slug === "home",
  );
  const title = "Homepage publishing check " + test.info().project.name;
  const text = "Synthetic homepage copy " + Date.now();
  const content = {
    ...(previous ? { id: previous.id } : {}),
    kind: "page",
    slug: "home",
    title,
    seo_title: title,
    seo_description: "A synthetic description to verify homepage publishing.",
    body: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
    status: "published",
  };
  const response = await page.request.post("/api/operations/", {
    headers: { origin },
    data: { action: "content", data: content },
  });
  expect(response.status()).toBe(200);
  const { id } = await response.json();
  try {
    const published = await (await request.get("/")).text();
    expect(published).toContain(text);
    const head = published.split("</head>")[0];
    expect(head).toContain("<title>" + title + "</title>");
    expect(head).toContain(content.seo_description);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Domestic cleaning",
    );
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    const unpublish = await page.request.post("/api/operations/", {
      headers: { origin },
      data: { action: "content", data: { ...content, id, status: "draft" } },
    });
    expect(unpublish.status()).toBe(200);
    const draft = await (await request.get("/")).text();
    expect(draft).not.toContain(text);
    expect(draft).not.toContain(title);
  } finally {
    if (previous) {
      const restored = await page.request.post("/api/operations/", {
        headers: { origin },
        data: {
          action: "content",
          data: {
            ...previous,
            image_path: previous.image_path || "",
            published_at: previous.published_at || "",
          },
        },
      });
      expect(restored.status()).toBe(200);
    }
  }
});
test("sample events deduplicate and expose transcription failure honestly", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/admin/conversations/");
  await page.getByRole("button", { name: "Load sample call" }).click();
  await page.getByRole("button", { name: "Load sample call" }).click();
  await expect(page.getByRole("button", { name: /LOCAL SAMPLE/ })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: /LOCAL SAMPLE/ }).click();
  await expect(
    page.getByText("Unavailable (LOCAL_SAMPLE_NO_AUDIO).", { exact: true }),
  ).toBeVisible();
  const data = await (await page.request.get("/api/operations/")).json();
  expect(
    data.conversations.filter(
      (c: { provider: string }) => c.provider === "sample",
    ),
  ).toHaveLength(1);
  expect(
    data.conversations.find(
      (c: { provider: string }) => c.provider === "sample",
    ).status,
  ).toBe("completed");
});

test("admin sets recurring hours and sees free capacity for selected cleaners", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin");
  await page.goto("/admin/cleaners/");
  const invitation = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "Invite a cleaner", exact: true }),
  });
  const name = `Weekly ${test.info().project.name} Cleaner`;
  await invitation.getByLabel("Name", { exact: true }).fill(name);
  await invitation
    .getByLabel("Email", { exact: true })
    .fill(`weekly-${test.info().project.name}@example.test`);
  await invitation
    .getByRole("button", { name: "Create synthetic profile", exact: true })
    .click();
  await expect(invitation.getByRole("alert")).toContainText(
    "Choose at least one working day",
  );
  await invitation
    .getByRole("checkbox", { name: "Monday", exact: true })
    .check();
  await invitation.getByLabel("Monday end time", { exact: true }).fill("12:00");
  await invitation
    .getByRole("button", { name: "+ Add Monday period", exact: true })
    .click();
  await invitation
    .getByLabel("Monday start time 2", { exact: true })
    .fill("13:00");
  await invitation
    .getByLabel("Monday end time 2", { exact: true })
    .fill("17:00");
  await invitation
    .getByRole("checkbox", { name: "Tuesday", exact: true })
    .check();
  await invitation
    .getByLabel("Tuesday start time", { exact: true })
    .fill("10:00");
  await invitation
    .getByLabel("Tuesday end time", { exact: true })
    .fill("14:00");
  await invitation
    .getByRole("button", { name: "Create synthetic profile", exact: true })
    .click();
  await expect(invitation.getByRole("status")).toContainText("profile created");
  let data = await (await page.request.get("/api/operations/")).json();
  const cleaner = data.cleaners.find((c: { name: string }) => c.name === name);
  expect(cleaner).toBeTruthy();
  const hours = () =>
    data.availability
      .filter((a: { cleaner_id: string }) => a.cleaner_id === cleaner.id)
      .map((a: { weekday: number; start_time: string; end_time: string }) => [
        a.weekday,
        a.start_time.slice(0, 5),
        a.end_time.slice(0, 5),
      ])
      .sort();
  expect(hours()).toEqual([
    [1, "08:00", "12:00"],
    [1, "13:00", "17:00"],
    [2, "10:00", "14:00"],
  ]);
  await page
    .getByRole("button", { name: `Edit hours for ${name}`, exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: `Edit weekly availability for ${name}`,
  });
  await editor.getByLabel("Tuesday end time", { exact: true }).fill("15:00");
  await editor
    .getByRole("button", { name: "Save weekly availability", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  data = await (await page.request.get("/api/operations/")).json();
  expect(hours()).toContainEqual([2, "10:00", "15:00"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/weekly-hours-${test.info().project.name}.png`,
    fullPage: true,
  });

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/London",
  });
  const day = new Date(today + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() + ((8 - day.getUTCDay()) % 7 || 7));
  const booking = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "booking",
      data: {
        customer_id: data.customers[0].id,
        cleaner_id: cleaner.id,
        date: day.toISOString().slice(0, 10),
        time: "09:00",
        duration_minutes: 120,
        interval_weeks: 0,
        occurrences: 1,
      },
    },
  });
  expect(booking.status()).toBe(200);
  await page.goto("/admin/calendar/");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: `Show ${name}`, exact: true })
    .check();
  await page.locator(".fc-next-button").click();
  await expect(
    page.locator('.availability-band[data-free-count="1"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('.availability-band[data-free-count="2"]'),
  ).toHaveCount(0);
  await expect(
    page.locator(".fc-event-main").filter({ hasText: data.customers[0].name }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Show Taylor Reed", exact: true })
    .check();
  await expect(
    page.locator('.availability-band[data-free-count="2"]').first(),
  ).toBeVisible();
  const lighter = await page
    .locator('.availability-band[data-free-count="1"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const deeper = await page
    .locator('.availability-band[data-free-count="2"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(lighter).not.toBe(deeper);
  await page.locator(".availability-slots summary").click();
  await expect(page.locator(".availability-slots")).toContainText("2 free");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/free-calendar-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.locator(".calendar-availability-note")).toContainText(
    "Month shows the highest number",
  );
  await expect(page.locator(".availability-band").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(page.locator(".availability-band")).toHaveCount(0);

  await page.goto("/admin/cleaners/");
  await page
    .getByRole("button", { name: `Edit hours for ${name}`, exact: true })
    .click();
  await editor.getByLabel("Monday end time", { exact: true }).fill("10:00");
  await editor
    .getByRole("button", { name: "Save weekly availability", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText(
    "Move conflicting upcoming visits",
  );
  data = await (await page.request.get("/api/operations/")).json();
  expect(hours()).toContainEqual([1, "08:00", "12:00"]);
  expect(errors).toEqual([]);
});

test("cleaner sees approved weekly hours and can only request a change", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "cleaner");
  const before = await (await page.request.get("/api/operations/")).json();
  expect(before.recurringAvailability.length).toBe(7);
  expect(
    new Set(
      before.recurringAvailability.map(
        (a: { cleaner_id: string }) => a.cleaner_id,
      ),
    ),
  ).toEqual(new Set(["22222222-2222-4222-8222-222222222222"]));
  const summary = page.getByRole("region", {
    name: "Your weekly availability",
    exact: true,
  });
  await expect(summary).toContainText("08:00–20:00");
  await expect(summary.locator("input,select,button")).toHaveCount(0);
  const denied = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "cleaner_availability",
      data: {
        cleaner_id: "22222222-2222-4222-8222-222222222222",
        availability: [],
      },
    },
  });
  expect(denied.status()).toBe(403);
  const inviteDenied = await page.request.post("/api/cleaners/invite/", {
    headers: { origin },
    data: {
      name: "Denied Test",
      email: "denied@example.test",
      availability: [{ weekday: 1, start_time: "09:00", end_time: "17:00" }],
    },
  });
  expect(inviteDenied.status()).toBe(403);
  const panel = page.locator("section.panel").filter({
    has: page.getByRole("heading", {
      name: "Request an availability change",
      exact: true,
    }),
  });
  await panel
    .getByRole("combobox", { name: "Day", exact: true })
    .selectOption("1");
  await panel.getByLabel("Available from", { exact: true }).fill("09:00");
  await panel.getByLabel("Available until", { exact: true }).fill("17:00");
  await panel
    .getByRole("button", { name: "Send availability request", exact: true })
    .click();
  await expect(panel.getByRole("status")).toContainText("Saved successfully");
  const after = await (await page.request.get("/api/operations/")).json();
  expect(after.recurringAvailability).toEqual(before.recurringAvailability);
  expect(after.availability).toContainEqual(
    expect.objectContaining({
      weekday: 1,
      status: "pending",
      start_time: "09:00:00",
      end_time: "17:00:00",
    }),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/cleaner-hours-${test.info().project.name}.png`,
    fullPage: true,
  });
});
