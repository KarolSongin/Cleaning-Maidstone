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
  const data = await (await page.request.get("/api/operations/")).json();
  const enquiry = data.enquiries.find((e: { name: string }) => e.name === name);
  expect(data.acquisition_leads).toContainEqual(
    expect.objectContaining({
      id: enquiry.pipeline_id,
      name,
      source: "website",
      stage: "opportunity",
    }),
  );
  await page.goto(`/admin/pipeline/?lead=${enquiry.pipeline_id}`);
  await expect(
    page.getByRole("combobox", { name: "Pipeline stage", exact: true }),
  ).toHaveValue("opportunity");
  await expect(page.locator(".pipeline-enquiry")).toContainText(
    "Synthetic browser test.",
  );
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
      customer_rate_pence: 1800,
      admin_rate_pence: 300,
      cleaner_rate_pence: 1500,
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
        customer_rate_pence: 1800,
        admin_rate_pence: 300,
        cleaner_rate_pence: 1500,
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

test("admin creates 52-week weekly and fortnightly bookings and reviews their dates", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin");
  const project = test.info().project.name;
  const customerResponse = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "customer",
      data: {
        name: `Yearly ${project} Customer`,
        email: `yearly-${project}@example.test`,
        phone: "+447700900501",
        address: "1 Synthetic Yearly Lane",
        postcode: "ME14 1AA",
      },
    },
  });
  expect(customerResponse.status()).toBe(200);
  const customerId = (await customerResponse.json()).id;
  const data = await (await page.request.get("/api/operations/")).json();
  const cleaner = data.cleaners.find(
    (c: { name: string }) => c.name === "Taylor Reed",
  );
  await page.goto("/admin/calendar/");
  const form = page.locator("section.panel").filter({
    has: page.getByRole("heading", {
      name: "Create a visit or recurring booking",
      exact: true,
    }),
  });
  await form
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption(customerId);
  await form
    .getByRole("combobox", { name: "Cleaner", exact: true })
    .selectOption(cleaner.id);
  await form.getByLabel("First date", { exact: true }).fill("2034-01-02");
  await form.getByLabel("Customer hourly rate (£)", { exact: true }).fill("18");
  await form.getByLabel("Admin hourly share (£)", { exact: true }).fill("3");
  await form
    .getByLabel("Cleaner hourly cash pay (£)", { exact: true })
    .fill("15");
  await form
    .getByLabel("Local start time", { exact: true })
    .fill(project === "desktop" ? "09:00" : "10:00");
  await form
    .getByRole("combobox", { name: "Duration", exact: true })
    .selectOption("60");
  await form
    .getByRole("combobox", { name: "Repeat", exact: true })
    .selectOption("1");
  const term = form.getByLabel("Booking period (1–52 weeks)", { exact: true });
  await expect(term).toHaveAttribute("max", "52");
  await term.fill("53");
  expect(
    await term.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow),
  ).toBe(true);
  await term.fill("52");
  await expect(
    form.getByLabel("Booking period preview", { exact: true }),
  ).toContainText("52 weekly visits over 52 weeks");
  await expect(
    form.getByLabel("Booking period preview", { exact: true }),
  ).toContainText("Booking ends 31 Dec 2034");
  const weeklyResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/operations/") &&
      response.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  expect((await weeklyResponse).status()).toBe(200);
  await expect(form.getByRole("status")).toContainText("Saved successfully");
  await form
    .getByRole("combobox", { name: "Repeat", exact: true })
    .selectOption("2");
  await form
    .getByLabel("Local start time", { exact: true })
    .fill(project === "desktop" ? "14:00" : "15:00");
  await expect(
    form.getByLabel("Booking period preview", { exact: true }),
  ).toContainText("26 fortnightly visits over 52 weeks");
  const fortnightlyResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/operations/") &&
      response.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  expect((await fortnightlyResponse).status()).toBe(200);
  await expect(form.getByRole("status")).toContainText("Saved successfully");
  await page
    .getByRole("link", { name: "Recurring bookings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/recurring\/$/);
  await page
    .getByLabel("Search recurring bookings", { exact: true })
    .fill(`Yearly ${project} Customer`);
  const records = page.locator(".recurring-booking");
  await expect(records).toHaveCount(2);
  await expect(records.first()).toContainText("2 Jan 2034");
  await expect(records.first()).toContainText("31 Dec 2034");
  await expect(records.filter({ hasText: "Weekly · 52 weeks" })).toContainText(
    "52 booked · 52 remaining",
  );
  await expect(
    records.filter({ hasText: "Fortnightly · 52 weeks" }),
  ).toContainText("26 booked · 26 remaining");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/recurring-year-${project}.png`,
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Booking status", exact: true })
    .selectOption("ended");
  await expect(records).toHaveCount(0);
  await expect(
    page.getByText("No recurring bookings match your filters.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("admin sees renewal reminders and saves a customer follow-up", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin");
  const project = test.info().project.name;
  const { Temporal } = await import("@js-temporal/polyfill");
  const today = Temporal.Now.plainDateISO("Europe/London");
  const customerResponse = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "customer",
      data: {
        name: `Renewal ${project} Customer`,
        email: `renewal-${project}@example.test`,
        phone: "+447700900502",
        address: "2 Synthetic Renewal Lane",
        postcode: "ME14 1AA",
      },
    },
  });
  expect(customerResponse.status()).toBe(200);
  const customerId = (await customerResponse.json()).id;
  const cleanerResponse = await page.request.post("/api/cleaners/invite/", {
    headers: { origin },
    data: {
      name: `Renewal ${project} Cleaner`,
      email: `renewal-cleaner-${project}@example.test`,
      availability: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        start_time: "08:00",
        end_time: "20:00",
      })),
    },
  });
  expect(cleanerResponse.status()).toBe(200);
  const cleanerId = (await cleanerResponse.json()).id;
  const ids: string[] = [];
  for (const date of [today.add({ days: 3 }), today.subtract({ weeks: 6 })]) {
    const response = await page.request.post("/api/operations/", {
      headers: { origin },
      data: {
        action: "booking",
        data: {
          customer_id: customerId,
          cleaner_id: cleanerId,
          date: date.toString(),
          time: "09:00",
          customer_rate_pence: 1800,
          admin_rate_pence: 300,
          cleaner_rate_pence: 1500,
          duration_minutes: 60,
          interval_weeks: 1,
          occurrences: 2,
          duration_weeks: 2,
        },
      },
    });
    expect(response.status()).toBe(200);
    ids.push((await response.json()).id);
  }
  const end = today.add({ days: 16 });
  await page.goto("/admin/");
  const renewalReminder = page.getByRole("link", {
    name: /recurring bookings? ends? within a month/,
  });
  await expect(renewalReminder).toContainText("within a month");
  await renewalReminder.click();
  await page
    .getByRole("combobox", { name: "Booking status", exact: true })
    .selectOption("ending-soon");
  await page
    .getByLabel("Search recurring bookings", { exact: true })
    .fill(`Renewal ${project} Customer`);
  const record = page.locator(`.recurring-booking[data-series-id="${ids[0]}"]`);
  await expect(record).toBeVisible();
  await expect(record).toContainText("Ending soon");
  await expect(record).toContainText("Ends in 16 days");
  await record
    .getByRole("button", {
      name: `Follow up for Renewal ${project} Customer`,
      exact: true,
    })
    .click();
  await expect(
    record.getByRole("link", {
      name: `renewal-${project}@example.test`,
      exact: true,
    }),
  ).toHaveAttribute("href", `mailto:renewal-${project}@example.test`);
  const followUpDate = record.getByLabel("Follow-up date", { exact: true });
  await expect(followUpDate).toHaveValue(today.toString());
  await record
    .getByRole("button", { name: "Add renewal follow-up", exact: true })
    .click();
  await expect(record).toContainText("A follow-up task is already open.");
  const data = await (await page.request.get("/api/operations/")).json();
  const taskTitle = `Follow up: Renewal ${project} Customer recurring cleaning ends ${end}`;
  expect(data.tasks).toContainEqual(
    expect.objectContaining({
      customer_id: customerId,
      title: taskTitle,
      due_on: today.toString(),
      done: false,
    }),
  );
  await page.reload();
  await expect(
    page.locator(`.recurring-booking[data-series-id="${ids[0]}"]`),
  ).toContainText("Follow-up task due");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/recurring-renewal-${project}.png`,
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Booking status", exact: true })
    .selectOption("ended");
  await expect(
    page.locator(`.recurring-booking[data-series-id="${ids[1]}"]`),
  ).toBeVisible();
  await expect(
    page.locator(`.recurring-booking[data-series-id="${ids[0]}"]`),
  ).toHaveCount(0);
  await page.goto("/admin/");
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();
  await login(page, "cleaner");
  await page.goto("/admin/recurring/");
  await expect(page).toHaveURL(/\/cleaner\/$/);
  expect(
    await (await page.request.get("/api/operations/")).json(),
  ).not.toHaveProperty("booking_series");
  expect(errors).toEqual([]);
});

