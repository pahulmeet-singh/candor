import { estimateYaw } from "./head-pose";

/** What the tracker needs from a detector's answer: how many faces, and how far each head is turned. */
export function toObservations(faces) {
  return faces.map((face) => ({ yaw: estimateYaw(face.keypoints) }));
}
