import { assertEquals, assertThrowsAsync } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import HttpClient from "./http.ts";

export async function withMockedFetch(
  response: Response,
  f: () => Promise<void>,
) {
  const nativeFetch = window.fetch;
  window.fetch = () => Promise.resolve(response);

  await f();

  window.fetch = nativeFetch;
}

Deno.test("global fetch function can be mocked", () => {
  withMockedFetch(
    new Response("testing"),
    async () => {
      const response = await fetch("url");
      const body = await response.text();
      assertEquals(body, "testing");
    },
  );
});

Deno.test("http client returns success response", () => {
  withMockedFetch(new Response(JSON.stringify({ state: "success" })), async () => {
    const httpClient = new HttpClient("baseUrl", "token");
    const response = await httpClient.makeRequest<{ state: string }>("/");
    assertEquals(response.state, "success");
  });
});

Deno.test("http client throws error on unexpected status code", () => {
  withMockedFetch(new Response("", { status: 400, statusText: "Bad Request" }), async () => {
    const httpClient = new HttpClient("baseUrl", "token");
    await assertThrowsAsync(() => httpClient.makeRequest<{ state: string }>("/"), Error, "unexpected status code 400");
  });
});