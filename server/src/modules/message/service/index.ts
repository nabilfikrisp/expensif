import { initCreateMessage } from "./create-message";
import { initFindMessageByIdempotencyKey } from "./find-message-by-idempotency-key";
import type { MessageService } from "./interface";
import type { Db } from "@/pkg/db";

interface InitMessageServiceDeps {
  db: Db;
}

export function initMessageService({ db }: InitMessageServiceDeps): MessageService {
  return {
    findMessageByIdempotencyKey: initFindMessageByIdempotencyKey({ db }),
    createMessage: initCreateMessage(),
  };
}
