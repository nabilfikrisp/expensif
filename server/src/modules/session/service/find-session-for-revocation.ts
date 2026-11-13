import { eq, or } from "drizzle-orm";
import type { FindSessionForRevocationInput, FindSessionForRevocationOutput } from "./dto";
import { sessions } from "@/modules/session/schema";
import type { Tx } from "@/pkg/db";

interface InitFindSessionForRevocationDeps {
  hashRefreshToken: (token: string) => string;
}

export function initFindSessionForRevocation({
  hashRefreshToken,
}: InitFindSessionForRevocationDeps) {
  return async function findSessionForRevocation(
    token: FindSessionForRevocationInput["token"],
    tx: Tx
  ): Promise<FindSessionForRevocationOutput> {
    const tokenHash = hashRefreshToken(token);
    return (
      (
        await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(or(eq(sessions.tokenHash, tokenHash), eq(sessions.prevTokenHash, tokenHash)))
          .for("update")
      ).at(0) ?? null
    );
  };
}
