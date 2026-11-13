import { initDeleteUser } from "./delete-user";
import { initGetUser } from "./get-user";
import { initGetUserByEmail } from "./get-user-by-email";
import type { UserService } from "./interface";
import type { Db } from "@/pkg/db";

interface InitUserServiceDeps {
  db: Db;
}

export function initUserService({ db }: InitUserServiceDeps): UserService {
  return {
    deleteUser: initDeleteUser({ db }),
    getUser: initGetUser({ db }),
    getUserByEmail: initGetUserByEmail({ db }),
  };
}
