/**
 * MediaPipe's face detector, wrapped as a `FaceSource`. This is the only file that knows about
 * MediaPipe, and the monitor loads it with a dynamic `import()` the first time an assessment
 * starts, so practice interviews never download it.
 *
 * Everything runs in the candidate's browser: the model (about 230 KB) and the WebAssembly runtime
 * are downloaded once, and from then on each camera frame is analysed on the device. No frame is
 * sent anywhere. That is what the promise on the booking form rests on.
 */

/** Where the WebAssembly runtime is served from. scripts/copy-mediapipe-wasm.mjs copies it into public/ at install time. */
export const MEDIAPIPE_WASM_PATH = "/mediapipe/wasm";

/**
 * BlazeFace short-range, the face detector Google publishes for MediaPipe: six keypoints per face
 * (right eye, left eye, nose tip, mouth, two ears), which is what head-pose.js reads. Set
 * NEXT_PUBLIC_FACE_MODEL_URL to pin a version or to serve the file yourself from public/.
 */
export const FACE_MODEL_URL =
  process.env.NEXT_PUBLIC_FACE_MODEL_URL ||
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

/**
 * Loads the package. It is a parameter of the factory only so that a test can hand over a fake: the
 * real package needs a browser, a camera frame and a WebAssembly download.
 */
const loadPackage = () => import("@mediapipe/tasks-vision");

export const createMediaPipeFaceSource = async (load = loadPackage) => {
  const { FaceDetector, FilesetResolver } = await load();
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);

  const create = (delegate) =>
    FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    });

  let detector;
  try {
    detector = await create("GPU");
  } catch {
    // No usable WebGL (a remote desktop, an old driver). The CPU build is slower but plenty at five frames a second.
    detector = await create("CPU");
  }

  return {
    detect(video, timestampMs) {
      const { detections } = detector.detectForVideo(video, timestampMs);
      return detections.map((detection) => ({
        keypoints: (detection.keypoints ?? []).map(({ x, y }) => ({ x, y })),
      }));
    },
    close() {
      detector.close();
    },
  };
};
