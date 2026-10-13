import "dotenv";
import bcrypt from "bcrypt";
import { z } from "zod";
import { config } from "../../config";
import { AppDataSource } from "../data-source";
import { Admin } from "../../../modules/admin/schema/Admin.schema";

// Place at: src/shared/database/seeds/createFirstAdmin.ts
//
// RF21 / §2.1: the FIRST administrator is created by this script; every other
// one is created by an existing administrator through the API.
//
// Usage (env vars, never CLI arguments, so the password stays out of the shell
// history and the process list):
//   ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run seed:admin
//
// Safe to run more than once: if any administrator already exists, it does
// nothing and exits successfully.

// RNF01: bcrypt cost must be at least 12.
const MIN_BCRYPT_COST = 12;

// RN25: 10 to 64 characters, no character-type requirements. bcrypt only reads
// the first 72 BYTES, so the byte length is checked as well (PR6).
const inputSchema = z.object({
  name: z.string().trim().min(1, "ADMIN_NAME is required").max(150),
  // Same normalisation as login/sign-up (trim + lowercase).
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("ADMIN_EMAIL is invalid")),
  password: z
    .string()
    .min(10, "ADMIN_PASSWORD must have at least 10 characters")
    .max(64, "ADMIN_PASSWORD must have at most 64 characters")
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "ADMIN_PASSWORD is too long in bytes (bcrypt limit is 72)",
    ),
});

function fail(message: string): never {
  console.error(`[seed:admin] ${message}`);
  process.exit(1);
}

async function main() {
  // The script refuses to run without the variables.
  const missing = ["ADMIN_NAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"].filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    fail(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (config.bcryptCost < MIN_BCRYPT_COST) {
    fail(`BCRYPT_COST must be at least ${MIN_BCRYPT_COST} (RNF01)`);
  }

  const parsed = inputSchema.safeParse({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    fail(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  const { name, email, password } = parsed.data;

  await AppDataSource.initialize();

  try {
    // Hash before opening the transaction so the lock is held only briefly.
    const passwordHash = await bcrypt.hash(password, config.bcryptCost);

    const created = await AppDataSource.transaction(async (manager) => {
      // Serialises concurrent runs: the second one waits, then sees the admin
      // the first one created. The key is arbitrary but must stay constant.
      await manager.query("SELECT pg_advisory_xact_lock(7001)");

      const adminCount = await manager.count(Admin);
      if (adminCount > 0) return false;

      // RN06: an email is unique across students, responsibles and admins.
      // Admins are empty at this point, so checking students is enough today;
      // add the responsibles table here when that module exists.
      const emailTaken = await manager.query(
        `SELECT 1 FROM "students" WHERE "email" = $1 LIMIT 1`,
        [email],
      );
      if (emailTaken.length > 0) {
        throw new Error(
          "ADMIN_EMAIL is already used by another account (RN06)",
        );
      }

      // created_by stays NULL: this is the only admin without a creator.
      await manager.insert(Admin, {
        name,
        email,
        passwordHash,
        active: true,
        createdById: null,
      });

      return true;
    });

    console.log(
      created
        ? `[seed:admin] First administrator created: ${email}`
        : "[seed:admin] An administrator already exists. Nothing to do.",
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  // Never print the input: the password must not reach the logs.
  console.error(
    `[seed:admin] Failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exit(1);
});
