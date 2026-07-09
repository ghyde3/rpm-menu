// Shared service-layer error types. Route/MCP handlers map these to
// HTTP/tool-error responses (alongside `AuthError` from role-guard.ts).
export class NotFoundError extends Error {
  status = 404;
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
