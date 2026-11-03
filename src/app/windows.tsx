export function isQuickCaptureWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === "quick-capture";
}

