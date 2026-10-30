/** Minimal, structurally typed RPC access so the friend/Postfach/call clients stay unit-testable. */
export type RpcError = { message?: string; code?: string; details?: string; hint?: string };
export type RpcResult = { data: unknown; error: RpcError | null };
export type RpcGateway = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
};

/** The migrations are not applied yet (PostgREST: function/table/column unknown). */
export class BackendNotReadyError extends Error {
  constructor(message = "Diese Funktion ist auf dem Server noch nicht eingerichtet.") {
    super(message);
    this.name = "BackendNotReadyError";
  }
}

export class RegisteredAccountRequiredError extends Error {
  constructor(message = "Dafür brauchst du ein registriertes Konto (kein Gastzugang).") {
    super(message);
    this.name = "RegisteredAccountRequiredError";
  }
}

export class FriendFeatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FriendFeatureError";
  }
}

export function isBackendMissing(error: RpcError | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    code === "42883" ||
    code === "42P01" ||
    code === "42703" ||
    text.includes("could not find the function") ||
    text.includes("could not find the table") ||
    text.includes("schema cache")
  );
}

/** Throws a typed error for a failed RPC result; returns the data otherwise. */
export function unwrapRpc(result: RpcResult, fallbackMessage: string): unknown {
  const { error } = result;
  if (!error) return result.data;
  if (isBackendMissing(error)) throw new BackendNotReadyError();
  if ((error.message ?? "").includes("registered_account_required")) {
    throw new RegisteredAccountRequiredError();
  }
  throw new FriendFeatureError(fallbackMessage);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
