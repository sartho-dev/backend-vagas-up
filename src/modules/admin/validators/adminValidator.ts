import { z } from "zod";
import {
  emailSchema,
  nameSchema,
} from "../../student/validators/CreateStudentValidator";
import { passwordSchema } from "../../../shared/validators/passwordSchema";

// RF21: register another administrator.
export const createAdminSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type CreateAdminInput = z.infer<typeof createAdminSchema>;

// RF22: an administrator edits their OWN name and password.
// `.strict()` also rejects `email`: changing the email waits for the email
// confirmation task (RN27).
export const updateOwnProfileSchema = z
  .object({
    name: nameSchema.optional(),
    // Not checked for strength: rules apply to the NEW password only.
    currentPassword: z
      .string()
      .min(1, "Current password is required")
      .max(200, "Current password is too long")
      .optional(),
    newPassword: passwordSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const touchesPassword =
      data.currentPassword !== undefined || data.newPassword !== undefined;

    if (data.name === undefined && !touchesPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Send at least one field to update",
        path: [],
      });
    }

    if (data.newPassword !== undefined && data.currentPassword === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Current password is required to change the password",
        path: ["currentPassword"],
      });
    }

    if (data.currentPassword !== undefined && data.newPassword === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "New password is required",
        path: ["newPassword"],
      });
    }

    if (
      data.currentPassword !== undefined &&
      data.newPassword !== undefined &&
      data.currentPassword === data.newPassword
    ) {
      ctx.addIssue({
        code: "custom",
        message: "New password must be different from the current one",
        path: ["newPassword"],
      });
    }
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

// RF21: paginated list. Query strings arrive as text, hence the coercion.
export const listAdminsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    active: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export type ListAdminsQuery = z.infer<typeof listAdminsQuerySchema>;

// A malformed id would otherwise reach Postgres and come back as a 500.
export const adminIdParamSchema = z.object({
  id: z.uuid("Invalid administrator id"),
});
