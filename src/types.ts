export type HttpRequestOptions = {
  method?: "POST" | "GET" | "DELETE" | "PATCH" | "PUT";
  queryParams?: Record<string, string>;
  // FIXME? specify body type
  // deno-lint-ignore no-explicit-any
  body?: any;
};
