/** What a form action hands back to its form. `error` is a key into the `errors` dictionary. */
export type FormState<T = undefined> =
  | { status: "idle" }
  | { status: "ok"; data: T }
  | { status: "error"; error: ErrorKey; field?: string };

export type ErrorKey =
  "invalid" | "notSignedIn" | "forbidden" | "notFound" | "lastAdmin" | "tooLarge" | "unknown";

/** Maps Postgres/PostgREST error codes raised by our policies and functions. */
export function errorKeyFor(code: string | undefined): ErrorKey {
  switch (code) {
    case "42501":
      return "forbidden";
    case "P0002":
      return "notFound";
    case "23514":
      return "lastAdmin";
    case "22023":
    case "23505":
      return "invalid";
    default:
      return "unknown";
  }
}