test("booking rates balance, recur independently and expose only cleaner cash pay", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const project = test.info().project.name;
  const { Temporal } = await import("@js-temporal/polyfill");
  const date = Temporal.Now.plainDateISO("Europe/London")
    .add({ days: project === "desktop" ? 1 : 2 })
    .toString();
  const customerName = `Cash ${project} Customer`;
  await login(page, "admin");
  const customerResponse = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "customer",
      data: {
        name: customerName,
        email: "cash@example.test",
        phone: "+447700900456",
        address: "9 Synthetic Cash Test Lane",
        postcode: "ME14 1AA",
        internal_notes: "Private financial customer note",
      },
    },
  });
  expect(customerResponse.status()).toBe(200);
  const customerId = (await customerResponse.json()).id;
  await page.goto("/admin/calendar/");
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Create booking", exact: true }),
  });
  await form
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption(customerId);
  await form
    .getByRole("combobox", { name: "Cleaner", exact: true })
    .selectOption("22222222-2222-4222-8222-222222222222");
  await form.getByLabel("First date", { exact: true }).fill(date);
  await form.getByLabel("Local start time", { exact: true }).fill("16:00");
  await form
    .getByRole("combobox", { name: "Duration", exact: true })
    .selectOption("90");
  await form.getByLabel("Customer hourly rate (£)", { exact: true }).fill("18");
  await form.getByLabel("Admin hourly share (£)", { exact: true }).fill("3");
  const cleanerRate = form.getByLabel("Cleaner hourly cash pay (£)", {
    exact: true,
  });
  await cleanerRate.fill("14");
  await expect(form.locator(".finance-preview")).toContainText(
    "These amounts must add up",
  );
  expect(
    await cleanerRate.evaluate(
      (el: HTMLInputElement) => el.validity.customError,
    ),
  ).toBe(true);
  await form
    .getByRole("button", {
      name: "Set cleaner pay to £15.00 / hour",
      exact: true,
    })
    .click();
  await expect(
    form.getByLabel("For this visit", { exact: true }),
  ).toContainText("£27.00");
  await expect(
    form.getByLabel("For this visit", { exact: true }),
  ).toContainText("£4.50");
  await expect(
    form.getByLabel("For this visit", { exact: true }),
  ).toContainText("£22.50");
  let responsePromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/operations/") && r.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const visitId = (await response.json()).id;
  await expect(form.getByRole("status")).toContainText("Saved successfully");
  // Open this day's actual calendar event to edit only the one-off visit.
  await page.locator(".fc-timeGridDay-button").click();
  for (let n = 0; n < (project === "desktop" ? 1 : 2); n++)
    await page.locator(".fc-next-button").click();
  await page
    .locator(".fc-timegrid-event")
    .filter({ hasText: customerName })
    .click();
  const finances = page.getByLabel("Visit finances", { exact: true });
  await finances
    .getByLabel("Customer hourly rate (£)", { exact: true })
    .fill("22");
  await finances
    .getByLabel("Admin hourly share (£)", { exact: true })
    .fill("5.50");
  await finances
    .getByLabel("Cleaner hourly cash pay (£)", { exact: true })
    .fill("16.50");
  await finances
    .getByRole("button", { name: "Save visit rates", exact: true })
    .click();
  await expect(
    finances.getByLabel("For this visit", { exact: true }),
  ).toContainText("£24.75");
  await expect(
    finances.getByLabel("Customer hourly rate (£)", { exact: true }),
  ).toHaveValue("22.00");
  await expect(
    finances.getByLabel("For this visit", { exact: true }),
  ).toContainText("£8.25");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/finances-admin-${project}.png`,
    fullPage: true,
  });
  await form.getByLabel("Local start time", { exact: true }).fill("14:00");
  await form
    .getByRole("combobox", { name: "Repeat", exact: true })
    .selectOption("1");
  await form
    .getByLabel("Booking period (1–52 weeks)", { exact: true })
    .fill("2");
  await expect(
    form.getByLabel("For each regular visit", { exact: true }),
  ).toContainText("£22.50");
  responsePromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/operations/") && r.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  const recurringResponse = await responsePromise;
  expect(recurringResponse.status()).toBe(200);
  const seriesId = (await recurringResponse.json()).id;
  await page.goto("/admin/recurring/");
  const record = page.locator(
    `.recurring-booking[data-series-id="${seriesId}"]`,
  );
  await expect(
    record.getByLabel("Agreed rates per regular visit", { exact: true }),
  ).toContainText("£27.00");
  const adminData = await (await page.request.get("/api/operations/")).json();
  expect(
    adminData.visit_finances.find((f: { id: string }) => f.id === visitId),
  ).toMatchObject({
    customer_rate_pence: 2200,
    admin_rate_pence: 550,
    cleaner_rate_pence: 1650,
  });
  const recurringVisits = adminData.visits.filter(
    (v: { series_id: string }) => v.series_id === seriesId,
  );
  expect(recurringVisits).toHaveLength(2);
  for (const visit of recurringVisits)
    expect(
      adminData.visit_finances.find((f: { id: string }) => f.id === visit.id),
    ).toMatchObject({
      customer_rate_pence: 1800,
      admin_rate_pence: 300,
      cleaner_rate_pence: 1500,
    });
  // A direct malformed request cannot bypass the balanced split.
  const invalid = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "visit_finances",
      data: {
        id: visitId,
        customer_rate_pence: 2200,
        admin_rate_pence: 550,
        cleaner_rate_pence: 1600,
      },
    },
  });
  expect(invalid.status()).toBe(400);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "cleaner");
  const ownDataResponse = await page.request.get("/api/operations/");
  expect(ownDataResponse.headers()["cache-control"]).toContain("no-store");
  const ownData = await ownDataResponse.json();
  expect(
    ownData.jobs.find((j: { id: string }) => j.id === visitId),
  ).toMatchObject({ cleaner_rate_pence: 1650, cleaner_total_pence: 2475 });
  const serialized = JSON.stringify(ownData);
  for (const privateField of [
    "customer_rate_pence",
    "admin_rate_pence",
    "visit_finances",
    "series_finances",
    "internal_notes",
  ])
    expect(serialized).not.toContain(privateField);
  const cleanerHTML = await (await page.request.get("/cleaner/")).text();
  expect(cleanerHTML).not.toContain("customer_rate_pence");
  expect(cleanerHTML).not.toContain("admin_rate_pence");
  const ownCard = page
    .locator(".job-card")
    .filter({ hasText: customerName })
    .filter({ hasText: "£24.75" });
  await expect(ownCard).toHaveCount(1);
  await expect(
    ownCard.getByLabel("Your cash pay", { exact: true }),
  ).toContainText("£16.50 / hour");
  await expect(ownCard).not.toContainText("£22.00");
  await expect(ownCard).not.toContainText("£5.50");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/finances-cleaner-${project}.png`,
    fullPage: true,
  });
  const denied = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "visit_finances",
      data: {
        id: visitId,
        customer_rate_pence: 1800,
        admin_rate_pence: 300,
        cleaner_rate_pence: 1500,
      },
    },
  });
  expect(denied.status()).toBe(403);
  expect(errors).toEqual([]);
});

