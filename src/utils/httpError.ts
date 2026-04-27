export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  public constructor(statusCode: number, message: string, options: { code?: string } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = options.code;
  }
}
