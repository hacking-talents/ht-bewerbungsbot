import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import {
  Candidate,
  CandidateSingleLineField,
  MinimalCandidate,
  Offer,
} from "./types.ts";
import { withMockedFetch } from "../http/http.test.ts";
import Recruitee, { ADDRESS_FIELD_NAME } from "./recruitee.ts";

function recruitee() {
  return new Recruitee("companyId", "apiToken");
}

function mockOffer(id: number): Offer {
  return {
    id,
    offer_tags: [],
    pipeline_template: {
      stages: [],
    },
  };
}

Deno.test("getAllCandidatesForOffers makes correct api call", () => {
  const candidates: MinimalCandidate[] = [
    {
      id: 345,
    },
    {
      id: 567,
    },
  ];

  withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Recruitee.BASE_URL}/companyId/candidates?qualified=true&offers=[123,1234]`,
      );
      assertEquals(init?.method, "GET");

      return new Response(JSON.stringify({
        candidates,
      }));
    },
    async () => {
      const r = recruitee();
      const offers: Offer[] = [mockOffer(123), mockOffer(1234)];
      const response = await r.getAllCandidatesForOffers(offers);

      assertEquals(response, candidates);
    },
  );
});

Deno.test("getCandidateSalutation gives name of candidate when no override salutation is specified", () => {
  const c: Candidate = {
    id: 123,
    emails: [],
    name: "Robert Nesta Marley",
    fields: [],
    placements: [],
    tags: [],
  };
  const actual = recruitee().getCandidateSalutation(c);

  assertEquals(actual, "Robert");
});

Deno.test("getCandidateSalutation gives override salutation if specified", () => {
  const salutationField: CandidateSingleLineField = {
    id: 123,
    kind: "single_line",
    name: ADDRESS_FIELD_NAME,
    values: [{
      text: "Bob",
    }],
  };
  const c: Candidate = {
    id: 123,
    emails: [],
    name: "Robert Nesta Marley",
    fields: [salutationField],
    placements: [],
    tags: [],
  };
  const actual = recruitee().getCandidateSalutation(c);

  assertEquals(actual, "Bob");
});
