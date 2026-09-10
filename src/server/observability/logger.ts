import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogValue = string | number | boolean | null | undefined;

const SENSITIVE_KEY =
  /(password|cookie|token|secret|authorization|api[-_]?key|raw.?payload|refresh)/i;

function safeValue(key: string, value: unknown): LogValue {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (value === null || value === undefined) return value;
  if (["string", "number", "boolean"].includes(typeof value)) {
    const text = String(value).replace(/[\r\n\t]/g, " ");
    return text.length > 256
      ? `${text.slice(0, 253)}...`
      : typeof value === "string"
        ? text
        : (value as LogValue);
  }
  return "[REDACTED]";
}

export function redactMetadata(metadata: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      safeValue(key, value),
    ]),
  );
}

export function log(
  level: LogLevel,
  event: string,
  metadata: Record<string, unknown> = {},
) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "twoplayer-web",
    environment: process.env.NODE_ENV ?? "development",
    severity: level,
    event: event.replace(/[\r\n\t]/g, " ").slice(0, 128),
    ...redactMetadata(metadata),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
