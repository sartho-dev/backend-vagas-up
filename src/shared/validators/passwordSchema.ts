import { z } from "zod";

// RN25: 10 to 64 characters, no character-type requirements.
// bcrypt only reads the first 72 BYTES (not characters), so the byte length is
// checked as well: accents and emojis take more than one byte each (PR6).
//
// This is the single place for the password rule. The student validator should
// re-export it, so students and admins can never drift apart.
export const passwordSchema = z
  .string()
  .min(10, "Password must have at least 10 characters")
  .max(64, "Password must have at most 64 characters")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password is too long (bcrypt limit is 72 bytes)",
  );
