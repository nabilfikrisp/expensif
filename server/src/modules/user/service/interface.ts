import type {
  DeleteUserInput,
  DeleteUserOutput,
  GetUserByEmailInput,
  GetUserByEmailOutput,
  GetUserInput,
  GetUserOutput,
} from "./dto";
import type { DbTx } from "@/pkg/db";

export interface UserService {
  deleteUser(userId: DeleteUserInput["userId"], tx?: DbTx): Promise<DeleteUserOutput>;
  getUser(userId: GetUserInput["userId"], tx?: DbTx): Promise<GetUserOutput>;
  getUserByEmail(email: GetUserByEmailInput["email"], tx?: DbTx): Promise<GetUserByEmailOutput>;
}
