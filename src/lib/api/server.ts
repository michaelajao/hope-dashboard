/**
 * Server-only client factories. Import from Route Handlers / Server
 * Components / Server Actions; never from client components, since these
 * pull in the HMAC signer which depends on `node:crypto` and the secret.
 */

// Defensive guard since `server-only` is bundled but importable through next:
if (typeof window !== "undefined") {
    throw new Error("lib/api/server.ts must not be imported in browser code");
}

import { signerOrUndefined } from "@/lib/auth/sign";
import { createCommentGenClient } from "@/lib/api/commentGen";
import { createDropoutClient } from "@/lib/api/dropout";

const COMMENT_GEN_URL =
    process.env.COMMENT_GEN_URL ?? "http://localhost:8001";
const DROPOUT_API_URL =
    process.env.DROPOUT_API_URL ?? "http://localhost:8000";

export function commentGen() {
    return createCommentGenClient({
        baseUrl: COMMENT_GEN_URL,
        sign: signerOrUndefined(),
    });
}

export function dropoutApi() {
    return createDropoutClient({
        baseUrl: DROPOUT_API_URL,
        sign: signerOrUndefined(),
    });
}
