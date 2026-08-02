/*
  Privacy boundary:
  Raw camera frames and pixel data must never be written to disk, sent over the network,
  or stored in any variable that outlives a single animation frame. This module only
  manages the live webcam stream attached to the video element.
*/

export async function startCamera(videoElement) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not supported in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });

  videoElement.srcObject = stream;
  await videoElement.play();
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
