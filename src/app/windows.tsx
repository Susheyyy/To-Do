export type WindowType = "main" | "quick-capture" | "floating-bar";

export function getWindowType(): WindowType {
  const param = new URLSearchParams(window.location.search).get("window");
  if (param === "quick-capture") return "quick-capture";
  if (param === "floating-bar") return "floating-bar";
  return "main";
}

export function isQuickCaptureWindow(): boolean {
  return getWindowType() === "quick-capture";
}

export function isFloatingBarWindow(): boolean {
  return getWindowType() === "floating-bar";
}