test("admin finances reconcile earnings, forecasts, filters and a full CSV export", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const project = test.info().project.name;
  const { Temporal } = await import("@js-temporal/polyfill");
  const today = Temporal.Now.plainDateISO("Europe/London");
  await page.goto("/admin/finances/");
  await expect(page).toHaveURL(/\/login\/$/);
  await login(page, "admin");
  const createCustomer = async (name: string) => {
    const response = await page.request.post("/api/operations/", {
      headers: { origin },
      data: {
        action: "customer",
        data: {
          name,
          email: "finance-report@example.test",
          phone: "+447700900777",
          address: "11 Synthetic Report Lane",
          postcode: "ME14 1AA",
        },
      },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).id as string;
  };
  const nameA = `Report ${project} A`,
    nameB = `Report ${project} B`;
  const customerA = await createCustomer(nameA),
    customerB = await createCustomer(nameB);
  const jamie = "22222222-2222-4222-8222-222222222222",
    taylor = "33333333-3333-4333-8333-333333333333";
  const booking = async (
    date: string,
    minutes: number,
    customer_id = customerA,
    cleaner_id = jamie,
    extra = {},
  ) => {
    const response = await page.request.post("/api/operations/", {
      headers: { origin },
      data: {
        action: "booking",
        data: {
          customer_id,
          cleaner_id,
          date,
          time: project === "desktop" ? "16:00" : "18:00",
          duration_minutes: minutes,
          interval_weeks: 0,
          occurrences: 1,
          customer_rate_pence: 1800,
          admin_rate_pence: 300,
          cleaner_rate_pence: 1500,
          ...extra,
        },
      },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).id as string;
  };
  const completedDate = today.subtract({ days: 14 }).toString(),
    pastDate = today.subtract({ days: 7 }).toString(),
    futureDate = today.add({ days: 10 }).toString();
  const completedId = await booking(completedDate, 90);
  await booking(pastDate, 60);
  const futureId = await booking(futureDate, 180, customerA, jamie, {
    time: project === "desktop" ? "13:00" : "16:00",
  });
  const cancelledId = await booking(today.add({ days: 11 }).toString(), 120);
  await booking(today.add({ days: 12 }).toString(), 120, customerB, jamie, {
    customer_rate_pence: 2000,
    admin_rate_pence: 400,
    cleaner_rate_pence: 1600,
  });
  const seriesId = await booking("2036-01-07", 60, customerA, taylor, {
    interval_weeks: 1,
    occurrences: 52,
    duration_weeks: 52,
  });
  const dashboard = await (await page.request.get("/api/operations/")).json();
  const first = dashboard.visits
    .filter((visit: { series_id: string }) => visit.series_id === seriesId)
    .sort((a: { starts_at: string }, b: { starts_at: string }) =>
      a.starts_at.localeCompare(b.starts_at),
    )[0];
  for (const [action, data] of [
    ["visit", { id: cancelledId, status: "cancelled" }],
    [
      "visit_finances",
      {
        id: first.id,
        customer_rate_pence: 2200,
        admin_rate_pence: 500,
        cleaner_rate_pence: 1700,
      },
    ],
  ]) {
    const response = await page.request.post("/api/operations/", {
      headers: { origin },
      data: { action, data },
    });
    expect(response.status()).toBe(200);
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "cleaner");
  for (const status of ["started", "completed"]) {
    const response = await page.request.post("/api/operations/", {
      headers: { origin },
      data: { action: "transition", data: { id: completedId, status } },
    });
    expect(response.status()).toBe(200);
  }
  const forbidden = await page.request.get("/admin/finances/", {
    maxRedirects: 0,
  });
  expect(forbidden.status()).toBe(307);
  expect(forbidden.headers().location).toContain("/cleaner/");
  await page.goto("/admin/finances/");
  await expect(page).toHaveURL(/\/cleaner\/$/);
  await expect(
    page.getByRole("link", { name: "Finances", exact: true }),
  ).toHaveCount(0);
  const cleanerData = await (await page.request.get("/api/operations/")).json();
  expect(cleanerData).not.toHaveProperty("visit_finances");
  expect(JSON.stringify(cleanerData)).not.toContain("admin_rate_pence");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "admin");
  await page.getByRole("link", { name: "Finances", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/finances\/$/);
  await expect(
    page.getByRole("heading", { name: "Choose your view", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  const filters = page.getByLabel("Finance filters", { exact: true });
  const selectCustomer = filters.getByRole("combobox", {
      name: "Customer",
      exact: true,
    }),
    selectCleaner = filters.getByRole("combobox", {
      name: "Cleaner",
      exact: true,
    });
  await selectCustomer.selectOption(customerA);
  const metric = (name: string) =>
    page.getByLabel(name, { exact: true }).locator(":scope > strong");
  await expect(metric("Earned admin share")).toHaveText("£4.50");
  await expect(metric("Booked admin forecast")).toHaveText("£167.00");
  await expect(metric("Awaiting completion")).toHaveText("£3.00");
  await expect(metric("Total admin value")).toHaveText("£174.50");
  await expect(page.getByLabel("Income split", { exact: true })).toContainText(
    "1 cancelled visit excluded",
  );
  const ledger = page.getByLabel("Financial visit list", { exact: true });
  await expect(
    ledger.getByText("1–25 of 56 visits", { exact: true }),
  ).toBeVisible();
  await ledger
    .getByRole("button", { name: "Next visits", exact: true })
    .click();
  await expect(
    ledger.getByText("26–50 of 56 visits", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await ledger.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  const fs = await import("node:fs/promises");
  const csv = await fs.readFile((await download.path())!, "utf8");
  expect(csv.split("\r\n")).toHaveLength(57);
  expect(csv).toContain(completedId);
  expect(csv).toContain(first.id);
  expect(csv).toContain('"22.00","5.00","17.00","22.00","5.00","17.00","Yes"');
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/finance-report-${project}.png`,
    fullPage: true,
  });
  await selectCleaner.selectOption(jamie);
  await expect(metric("Booked admin forecast")).toHaveText("£9.00");
  await expect(metric("Total admin value")).toHaveText("£16.50");
  await selectCustomer.selectOption(customerB);
  await expect(metric("Earned admin share")).toHaveText("£0.00");
  await expect(metric("Booked admin forecast")).toHaveText("£8.00");
  await selectCustomer.selectOption(customerA);
  await selectCleaner.selectOption("");
  await page.getByRole("button", { name: "By cleaner", exact: true }).click();
  await page
    .getByLabel("Cleaner finance breakdown", { exact: true })
    .getByRole("button", { name: "Taylor Reed", exact: true })
    .click();
  await expect(selectCleaner).toHaveValue(taylor);
  await expect(metric("Booked admin forecast")).toHaveText("£158.00");
  await page.getByRole("button", { name: /^Jan 2036: earned/ }).click();
  await expect(filters.getByLabel("From date", { exact: true })).toHaveValue(
    "2036-01-01",
  );
  await expect(filters.getByLabel("To date", { exact: true })).toHaveValue(
    "2036-01-31",
  );
  await expect(metric("Booked admin forecast")).toHaveText("£14.00");
  await filters
    .getByRole("combobox", { name: "Date range", exact: true })
    .selectOption("this-month");
  await expect(filters.getByLabel("From date", { exact: true })).toHaveValue(
    today.with({ day: 1 }).toString(),
  );
  await expect(metric("Booked admin forecast")).toHaveText("£0.00");
  await filters
    .getByRole("combobox", { name: "Date range", exact: true })
    .selectOption("all");
  await selectCleaner.selectOption(jamie);
  await filters.getByLabel("From date", { exact: true }).fill(completedDate);
  await filters.getByLabel("To date", { exact: true }).fill(completedDate);
  await expect(metric("Earned admin share")).toHaveText("£4.50");
  await expect(metric("Booked admin forecast")).toHaveText("£0.00");
  await filters.getByLabel("From date", { exact: true }).fill(futureDate);
  await expect(
    page.locator(".admin-finances").getByRole("alert"),
  ).toContainText("end date must be on or after");
  await expect(metric("Total admin value")).toHaveCount(0);
  await filters.getByLabel("To date", { exact: true }).fill(futureDate);
  await expect(metric("Booked admin forecast")).toHaveText("£9.00");
  await ledger
    .getByRole("combobox", { name: "Show visits", exact: true })
    .selectOption("all");
  await page
    .locator(`tr[data-visit-id="${futureId}"]`)
    .getByRole("button", { name: /^Edit rates/ })
    .click();
  const editor = page.getByLabel("Edit financial visit", { exact: true });
  await editor
    .getByLabel("Customer hourly rate (£)", { exact: true })
    .fill("20");
  await editor.getByLabel("Admin hourly share (£)", { exact: true }).fill("4");
  await editor
    .getByLabel("Cleaner hourly cash pay (£)", { exact: true })
    .fill("16");
  await editor
    .getByRole("button", { name: "Save visit rates", exact: true })
    .click();
  await expect(metric("Booked admin forecast")).toHaveText("£12.00");
  const cancel = await page.request.post("/api/operations/", {
    headers: { origin },
    data: { action: "visit", data: { id: futureId, status: "cancelled" } },
  });
  expect(cancel.status()).toBe(200);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(metric("Booked admin forecast")).toHaveText("£0.00");
  await expect(page.locator(`tr[data-visit-id="${futureId}"]`)).toContainText(
    "Cancelled",
  );
  await filters
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  const fresh = await (await page.request.get("/api/operations/")).json();
  const unpriced = fresh.visits.find(
    (visit: { id: string; status: string }) =>
      visit.status !== "cancelled" &&
      !fresh.visit_finances.some(
        (rates: { id: string }) => rates.id === visit.id,
      ),
  );
  expect(unpriced).toBeTruthy();
  await page
    .getByRole("button", { name: "Review missing rates", exact: true })
    .click();
  await expect(
    ledger.getByRole("combobox", { name: "Show visits", exact: true }),
  ).toHaveValue("unpriced");
  await page
    .locator(`tr[data-visit-id="${unpriced.id}"]`)
    .getByRole("button", { name: /^Set rates/ })
    .click();
  await expect(
    editor.getByLabel("Customer hourly rate (£)", { exact: true }),
  ).toHaveValue("");
  await editor
    .getByRole("button", { name: "Close rate editor", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("manual acquisition advances through booking and recurring agreement without duplicate profiles", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const project = test.info().project.name;
  const name = `Pipeline ${project} ${Date.now()}`;
  const firstDate = project === "desktop" ? "2048-01-07" : "2048-01-08";
  await login(page, "admin");
  await page.goto("/admin/pipeline/");
  await page
    .getByRole("button", { name: "Add opportunity", exact: true })
    .click();
  await page.getByLabel("Opportunity name", { exact: true }).fill(name);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`pipeline-${project}@example.test`);
  await page.getByLabel("Phone", { exact: true }).fill("07700900999");
  await page
    .getByLabel("Private pipeline notes")
    .fill("Private acquisition note, quote £18 per hour.");
  await page
    .getByRole("button", { name: "Save opportunity", exact: true })
    .click();
  const pipelineStage = page.getByRole("combobox", {
    name: "Pipeline stage",
    exact: true,
  });
  await expect(pipelineStage).toHaveValue("opportunity");
  for (const next of ["contacted", "quoted"]) {
    await pipelineStage.selectOption(next);
    await page
      .getByLabel("Stage change note (optional)")
      .fill(
        next === "quoted"
          ? "Quote agreed for a trial clean"
          : "Contacted for home details",
      );
    await page.getByRole("button", { name: "Save stage", exact: true }).click();
    await expect(
      page.locator("#pipeline-detail .pipeline-stage").first(),
    ).toContainText(
      next === "quoted" ? "Quote given" : "Contacted for details",
    );
  }
  await page
    .getByLabel("Home address", { exact: true })
    .fill("9 Synthetic Pipeline Street");
  await page.getByLabel("Home postcode", { exact: true }).fill("ME14 1AA");
  await page
    .getByRole("button", { name: "Create customer profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Customer profile", exact: true }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Book first cleaning" })
    .click();
  const bookingForm = page.locator("#pipeline-detail form").filter({
    has: page.getByRole("button", { name: "Create booking", exact: true }),
  });
  await expect(
    bookingForm.getByRole("combobox", { name: "Customer", exact: true }),
  ).not.toHaveValue("");
  await bookingForm
    .getByRole("combobox", { name: "Cleaner", exact: true })
    .selectOption({ label: "Jamie Morgan" });
  await bookingForm.getByLabel("First date", { exact: true }).fill(firstDate);
  await bookingForm.getByLabel("Local start time").fill("14:00");
  await bookingForm
    .getByRole("combobox", { name: "Duration", exact: true })
    .selectOption("60");
  await bookingForm
    .getByLabel("Customer hourly rate (£)", { exact: true })
    .fill("18");
  await bookingForm
    .getByLabel("Admin hourly share (£)", { exact: true })
    .fill("3");
  await bookingForm
    .getByLabel("Cleaner hourly cash pay (£)", { exact: true })
    .fill("15");
  await bookingForm
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  await expect(pipelineStage).toHaveValue("first_clean_booked");
  let data = await (await page.request.get("/api/operations/")).json();
  const lead = data.acquisition_leads.find(
    (l: { name: string }) => l.name === name,
  );
  expect(
    data.customers.filter((c: { name: string }) => c.name === name),
  ).toHaveLength(1);
  expect(lead.first_clean_on).toBe(firstDate);
  const cancelled = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "visit",
      data: { id: lead.first_visit_id, status: "cancelled" },
    },
  });
  expect(cancelled.ok()).toBe(true);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(pipelineStage).toHaveValue("quoted");
  const { Temporal } = await import("@js-temporal/polyfill");
  const past = Temporal.Now.plainDateISO("Europe/London").subtract({
    days: project === "desktop" ? 10 : 11,
  });
  await bookingForm
    .getByLabel("First date", { exact: true })
    .fill(past.toString());
  await bookingForm.getByLabel("Local start time").fill("17:00");
  await bookingForm
    .getByRole("button", { name: "Create booking", exact: true })
    .click();
  await expect(pipelineStage).toHaveValue("recurring_follow_up");
  await expect(page.locator("#pipeline-detail")).toContainText(
    "Confirm the visit took place",
  );
  data = await (await page.request.get("/api/operations/")).json();
  expect(
    data.acquisition_leads.find((l: { id: string }) => l.id === lead.id),
  ).toMatchObject({
    follow_up_due_on: past.add({ days: 1 }).toString(),
    stage: "recurring_follow_up",
  });
  await page.goto("/admin/");
  await page
    .getByRole("link", { name: /customer contacts? (are|is) due/ })
    .click();
  await expect(
    page.getByLabel("Only contacts due", { exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: `Open ${name}`, exact: true }).click();
  await expect(pipelineStage).toHaveValue("recurring_follow_up");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/pipeline-follow-up-${project}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await pipelineStage.selectOption("onboarded");
  await page
    .getByLabel("Stage change note (optional)")
    .fill("Customer agreed weekly recurring cleaning");
  await page.getByRole("button", { name: "Save stage", exact: true }).click();
  await expect(
    page.locator("#pipeline-detail .pipeline-stage").first(),
  ).toHaveText("Onboarded regular client");
  await page.goto(`/admin/pipeline/?lead=${lead.id}`);
  await expect(pipelineStage).toHaveValue("onboarded");
  await expect(page.locator(".pipeline-history")).toContainText(
    "Customer agreed weekly recurring cleaning",
  );
  await expect(page.locator(".pipeline-history")).toContainText("Automatic");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/pipeline-onboarded-${project}.png`,
    fullPage: true,
  });
  await login(page, "cleaner");
  await page.goto("/admin/pipeline/");
  await expect(page).toHaveURL(/\/cleaner\/$/);
  const safe = await (await page.request.get("/api/operations/")).json();
  expect(safe).not.toHaveProperty("acquisition_leads");
  expect(safe).not.toHaveProperty("acquisition_history");
  expect(JSON.stringify(safe)).not.toContain("Private acquisition note");
  const denied = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "pipeline_stage",
      data: { id: lead.id, expected_stage: "onboarded", stage: "closed" },
    },
  });
  expect(denied.status()).toBe(403);
  expect(
    (await page.request.post("/api/jobs/customer-pipeline/")).status(),
  ).toBe(403);
  expect(errors).toEqual([]);
});

test("website opportunities can be linked to an existing customer without losing their stage", async ({
  page,
}) => {
  const project = test.info().project.name;
  const name = `Returning pipeline ${project} ${Date.now()}`;
  await login(page, "admin");
  const created = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "customer",
      data: {
        name,
        email: `return-${project}@example.test`,
        phone: "07700900998",
        address: "14 Synthetic Returning Street",
        postcode: "ME14 1AA",
        internal_notes: "Retain private profile note",
      },
    },
  });
  expect(created.ok()).toBe(true);
  const customerId = (await created.json()).id;
  let data = await (await page.request.get("/api/operations/")).json();
  const existingLead = data.acquisition_leads.find(
    (l: { customer_id: string }) => l.customer_id === customerId,
  );
  expect(
    (
      await page.request.post("/api/operations/", {
        headers: { origin },
        data: {
          action: "pipeline_stage",
          data: {
            id: existingLead.id,
            expected_stage: "opportunity",
            stage: "onboarded",
          },
        },
      })
    ).ok(),
  ).toBe(true);
  const enquiry = await page.request.post("/api/enquiries/", {
    headers: { origin },
    data: {
      name,
      email: `return-${project}@example.test`,
      phone: "07700900998",
      postcode: "ME14 1AA",
      frequency: "discuss",
      home_size: "2 bedrooms",
      preferred_days: ["Monday"],
      notes: "New website request from a regular customer",
      started_at: Date.now() - 3000,
    },
  });
  expect(enquiry.status()).toBe(201);
  data = await (await page.request.get("/api/operations/")).json();
  const incoming = data.acquisition_leads.find(
    (l: { name: string; source: string }) =>
      l.name === name && l.source === "website",
  );
  await page.goto(`/admin/pipeline/?lead=${incoming.id}`);
  await page
    .getByRole("combobox", { name: "Customer profile", exact: true })
    .selectOption(customerId);
  await page
    .getByRole("button", { name: "Link existing customer", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Pipeline stage", exact: true }),
  ).toHaveValue("onboarded");
  await expect(page.locator(".pipeline-enquiry")).toContainText(
    "New website request from a regular customer",
  );
  data = await (await page.request.get("/api/operations/")).json();
  expect(
    data.customers.filter((c: { name: string }) => c.name === name),
  ).toHaveLength(1);
  expect(
    data.customers.find((c: { id: string }) => c.id === customerId)
      .internal_notes,
  ).toBe("Retain private profile note");
  expect(
    data.acquisition_leads.filter((l: { name: string }) => l.name === name),
  ).toHaveLength(1);
  expect(
    data.enquiries.find((e: { name: string }) => e.name === name),
  ).toMatchObject({ customer_id: customerId, pipeline_id: existingLead.id });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`lead=${existingLead.id}`));
  await expect(
    page.getByRole("combobox", { name: "Pipeline stage", exact: true }),
  ).toHaveValue("onboarded");
});

