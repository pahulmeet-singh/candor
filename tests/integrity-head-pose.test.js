import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateYaw, isLookingAway } from "@/lib/integrity/head-pose";
import { INTEGRITY_RULES } from "@/lib/integrity/constants";

/**
 * A face as the detector reports it: the two eyes, the nose tip, the mouth and the two ears.
 * With the eyes at 0.4 and 0.6 they are 0.2 apart, so a nose that sits 0.05 off the middle is a yaw of 0.25.
 */
function face(noseX, eyes = [0.4, 0.6]) {
  return [
    { x: eyes[0], y: 0.4 },
    { x: eyes[1], y: 0.4 },
    { x: noseX, y: 0.5 },
    { x: 0.5, y: 0.62 },
    { x: 0.3, y: 0.45 },
    { x: 0.7, y: 0.45 },
  ];
}

function close(actual, expected, tolerance = 1e-9) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected}, got ${actual}`);
}

test("a face looking straight at the camera has a yaw of zero", () => {
  close(estimateYaw(face(0.5)), 0);
});

test("turning the head either way moves the yaw to either side of zero", () => {
  close(estimateYaw(face(0.55)), 0.25);
  close(estimateYaw(face(0.45)), -0.25);
});

test("the order the detector lists the eyes in does not matter", () => {
  close(estimateYaw(face(0.55, [0.6, 0.4])), 0.25);
});

test("yaw does not depend on how far from the camera the person sits", () => {
  // Same head turn, half the size in the picture: eyes 0.1 apart, nose 0.025 off centre.
  close(estimateYaw(face(0.525, [0.45, 0.55])), 0.25);
});

test("estimateYaw gives up (null) when it cannot measure", () => {
  assert.equal(estimateYaw([]), null);
  assert.equal(estimateYaw(face(0.5).slice(0, 2)), null);
  assert.equal(estimateYaw(face(0.5, [0.5, 0.5])), null); // eyes on top of each other
  assert.equal(estimateYaw(face(0.5, [0.5, 0.504])), null); // closer than 0.005 apart
  assert.equal(estimateYaw(face(Number.NaN)), null);
  assert.equal(estimateYaw(face(0.5, [Number.NaN, 0.6])), null);
});

test("isLookingAway uses the size of the turn, not its direction", () => {
  assert.equal(isLookingAway(null), false);
  assert.equal(isLookingAway(0), false);
  assert.equal(isLookingAway(0.34), false);
  assert.equal(isLookingAway(0.35), true);
  assert.equal(isLookingAway(-0.35), true);
  assert.equal(isLookingAway(-0.2), false);
  assert.equal(isLookingAway(1.4), true);
});

test("isLookingAway takes the project threshold by default and a custom one on request", () => {
  assert.equal(isLookingAway(INTEGRITY_RULES.lookingAwayYaw), true);
  assert.equal(isLookingAway(INTEGRITY_RULES.lookingAwayYaw - 0.01), false);
  assert.equal(isLookingAway(0.3, 0.25), true);
  assert.equal(isLookingAway(0.3, 0.5), false);
});
