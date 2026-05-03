import type { components } from "./types";

export type Schemas = components["schemas"];

export type ApiClientOptions = {
    baseUrl: string;
    /**
     * Hex-encoded HMAC-SHA256 signature provider. Returns the signature for
     * a given raw body. Server-side only; never invoke from a browser
     * environment.
     */
    sign?: (body: string) => Promise<string>;
    /**
     * Forwarded session cookie when calling read endpoints from the
     * Next.js Route Handler proxy.
     */
    cookie?: string;
    fetchImpl?: typeof fetch;
};

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly detail: string,
        readonly code?: string,
    ) {
        super(`${status} ${detail}`);
        this.name = "ApiError";
    }
}

type RequestOptions = {
    method?: "GET" | "POST" | "DELETE";
    path: string;
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    /** When true, attach the HMAC signature header. */
    signed?: boolean;
};

export function createClient(opts: ApiClientOptions) {
    const fetchImpl = opts.fetchImpl ?? fetch;

    async function request<T>({
        method = "GET",
        path,
        query,
        body,
        signed = false,
    }: RequestOptions): Promise<T> {
        const url = new URL(path, opts.baseUrl);
        if (query) {
            for (const [k, v] of Object.entries(query)) {
                if (v !== undefined) url.searchParams.set(k, String(v));
            }
        }

        const headers: Record<string, string> = {};
        let rawBody: string | undefined;
        if (body !== undefined) {
            rawBody = JSON.stringify(body);
            headers["Content-Type"] = "application/json";
        }
        if (signed) {
            if (!opts.sign) {
                throw new Error("signed request requires `sign` option");
            }
            headers["X-HMAC-Signature"] = await opts.sign(rawBody ?? "");
        }
        if (opts.cookie) {
            headers["Cookie"] = opts.cookie;
        }

        const res = await fetchImpl(url.toString(), {
            method,
            headers,
            body: rawBody,
        });

        if (!res.ok) {
            let detail = res.statusText;
            let code: string | undefined;
            try {
                const err = (await res.json()) as Schemas["ErrorResponse"];
                detail = err.detail ?? detail;
                code = err.code ?? undefined;
            } catch {
                /* response had no JSON body */
            }
            throw new ApiError(res.status, detail, code);
        }

        if (res.status === 204) return undefined as T;
        const ct = res.headers.get("content-type") ?? "";
        return (ct.includes("application/json") ? await res.json() : (await res.text())) as T;
    }

    return { request };
}
