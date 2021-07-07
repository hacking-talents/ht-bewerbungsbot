export class HttpError extends Error {
  readonly statusCode: number;
  readonly body?: unknown;

  constructor(statusCode: number, body?: unknown) {
    super(
      `HTTP request failed with status code ${statusCode}: ${
        JSON.stringify(body)
      }`,
    );
    this.statusCode = statusCode;
    this.body = body;
  }
}
