import { eq } from "drizzle-orm";
import type { GetUserByEmailInput, GetUserByEmailOutput } from "./dto";
import { UserError } from "@/modules/user/error";
import { users } from "@/modules/user/schema";
import type { Db, DbTx } from "@/pkg/db";

interface InitGetUserByEmailDeps {
  db: Db;
}

export function initGetUserByEmail({ db }: InitGetUserByEmailDeps) {
  return async function getUserByEmail(
    email: GetUserByEmailInput["email"],
    tx: DbTx = db
  ): Promise<GetUserByEmailOutput> {
    const user = (
      await tx
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    ).at(0);

    if (!user) {
      throw UserError.notFound();
    }

    return user;
  };
}
