import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";

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
