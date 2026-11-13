import type {
  FindLinkedAccountForRetryInput,
  FindLinkedAccountForRetryOutput,
  GetLinkedAccountForIngestionInput,
  GetLinkedAccountForIngestionOutput,
  GetLinkedAccountInput,
  GetLinkedAccountOutput,
  GetUserByLinkedAccountInput,
  GetUserByLinkedAccountOutput,
  LinkAccountInput,
  LinkAccountOutput,
  ListLinkedAccountsInput,
  ListLinkedAccountsOutput,
  UnlinkAccountInput,
  UnlinkAccountOutput,
} from "./dto";
import type { DbTx, Tx } from "@/pkg/db";

export interface LinkedAccountService {
  linkAccount(input: LinkAccountInput & { tx?: DbTx }): Promise<LinkAccountOutput>;
  findLinkedAccountForRetry(
    idempotencyKey: FindLinkedAccountForRetryInput["idempotencyKey"],
    tx: Tx
  ): Promise<FindLinkedAccountForRetryOutput>;
  getLinkedAccount(
    platform: GetLinkedAccountInput["platform"],
    platformUserId: GetLinkedAccountInput["platformUserId"]
  ): Promise<GetLinkedAccountOutput>;
  getLinkedAccountForIngestion(
    platform: GetLinkedAccountForIngestionInput["platform"],
    platformUserId: GetLinkedAccountForIngestionInput["platformUserId"],
    tx: Tx
  ): Promise<GetLinkedAccountForIngestionOutput>;
  getUserByLinkedAccount(
    platform: GetUserByLinkedAccountInput["platform"],
    platformUserId: GetUserByLinkedAccountInput["platformUserId"]
  ): Promise<GetUserByLinkedAccountOutput>;
  listLinkedAccounts(userId: ListLinkedAccountsInput["userId"]): Promise<ListLinkedAccountsOutput>;
  unlinkAccount(
    userId: UnlinkAccountInput["userId"],
    accountId: UnlinkAccountInput["accountId"]
  ): Promise<UnlinkAccountOutput>;
}
