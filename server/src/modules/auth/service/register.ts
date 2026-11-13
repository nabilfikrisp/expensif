import type { RegisterInput, RegisterOutput } from "./dto";
import { AuthError } from "@/modules/auth/error";
import { users } from "@/modules/user/schema";
import type { Db, DbTx } from "@/pkg/db";
import { isUniqueConstraintError } from "@/pkg/db/error";

interface InitRegisterDeps {
  db: Db;
  hashPassword: (plain: string) => Promise<string>;
}

export function initRegister({ db, hashPassword }: InitRegisterDeps) {
  return async function register(
    email: RegisterInput["email"],
    password: RegisterInput["password"],
    name: RegisterInput["name"],
    tx: DbTx = db
  ): Promise<RegisterOutput> {
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    try {
      await tx.insert(users).values({ id, email, passwordHash, name });
    } catch (err: unknown) {
      if (isUniqueConstraintError(err)) {
        throw AuthError.emailAlreadyRegistered();
      }
      throw err;
    }

    return { userId: id };
  };
}
