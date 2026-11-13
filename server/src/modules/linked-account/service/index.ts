import { initFindLinkedAccountForRetry } from "./find-linked-account-for-retry";
import { initGetLinkedAccount } from "./get-linked-account";
import { initGetLinkedAccountForIngestion } from "./get-linked-account-for-ingestion";
import { initGetUserByLinkedAccount } from "./get-user-by-linked-account";
import type { LinkedAccountService } from "./interface";
import { initLinkAccount } from "./link-account";
import { initListLinkedAccounts } from "./list-linked-accounts";
import { initUnlinkAccount } from "./unlink-account";
import type { Db } from "@/pkg/db";

interface InitLinkedAccountServiceDeps {
  db: Db;
}

export function initLinkedAccountService({
  db,
}: InitLinkedAccountServiceDeps): LinkedAccountService {
  return {
    linkAccount: initLinkAccount({ db }),
    findLinkedAccountForRetry: initFindLinkedAccountForRetry(),
    getLinkedAccount: initGetLinkedAccount({ db }),
    getLinkedAccountForIngestion: initGetLinkedAccountForIngestion(),
    getUserByLinkedAccount: initGetUserByLinkedAccount({ db }),
    listLinkedAccounts: initListLinkedAccounts({ db }),
    unlinkAccount: initUnlinkAccount({ db }),
  };
}
