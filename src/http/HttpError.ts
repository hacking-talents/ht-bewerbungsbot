export class HttpError extends Error {
  readonly statusCode: number;
  readonly body?: unknown;

  constructor(statusCode: number, body?: unknown) {
    const bodyContent = JSON.stringify(body);
    super(
      `HTTP request failed with status code ${statusCode}` +
        (body ? `: ${bodyContent}` : "."),
    );
    this.statusCode = statusCode;
    this.body = body;
  }
}
