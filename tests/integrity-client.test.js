import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toObservations } from "@/lib/integrity/face-source";
import { FACE_MODEL_URL, MEDIAPIPE_WASM_PATH, createMediaPipeFaceSource } from "@/lib/integrity/mediapipe-face-source";
import { EventOutbox, postBatchTo } from "@/lib/integrity/outbox";
import { INTEGRITY_RULES } from "@/lib/integrity/constants";

/**
 * The browser's side of the integrity monitor that does not need a browser: how events are queued
 * and retried, how a response is judged, and how the MediaPipe wrapper drives the library. The
 * React hook that wires these to a camera cannot run here and is covered by e2e/assessment.spec.js.
 */

const BASE = 1_800_000_000_000;
const draft = (n) => ({
  type: "FOCUS_LOST",
  startedAtMs: BASE + n,
  durationMs: 3000,
  questionId: "q1",
});
const drafts = (from, count) => Array.from({ length: count }, (_, index) => draft(from + index));
const ids = (events) => events.map((event) => event.startedAtMs - BASE);

/** A sender that records every batch it is given and answers from a script (then "sent" for ever). */
function recorder(script = []) {
  const batches = [];
  const send = async (batch) => {
    const answer = script[batches.length] ?? "sent";
    batches.push(structuredClone(batch));
    return answer;
  };
  return { batches, send };
}

const nextTick = () => new Promise((resolve) => setImmediate(resolve));

/* ───────────────────────── EventOutbox ───────────────────────── */

test("events are sent in order, in batches no bigger than the limit, until none are left", async () => {
  const { batches, send } = recorder();
  const outbox = new EventOutbox(send, () => 1000, { batch: 2, held: 300 });
  outbox.add(drafts(0, 5));
  await outbox.flush();
  assert.deepEqual(
    batches.map((batch) => ids(batch.events)),
    [[0, 1], [2, 3], [4]],
  );
  assert.equal(outbox.size, 0);
});

test("each batch carries the sender's clock as it goes out", async () => {
  let clock = 5000;
  const { batches, send } = recorder();
  const outbox = new EventOutbox(send, () => (clock += 100), { batch: 1, held: 300 });
  outbox.add(drafts(0, 3));
  await outbox.flush();
  assert.deepEqual(
    batches.map((batch) => batch.sentAtMs),
    [5100, 5200, 5300],
  );
});

test("flushing an empty outbox sends nothing", async () => {
  const { batches, send } = recorder();
  await new EventOutbox(send).flush();
  assert.equal(batches.length, 0);
});

test("a batch that did not get through is kept, in order, and goes out on the next flush", async () => {
  const { batches, send } = recorder(["retry", "sent"]);
  const outbox = new EventOutbox(send, () => 1, { batch: 50, held: 300 });
  outbox.add(drafts(0, 2));
  await outbox.flush();
  assert.equal(outbox.size, 2);
  outbox.add(drafts(2, 1));
  await outbox.flush();
  assert.deepEqual(
    batches.map((batch) => ids(batch.events)),
    [
      [0, 1],
      [0, 1, 2],
    ],
  );
  assert.equal(outbox.size, 0);
});

test("after a retry the flush stops, rather than hammering a server that is struggling", async () => {
  const { batches, send } = recorder(["sent", "retry"]);
  const outbox = new EventOutbox(send, () => 1, { batch: 1, held: 300 });
  outbox.add(drafts(0, 3));
  await outbox.flush();
  assert.equal(batches.length, 2);
  assert.equal(outbox.size, 2);
});

test("a batch the server refuses for good is forgotten, and the next one still goes", async () => {
  const { batches, send } = recorder(["drop", "sent", "sent"]);
  const outbox = new EventOutbox(send, () => 1, { batch: 1, held: 300 });
  outbox.add(drafts(0, 3));
  await outbox.flush();
  assert.deepEqual(
    batches.map((batch) => ids(batch.events)),
    [[0], [1], [2]],
  );
  assert.equal(outbox.size, 0);
});

test("a sender that throws counts as a retry: flush resolves and the events stay", async () => {
  const outbox = new EventOutbox(async () => {
    throw new Error("offline");
  });
  outbox.add(drafts(0, 1));
  await outbox.flush();
  assert.equal(outbox.size, 1);
});

