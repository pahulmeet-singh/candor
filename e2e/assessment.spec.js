import { expect, test } from "@playwright/test";
import { CONSENT_LABEL } from "../src/lib/integrity/copy";
import { CONSENT_REQUIRED_MESSAGE } from "../src/lib/integrity/constants";
import { newAccount, open, register } from "./helpers";

/**
 * Assessment mode in a real browser. Chromium is started with a synthetic camera, so the test needs
 * no hardware and the permission prompt is answered for it. What is checked does not depend on the
 * face detector finding a face (the synthetic picture has none), or even on the model downloading:
 * the things asserted here are consent, what the candidate is told, that a large paste is noted and
 * reaches the report, and that a practice interview never touches the camera.
 */
test.use({
  permissions: ["camera"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

const QUESTIONS = 5;

const ANSWER =
  "I would start by clarifying the goal and the constraints. Then I would compare two options, " +
  "explain the trade-offs, and choose the simpler one. Finally I would test the change, monitor it " +
  "after release, and describe how I would roll it back if something went wrong.";

const ASSESSMENT = 'label:has(input[name="mode"][value="ASSESSMENT"])';

/** Picks tomorrow's first open slot, the way the journey test does. */
async function chooseFirstOpenSlot(page) {
  await page.locator('label:has(input[name="day"])').nth(1).click();
  await expect(page.locator('input[name="day"]').nth(1)).toBeChecked();
  await expect(page.getByLabel("Loading slots")).toBeHidden();
  await page.locator('label:has(input[name="slot"]:not([disabled]))').first().click();
}

/** Books an interview in the given mode, opens its room and starts it. Ends with question 1 on screen. */
async function bookAndStart(page, mode) {
  await open(page, "/interviews/new");
  await chooseFirstOpenSlot(page);
  if (mode === "ASSESSMENT") {
    await page.locator(ASSESSMENT).click();
    await page.getByLabel(CONSENT_LABEL).check();
  }
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page).toHaveURL(/\/interviews\/(?!new)[a-z0-9]{20,}$/);

  await page.getByRole("link", { name: "Open interview room" }).first().click();
  await expect(page).toHaveURL(/\/session$/);
  await page.getByRole("button", { name: "Start the interview" }).click();
  await expect(page.getByText(`Question 1 of ${QUESTIONS}`)).toBeVisible();
}

/** Answers every question, submits, and returns the report's address once the report has opened. */
async function answerAndSubmit(page) {
  for (let number = 1; number <= QUESTIONS; number++) {
    await expect(page.getByText(`Question ${number} of ${QUESTIONS}`)).toBeVisible();
    await page.locator("#answer").fill(ANSWER);
    if (number < QUESTIONS) await page.getByRole("button", { name: "Next question" }).click();
  }
  await page.getByRole("button", { name: "Review and submit" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page).toHaveURL(/\/feedback\/[a-z0-9]{20,}$/, { timeout: 90_000 });
  return page.url();
}

/** Fires a paste event with `chars` characters at the answer box, as if text had been pasted in from elsewhere. */
async function pasteIntoAnswer(page, chars) {
  await page.locator("#answer").focus();
  await page.evaluate((count) => {
    const data = new DataTransfer();
    data.setData("text", "x".repeat(count));
    document
      .querySelector("#answer")
      ?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, chars);
}

test.describe("assessment mode", () => {
  test("an assessment is not booked until the candidate has agreed to the checks", async ({ page }) => {
    await register(page, newAccount("Consent Tester"));
    await open(page, "/interviews/new");
    await chooseFirstOpenSlot(page);

    // Practice is the default, and it shows no consent box.
    await expect(page.locator('input[name="mode"][value="PRACTICE"]')).toBeChecked();
    await expect(page.getByLabel(CONSENT_LABEL)).toHaveCount(0);

    // Choosing an assessment says what it does and asks for agreement.
    await page.locator(ASSESSMENT).click();
    await expect(page.getByText("What an assessment does")).toBeVisible();
    const consent = page.getByLabel(CONSENT_LABEL);
    await expect(consent).not.toBeChecked();

    // Without the tick nothing is booked, and the reason appears next to the box.
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByText(CONSENT_REQUIRED_MESSAGE)).toBeVisible();
    await expect(page).toHaveURL(/\/interviews\/new/);

    // Ticking it clears the message and lets the booking through.
    await consent.check();
    await expect(page.getByText(CONSENT_REQUIRED_MESSAGE)).toBeHidden();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page).toHaveURL(/\/interviews\/(?!new)[a-z0-9]{20,}$/);

    // The details page marks it as an assessment and repeats what that means.
    await expect(page.getByText("This is an assessment")).toBeVisible();
    await expect(page.getByText("Assessment", { exact: true }).first()).toBeVisible();
  });

  test("a large paste is noted during an assessment and appears in the report as a flag, not a verdict", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await register(page, newAccount("Assessment Tester"));
    await bookAndStart(page, "ASSESSMENT");

    // The candidate is told, in the room, that the checks are running and what they see.
    await expect(page.getByLabel("Assessment monitoring")).toBeVisible();
    await expect(page.getByText("Assessment mode")).toBeVisible();

    // A paste of 120 characters is over the 40-character line, so it is counted at once. The counter
    // would also show a flag if the camera or the model failed to load, so which flag it was is
    // checked in the report below, not here.
    await pasteIntoAnswer(page, 120);
    await expect(page.getByText(/\b[1-9]\d* flags? so far/)).toBeVisible();

    const reportUrl = await answerAndSubmit(page);

    // Opened directly, the report has a Presence and focus section with the flag in it.
    await open(page, reportUrl);
    await expect(page.getByRole("heading", { name: "Presence and focus" })).toBeVisible();
    await expect(page.getByText(/signals for a person to review, not proof of anything/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Totals by kind" })).toContainText("Pasted text into an answer");
    await expect(page.getByText("Question 1 · 120 characters")).toBeVisible();
    await expect(page.getByText(/This section never changes your score/)).toBeVisible();
  });

  test("a practice interview never asks for the camera", async ({ page }) => {
    test.setTimeout(120_000);
    await register(page, newAccount("Practice Tester"));
    // Counts every request for the camera made by the page, so "never" is something that can be checked.
    await page.addInitScript(() => {
      const counter = window;
      counter.__cameraRequests = 0;
      const devices = navigator.mediaDevices;
      if (!devices?.getUserMedia) return;
      const original = devices.getUserMedia.bind(devices);
      devices.getUserMedia = (constraints) => {
        counter.__cameraRequests += 1;
        return original(constraints);
      };
    });

    await bookAndStart(page, "PRACTICE");
    await expect(page.getByText("Assessment mode")).toHaveCount(0);
    await pasteIntoAnswer(page, 120); // a large paste is nobody's business in a practice session
    await expect(page.getByText(/flags? so far/)).toHaveCount(0);
    await page.waitForTimeout(1_000); // long enough for a monitor to have started, if there were one
    expect(await page.evaluate(() => window.__cameraRequests)).toBe(0);
  });
});
