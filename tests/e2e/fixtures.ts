import { test as base } from "@playwright/test";
export { expect } from "@playwright/test";

// Existing journeys exercise operations after approval. Dedicated confirmation
// journeys use the base fixture to test the modal without this helper.
export const test = base.extend({
  page: async ({ page }, run) => {
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const accept = document.querySelector<HTMLButtonElement>(
          "dialog[data-admin-confirmation][open] [data-confirm-accept]",
        );
        accept?.click();
      }).observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["open"],
      });
    });
    await run(page);
  },
});
