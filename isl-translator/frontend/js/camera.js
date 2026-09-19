/*
  Privacy boundary:
  Raw camera frames and pixel data must never be written to disk, sent over the network,
  or stored in any variable that outlives a single animation frame. This module only
  manages the live webcam stream attached to the video element.
*/

export async function startCamera(videoElement) {
  if (!window.isSecureContext) throw new Error("Camera access needs localhost or trusted HTTPS. Open the app on localhost on this laptop, or use HTTPS on your phone.");
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not supported in this browser.");
  }

  let expired = false, timer;
  const cameraRequest = navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user", frameRate: { ideal: 30, max: 30 } },
    audio: false,
  }).then(stream => {
    if (expired) { stream.getTracks().forEach(track => track.stop()); throw new Error("Camera permission arrived after the request expired. Please retry."); }
    return stream;
  });
  let stream;
  try {
    stream = await Promise.race([cameraRequest, new Promise((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error("Still waiting for camera permission. Allow Camera in the browser’s site settings, then press Start / retry camera. If using the embedded preview, open this URL in Chrome or Edge.")); }, 20000);
    })]);
  } finally { clearTimeout(timer); }

  videoElement.srcObject = stream;
  try { await videoElement.play(); }
  catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  return stream;
}

export function stopCamera(videoElement) {
  const stream = videoElement.srcObject;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  videoElement.srcObject = null;
}

export function describeCameraError(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Please allow webcam access and reload the page.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No compatible camera was found for the requested settings.";
    case "NotReadableError":
      return "The camera is already in use by another application or browser tab.";
    default:
      return error?.message || "Unable to start the camera.";
  }
}
