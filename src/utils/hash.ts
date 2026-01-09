import { createHash } from "crypto";

export function hashPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}
