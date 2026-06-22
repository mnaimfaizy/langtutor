import "server-only";

/**
 * Basic CSRF guard for the no-auth local proxy: reject state-changing requests whose
 * `Origin` doesn't match the host they target. Requests without an `Origin` header
 * (same-origin navigations, server-to-server) are allowed. Cheap and sufficient under the
 * single-user-local threat model; revisit if the app ever serves multiple origins.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
