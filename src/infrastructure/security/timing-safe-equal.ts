import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for shared secrets (harden-admin-authentication,
 * task 9.1): `===` on strings short-circuits at the first differing byte,
 * so the response time leaks how many leading bytes of a guess were
 * correct. `crypto.timingSafeEqual` throws on a length mismatch instead of
 * comparing, so the length check here must happen first — and must not
 * itself leak timing beyond "lengths differ or not" (unavoidable: the
 * secret's length isn't usually meant to be secret here).
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
