import { eq } from "drizzle-orm";
import type { DeleteUserInput, DeleteUserOutput } from "./dto";
import { UserError } from "@/modules/user/error";
import { users } from "@/modules/user/schema";
import type { Db, DbTx } from "@/pkg/db";

interface InitDeleteUserDeps {
  db: Db;
}

export function initDeleteUser({ db }: InitDeleteUserDeps) {
  return async function deleteUser(
    userId: DeleteUserInput["userId"],
    tx: DbTx = db
  ): Promise<DeleteUserOutput> {
    const deleted = await tx.delete(users).where(eq(users.id, userId)).returning({ id: users.id });

    if (deleted.length === 0) {
      throw UserError.notFound();
    }
  };
}
