import { HttpRequestOptions } from "./../types.ts";

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
      console.warn(
        `[HttpClient] Network request failed with status ${response.status} ${response.statusText}`,
      );
      console.warn(`[HttpClient] ${options?.method || "GET"} URL: ${url}`);
      console.warn(`[HttpClient] response: ${await response.text()}`);
      throw new Error(
        `unexpected status code ${response.status} ${response.statusText}`,
      );
    }

    return response.body ? response.json() : undefined;
  }
}