test("events added while a request is in the air are neither lost nor sent twice", async () => {
  const seen = [];
  let release = () => undefined;
  const gate = new Promise((resolve) => (release = resolve));
  let first = true;
  const outbox = new EventOutbox(
    async (batch) => {
      seen.push(ids(batch.events));
      if (first) {
        first = false;
        await gate;
      }
      return "sent";
    },
    () => 1,
    { batch: 50, held: 300 },
  );
  outbox.add(drafts(0, 2));
  const flushing = outbox.flush();
  await nextTick(); // the first request is now waiting at the gate
  outbox.add(drafts(2, 2));
  release();
  await flushing;
  assert.deepEqual(seen, [
    [0, 1],
    [2, 3],
  ]);
  assert.equal(outbox.size, 0);
});

test("two flushes never run at once, and both resolve only after everything has gone", async () => {
  let inFlight = 0;
  let mostInFlight = 0;
  const outbox = new EventOutbox(
    async () => {
      inFlight += 1;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await nextTick();
      inFlight -= 1;
      return "sent";
    },
    () => 1,
    { batch: 1, held: 300 },
  );
  outbox.add(drafts(0, 3));
  await Promise.all([outbox.flush(), outbox.flush()]);
  assert.equal(mostInFlight, 1);
  assert.equal(outbox.size, 0);
});

test("an outbox that cannot send gives up the newest events, keeping the earliest, like the server does", async () => {
  const { batches, send } = recorder();
  const small = new EventOutbox(send, () => 1, { batch: 50, held: 3 });
  small.add(drafts(0, 5));
  assert.equal(small.size, 3);
  await small.flush();
  assert.deepEqual(ids(batches[0]?.events ?? []), [0, 1, 2]);
});

test("the default limits are the ones the server enforces: 50 per request, 300 per interview", async () => {
  const { batches, send } = recorder();
  const outbox = new EventOutbox(send);
  outbox.add(drafts(0, INTEGRITY_RULES.maxEventsPerInterview + 20));
  assert.equal(outbox.size, 300);
  await outbox.flush();
  assert.deepEqual(
    batches.map((batch) => batch.events.length),
    [50, 50, 50, 50, 50, 50],
  );
});

/* ───────────────────────── postBatchTo ───────────────────────── */

function fakeFetch(respond) {
  const requests = [];
  const doFetch = async (url, init) => {
    requests.push({ url, init });
    return respond();
  };
  return { requests, doFetch };
}

test("a batch is POSTed as JSON to the interview's integrity route, with keepalive", async () => {
  const { requests, doFetch } = fakeFetch(() => new Response("{}", { status: 200 }));
  const batch = { sentAtMs: BASE + 500, events: [draft(1)] };
  assert.equal(await postBatchTo("cm1/odd id", doFetch)(batch), "sent");
  const [request] = requests;
  assert.ok(request);
  assert.equal(request.url, "/api/interviews/cm1%2Fodd%20id/integrity");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(request.init.headers, { "Content-Type": "application/json" });
  assert.equal(request.init.keepalive, true);
  assert.deepEqual(JSON.parse(String(request.init.body)), batch);
});

test("the response decides whether a batch is kept: server trouble is retried, a refusal is dropped", async () => {
  const outcome = (status) =>
    postBatchTo("x", fakeFetch(() => new Response(null, { status })).doFetch)({ sentAtMs: 1, events: [draft(0)] });
  for (const status of [200, 204]) assert.equal(await outcome(status), "sent", String(status));
  for (const status of [408, 429, 500, 502, 503]) assert.equal(await outcome(status), "retry", String(status));
  for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(await outcome(status), "drop", String(status));
});

test("a network failure is a retry, not an error", async () => {
  const doFetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  assert.equal(await postBatchTo("x", doFetch)({ sentAtMs: 1, events: [draft(0)] }), "retry");
});

/* ───────────────────────── face-source and the MediaPipe wrapper ───────────────────────── */

test("detected faces become observations, with the head turn worked out from the keypoints", () => {
  const face = (noseX) => ({
    keypoints: [
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 },
      { x: noseX, y: 0.5 },
    ],
  });
  const observations = toObservations([face(0.55), { keypoints: [] }]);
  assert.equal(observations.length, 2);
  assert.ok(Math.abs((observations[0]?.yaw ?? 99) - 0.25) < 1e-9);
  assert.equal(observations[1]?.yaw, null);
  assert.deepEqual(toObservations([]), []);
});

