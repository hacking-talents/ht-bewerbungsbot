import { HttpRequestOptions } from "./../types.ts";
import { HttpError } from "./HttpError.ts";

export default class HttpClient {
  private baseUrl: string;
  private apiToken: string;

  constructor(baseUrl: string, apiToken: string) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
  }

  async makeRequest<T = unknown>(
    slug: string,
    options?: HttpRequestOptions,
  ): Promise<T> {
    let url = `${this.baseUrl}${slug}`;
    if (options?.queryParams) {
      url += `?${new URLSearchParams(options.queryParams).toString()}`;
    }

    const response = await fetch(url, {
      method: options?.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: options?.body ? JSON.stringify(options.body) : null,
    });

    if (!response.ok) {
      let body;
      if (response.body) {
        if (response.headers.get("Content-Type") === "application/json") {
          body = response.json();
        } else {
          body = response.text();
        }
      }

      throw new HttpError(response.status, body);
    }

    return response.body ? response.json() : undefined;
  }
}
