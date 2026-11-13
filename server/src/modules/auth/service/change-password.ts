import { eq } from "drizzle-orm";
import type { ChangePasswordInput, ChangePasswordOutput } from "./dto";
import { users } from "@/modules/user/schema";
import type { Tx } from "@/pkg/db";

interface InitChangePasswordDeps {
  verifyCurrentPassword: (userId: string, currentPassword: string, tx: Tx) => Promise<void>;
  hashPassword: (plain: string) => Promise<string>;
}

export function initChangePassword({
  verifyCurrentPassword,
  hashPassword,
}: InitChangePasswordDeps) {
  return async function changePassword(
    userId: ChangePasswordInput["userId"],
    currentPassword: ChangePasswordInput["currentPassword"],
    newPassword: ChangePasswordInput["newPassword"],
    tx: Tx
  ): Promise<ChangePasswordOutput> {
    await verifyCurrentPassword(userId, currentPassword, tx);
    const passwordHash = await hashPassword(newPassword);
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
  };
}
