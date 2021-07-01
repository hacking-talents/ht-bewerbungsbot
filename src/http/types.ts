export interface HttpRequestOptions<T = unknown> {
  method?: "POST" | "GET" | "DELETE" | "PATCH" | "PUT";
  queryParams?: Record<string, string>;
  body?: T;
}
