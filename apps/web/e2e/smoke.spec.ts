import { expect, test } from "@playwright/test";

test("home placeholder renders and links to the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "TRACEFLOW" })).toBeVisible();
  await page.getByRole("link", { name: "Open the application shell" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("app.shell.notice")).toBeVisible();
});

test("private route is served no-store", async ({ request }) => {
  const res = await request.get("/app");
  expect(res.headers()["cache-control"]).toBe("private, no-store");
});
