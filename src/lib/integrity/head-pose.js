import { INTEGRITY_RULES } from "./constants";

/**
 * How far the head is turned sideways, from the keypoints a face detector returns.
 *
 * BlazeFace (the model MediaPipe's FaceDetector uses) gives six points per face, in this order:
 * one eye, the other eye, the nose tip, the mouth and the two ears. Only the first three matter
 * here. Facing the screen, the nose sits halfway between the eyes. Turn the head and the nose
 * slides toward one eye, so
 *
 *     yaw = (nose.x - midpoint of the eyes) / distance between the eyes
 *
 * is about 0 when you face the screen and about 0.5 when you are turned 40 to 50 degrees. The
 * sign says which way, but "away" does not care. It is a cheap geometric estimate, not a trained
 * head-pose model: good enough to notice someone reading from a second screen, and it will
 * sometimes be wrong, which is why the result is only ever shown as a flag for a person to review.
 *
 * Returns null when there are too few points or the eyes are too close together to measure.
 */
export function estimateYaw(keypoints) {
  const [first, second, nose] = keypoints;
  if (!first || !second || !nose) return null;

  const left = first.x <= second.x ? first : second;
  const right = first.x <= second.x ? second : first;
  const eyeDistance = right.x - left.x;
  if (!(eyeDistance > 0.005)) return null;

  const yaw = (nose.x - (left.x + right.x) / 2) / eyeDistance;
  return Number.isFinite(yaw) ? yaw : null;
}

export function isLookingAway(yaw, threshold = INTEGRITY_RULES.lookingAwayYaw) {
  return yaw !== null && Math.abs(yaw) >= threshold;
}
