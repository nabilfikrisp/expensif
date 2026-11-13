import { eq } from "drizzle-orm";
import type { GetUserInput, GetUserOutput } from "./dto";
import { UserError } from "@/modules/user/error";
import { users } from "@/modules/user/schema";
import type { Db, DbTx } from "@/pkg/db";

interface InitGetUserDeps {
  db: Db;
}

export function initGetUser({ db }: InitGetUserDeps) {
  return async function getUser(
    userId: GetUserInput["userId"],
    tx: DbTx = db
  ): Promise<GetUserOutput> {
    const user = (
      await tx
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    ).at(0);

    if (!user) {
      throw UserError.notFound();
    }

    return user;
  };
}