/** Stands in for @mediapipe/tasks-vision, recording how it was driven. */
function fakeMediaPipe(behaviour = {}) {
  const calls = { wasmPaths: [], options: [], timestamps: [], closed: 0 };
  const module = {
    FilesetResolver: {
      forVisionTasks: async (path) => {
        calls.wasmPaths.push(path);
        return { fileset: path };
      },
    },
    FaceDetector: {
      createFromOptions: async (_fileset, options) => {
        calls.options.push(options);
        const delegate = options.baseOptions.delegate;
        if ((delegate === "GPU" && behaviour.gpuFails) || (delegate === "CPU" && behaviour.cpuFails)) {
          throw new Error(`${delegate} delegate unavailable`);
        }
        return {
          detectForVideo: (_video, timestampMs) => {
            calls.timestamps.push(timestampMs);
            return { detections: behaviour.detections ?? [] };
          },
          close: () => {
            calls.closed += 1;
          },
        };
      },
    },
  };
  return { module, calls, load: async () => module };
}

const VIDEO = {};

test("the wrapper serves the runtime from the app itself and the model from the published BlazeFace URL", async () => {
  const { calls, load } = fakeMediaPipe();
  await createMediaPipeFaceSource(load);
  assert.deepEqual(calls.wasmPaths, ["/mediapipe/wasm"]);
  assert.deepEqual(calls.options, [
    {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    },
  ]);
  // As published at developers.google.com/edge/mediapipe/solutions/vision/face_detector (BlazeFace short-range).
  assert.equal(
    FACE_MODEL_URL,
    "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
  );
});

test("the wrapper falls back to the CPU when the GPU cannot be used", async () => {
  const { calls, load } = fakeMediaPipe({ gpuFails: true });
  await createMediaPipeFaceSource(load);
  assert.deepEqual(
    calls.options.map((options) => options.baseOptions.delegate),
    ["GPU", "CPU"],
  );
});

test("if neither delegate works the wrapper rejects, which the monitor reports as a camera that cannot be checked", async () => {
  const { load } = fakeMediaPipe({ gpuFails: true, cpuFails: true });
  await assert.rejects(createMediaPipeFaceSource(load), /CPU delegate unavailable/);
});

test("detect hands the frame and a timestamp to MediaPipe and returns only plain keypoints", async () => {
  const { calls, load } = fakeMediaPipe({
    detections: [
      {
        boundingBox: { originX: 1, originY: 2, width: 3, height: 4 },
        categories: [{ score: 0.97 }],
        keypoints: [
          { x: 0.4, y: 0.4, label: "", score: 0 },
          { x: 0.6, y: 0.4 },
        ],
      },
      { categories: [] },
    ],
  });
  const source = await createMediaPipeFaceSource(load);
  const faces = source.detect(VIDEO, 1234.5);
  assert.deepEqual(calls.timestamps, [1234.5]);
  assert.deepEqual(faces, [
    {
      keypoints: [
        { x: 0.4, y: 0.4 },
        { x: 0.6, y: 0.4 },
      ],
    },
    { keypoints: [] },
  ]);
});

test("closing the source closes the detector", async () => {
  const { calls, load } = fakeMediaPipe();
  const source = await createMediaPipeFaceSource(load);
  source.close();
  assert.equal(calls.closed, 1);
});

/* ───────────────────────── the pieces that must agree with each other ───────────────────────── */

const read = (...parts) => readFileSync(join(process.cwd(), ...parts), "utf8");

test("the runtime path the browser asks for is the folder the install script fills, and install runs the script", () => {
  assert.equal(MEDIAPIPE_WASM_PATH, "/mediapipe/wasm");
  assert.match(read("scripts", "copy-mediapipe-wasm.mjs"), /join\(root, "public", "mediapipe", "wasm"\)/);
  const manifest = JSON.parse(read("package.json"));
  assert.match(manifest.scripts.postinstall ?? "", /copy-mediapipe-wasm\.mjs/);
  assert.ok(manifest.dependencies["@mediapipe/tasks-vision"], "@mediapipe/tasks-vision must be a dependency");
  assert.match(read(".gitignore"), /^public\/mediapipe\/$/m);
});
