import type {
  AcceptPreviousSessionTokenInput,
  AcceptPreviousSessionTokenOutput,
  CleanupExpiredSessionsOutput,
  CreateSessionInput,
  CreateSessionOutput,
  FindSessionForRevocationInput,
  FindSessionForRevocationOutput,
  FindValidSessionInput,
  FindValidSessionOutput,
  RevokeAllSessionsInput,
  RevokeAllSessionsOutput,
  RevokeSessionInput,
  RevokeSessionOutput,
  RotateSessionTokenInput,
  RotateSessionTokenOutput,
} from "./dto";
import type { DbTx, Tx } from "@/pkg/db";

export interface SessionService {
  cleanupExpiredSessions(): Promise<CleanupExpiredSessionsOutput>;
  createSession(userId: CreateSessionInput["userId"], ctx?: DbTx): Promise<CreateSessionOutput>;
  findValidSession(token: FindValidSessionInput["token"], tx: Tx): Promise<FindValidSessionOutput>;
  rotateSessionToken(
    sessionId: RotateSessionTokenInput["sessionId"],
    tx: Tx
  ): Promise<RotateSessionTokenOutput>;
  acceptPreviousSessionToken(
    sessionId: AcceptPreviousSessionTokenInput["sessionId"],
    tx: Tx
  ): Promise<AcceptPreviousSessionTokenOutput>;
  findSessionForRevocation(
    token: FindSessionForRevocationInput["token"],
    tx: Tx
  ): Promise<FindSessionForRevocationOutput>;
  revokeAllSessions(
    userId: RevokeAllSessionsInput["userId"],
    tx: Tx
  ): Promise<RevokeAllSessionsOutput>;
  revokeSession(sessionId: RevokeSessionInput["sessionId"], tx: Tx): Promise<RevokeSessionOutput>;
}
