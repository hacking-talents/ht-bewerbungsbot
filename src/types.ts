export type HttpRequestOptions<TBody> = {
  method?: "POST" | "GET" | "DELETE" | "PATCH" | "PUT";
  queryParams?: Record<string, string>;
  body?: TBody;
};