test("time-off requests list every affected clean and can be approved after cover is arranged", async ({
  page,
}) => {
  const project = test.info().project.name;
  const year = project === "desktop" ? "2035" : "2036";
  const first = `${year}-05-07`,
    last = `${year}-05-14`;
  const source = "22222222-2222-4222-8222-222222222222";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin");
  const operation = async (action: string, data: unknown) => {
    const response = await page.request.post("/api/operations/", {
      headers: { origin },
      data: { action, data },
    });
    const result = await response.json();
    expect(response.status(), result.error).toBe(200);
    return result;
  };
  const client = await operation("customer", {
    name: `Cover Client ${project}`,
    email: `cover-client-${project}@example.test`,
    phone: "+447700900888",
    address: "42 Synthetic Cover Lane",
    postcode: "ME14 2AB",
  });
  const invite = await page.request.post("/api/cleaners/invite/", {
    headers: { origin },
    data: {
      name: `Cover Cleaner ${project}`,
      email: `cover-cleaner-${project}@example.test`,
      availability: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        start_time: "08:00",
        end_time: "20:00",
      })),
    },
  });
  expect(invite.status()).toBe(200);
  const coverCleaner = (await invite.json()).id;
  const partialInvite = await page.request.post("/api/cleaners/invite/", {
    headers: { origin },
    data: {
      name: `Partial Cover Cleaner ${project}`,
      email: `partial-cover-${project}@example.test`,
      availability: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        start_time: "10:00",
        end_time: "20:00",
      })),
    },
  });
  expect(partialInvite.status()).toBe(200);
  const partialCleaner = (await partialInvite.json()).id;
  const rates = {
    customer_rate_pence: 2300,
    admin_rate_pence: 600,
    cleaner_rate_pence: 1700,
  };
  const booking = (date: string, time: string, extra = {}) =>
    operation("booking", {
      customer_id: client.id,
      cleaner_id: source,
      date,
      time,
      duration_minutes: 120,
      interval_weeks: 0,
      occurrences: 1,
      ...rates,
      ...extra,
    });
  const series = await booking(first, "09:00", {
    interval_weeks: 1,
    duration_weeks: 3,
    occurrences: 3,
  });
  const oneOff = await booking(`${year}-05-08`, "13:00");
  const cancelled = await booking(`${year}-05-09`, "13:00");
  const completed = await booking(`${year}-05-10`, "13:00");
  await booking(`${year}-05-06`, "13:00");
  await operation("visit", { id: cancelled.id, status: "cancelled" });
  const before = await (await page.request.get("/api/operations/")).json();
  const seriesVisits = before.visits
    .filter((v: { series_id: string }) => v.series_id === series.id)
    .sort((a: { starts_at: string }, b: { starts_at: string }) =>
      a.starts_at.localeCompare(b.starts_at),
    );
  expect(seriesVisits).toHaveLength(3);

  await login(page, "cleaner");
  await operation("transition", { id: completed.id, status: "started" });
  await operation("transition", { id: completed.id, status: "completed" });
  const panel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "Request time off", exact: true }),
  });
  await panel.getByLabel("From", { exact: true }).fill(first);
  await panel.getByLabel("To", { exact: true }).fill(last);
  await panel
    .getByLabel("Note for your admin")
    .fill(`Family holiday ${project}`);
  await panel
    .getByRole("button", { name: "Send leave request", exact: true })
    .click();
  await expect(panel.getByRole("status")).toContainText("Saved successfully");
  const cleanerData = await (await page.request.get("/api/operations/")).json();
  const leave = cleanerData.leave.find(
    (r: { reason: string }) => r.reason === `Family holiday ${project}`,
  );
  expect(leave.status).toBe("pending");
  const denied = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "review",
      data: { id: leave.id, kind: "leave", status: "approved" },
    },
  });
  expect(denied.status()).toBe(403);

  await login(page, "admin");
  await expect(
    page.getByRole("link", { name: /time-off.*request.*review/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /time-off.*request.*review/ }).click();
  const card = page.getByRole("article", {
    name: `Time off for Jamie Morgan: ${first} to ${last}`,
    exact: true,
  });
  await expect(card).toContainText(`Family holiday ${project}`);
  await expect(card).toContainText("3 cleans need cover");
  await expect(card.locator(".leave-cover-visit")).toHaveCount(3);
  await expect(card.getByText("Recurring visit", { exact: true })).toHaveCount(
    2,
  );
  await expect(card.getByText("One-off visit", { exact: true })).toHaveCount(1);
  await expect(card).toContainText("42 Synthetic Cover Lane, ME14 2AB");
  await expect(card).toContainText("09:00–11:00 · 2 hours");
  await expect(
    card.getByRole("button", { name: "Approve", exact: true }),
  ).toBeDisabled();
  const blocked = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "review",
      data: { id: leave.id, kind: "leave", status: "approved" },
    },
  });
  expect(blocked.status()).toBe(400);
  expect((await blocked.json()).error).toMatch(/Reschedule assigned visits/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/leave-cover-${project}.png`,
    fullPage: true,
  });

  const firstRow = card.locator(".leave-cover-visit").first();
  // Change the rota after the page loaded: opening cover must refresh it.
  const busy = await booking(first, "10:00", {
    cleaner_id: coverCleaner,
    duration_minutes: 30,
  });
  await firstRow
    .getByRole("button", { name: "Assign cover", exact: true })
    .click();
  const choices = firstRow.getByRole("combobox", {
    name: "Cover cleaner",
    exact: true,
  });
  await expect(choices).toBeVisible();
  const values = () =>
    choices
      .locator("option")
      .evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value),
      );
  const eligible = (await values()).filter(Boolean);
  expect(eligible).not.toContain(source);
  expect(eligible).not.toContain(coverCleaner);
  expect(eligible).not.toContain(partialCleaner);
  expect(eligible).toContain("33333333-3333-4333-8333-333333333333");
  await choices.selectOption(eligible[0]);
  // A booking made after selection must still be rejected on save.
  const temporaryBookings: string[] = [];
  for (const cleaner_id of eligible)
    temporaryBookings.push((await booking(first, "09:00", { cleaner_id })).id);
  await firstRow
    .getByRole("button", { name: "Save cover assignment", exact: true })
    .click();
  await expect(firstRow.getByRole("alert")).toContainText(
    "This cleaner already has a visit at that time.",
  );
  await expect(card.locator(".leave-cover-visit")).toHaveCount(3);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(firstRow).toContainText(
    "No cleaners are available for the whole visit.",
  );
  await expect(choices).toHaveCount(0);
  await expect(
    firstRow.getByRole("button", {
      name: "Save cover assignment",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Approve", exact: true }),
  ).toBeDisabled();
  await operation("visit", { id: busy.id, status: "cancelled" });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(choices).toBeVisible();
  expect(await values()).toEqual(["", coverCleaner]);
  await choices.selectOption(coverCleaner);
  await firstRow
    .getByRole("button", { name: "Save cover assignment", exact: true })
    .click();
  await expect(card).toContainText("2 cleans need cover");
  let after = await (await page.request.get("/api/operations/")).json();
  expect(
    after.visits.find((v: { id: string }) => v.id === seriesVisits[0].id),
  ).toMatchObject({
    cleaner_id: coverCleaner,
    starts_at: seriesVisits[0].starts_at,
    ends_at: seriesVisits[0].ends_at,
    series_id: series.id,
  });
  expect(
    after.visit_finances.find(
      (f: { id: string }) => f.id === seriesVisits[0].id,
    ),
  ).toEqual(
    before.visit_finances.find(
      (f: { id: string }) => f.id === seriesVisits[0].id,
    ),
  );
  expect(
    after.booking_series.find((s: { id: string }) => s.id === series.id)
      .cleaner_id,
  ).toBe(source);

  await card
    .locator(".leave-cover-visit")
    .first()
    .getByRole("link", { name: "Open visit" })
    .click();
  await expect(page).toHaveURL(new RegExp(`visit=${oneOff.id}`));
  await expect(
    page.getByRole("heading", { name: "Selected visit", exact: true }),
  ).toBeVisible();
  const reschedule = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Reschedule this visit",
      exact: true,
    }),
  });
  await expect(reschedule.getByLabel("New date", { exact: true })).toHaveValue(
    `${year}-05-08`,
  );
  await operation("visit", {
    id: oneOff.id,
    starts_at: `${year}-05-15T12:00:00Z`,
  });
  await page.goto("/admin/cleaners/#time-off");
  await expect(card).toContainText("1 clean needs cover");
  await card.getByRole("button", { name: "Assign cover", exact: true }).click();
  await card
    .getByRole("combobox", { name: "Cover cleaner", exact: true })
    .selectOption(coverCleaner);
  await card
    .getByRole("button", { name: "Save cover assignment", exact: true })
    .click();
  await expect(card).toContainText("No cleans need cover");
  await expect(
    card.getByRole("button", { name: "Approve", exact: true }),
  ).toBeEnabled();
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(card.locator(".badge-approved")).toHaveText("approved");
  after = await (await page.request.get("/api/operations/")).json();
  expect(
    after.visits.find((v: { id: string }) => v.id === seriesVisits[2].id)
      .cleaner_id,
  ).toBe(source);
  const impossible = await page.request.post("/api/operations/", {
    headers: { origin },
    data: {
      action: "booking",
      data: {
        customer_id: client.id,
        cleaner_id: source,
        date: first,
        time: "16:00",
        duration_minutes: 60,
        interval_weeks: 0,
        occurrences: 1,
        ...rates,
      },
    },
  });
  expect(impossible.status()).toBe(400);
  expect((await impossible.json()).error).toMatch(/approved leave/);
  for (const id of temporaryBookings)
    await operation("visit", { id, status: "cancelled" });
  expect(errors).toEqual([]);
});
