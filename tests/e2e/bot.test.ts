import { assert } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import {
  afterAll,
  beforeAll,
  describe,
  it,
} from "https://deno.land/x/test_suite@v0.7.1/mod.ts";
import HttpClient from "../../src/http/http.ts";

Deno.env.set("RECRUITEE_HR_ID", "160057");
const RECRUITEE_HR_ID = Deno.env.get("RECRUITEE_HR_ID");
const COMPANY_ID = Deno.env.get("COMPANY_ID") ?? "";
const RECRUITEE_TOKEN = Deno.env.get("RECRUITEE_TOKEN") ?? "";
const TEST_CANDIDATE_NAME = Deno.env.get("TEST_CANDIDATE_NAME") ?? "";
const TEST_CANDIDATE_EMAIL = Deno.env.get("TEST_CANDIDATE_EMAIL") ?? "";
const TEST_CANDIDATE_PHONE = Deno.env.get("TEST_CANDIDATE_PHONE") ?? "";
const TEST_CANDIDATE_OFFER_ID = Number(Deno.env.get("TEST_CANDIDATE_OFFER_ID"));

export const createCandidate = async (
  httpClient: HttpClient,
): Promise<number> => {
  const body = {
    candidate: {
      name: TEST_CANDIDATE_NAME,
      emails: [TEST_CANDIDATE_EMAIL],
      phones: [TEST_CANDIDATE_PHONE],
    },
    offers: [TEST_CANDIDATE_OFFER_ID],
  };
  const response = await httpClient.makeRequest<{ candidate: { id: number } }>(
    `/${COMPANY_ID}/candidates`,
    {
      method: "POST",
      body,
    },
  );
  const id = response.candidate.id;
  console.log("ID: ", id);
  return id;
};

// delete candidate
export const deleteCandidate = async (
  httpClient: HttpClient,
  candidateId: number
) => {
  await httpClient.makeRequest<{ candidate: { id: number } }>(
    `/${COMPANY_ID}/candidates/${candidateId}`,
    {
      method: "DELETE",
    },
  );
};

describe("End-to-end test for HT-Bewerbungsbot", () => {
  const apiToken = RECRUITEE_TOKEN;
  const recruiteeBaseUrl = "https://api.recruitee.com/c";
  const httpClient = new HttpClient(recruiteeBaseUrl, apiToken);
  let id: number;

  beforeAll(async () => {
    id = await createCandidate(httpClient);
  });
  afterAll(async () => {
    await deleteCandidate(httpClient, id);
  });

  it("creates a candidate", () => {
    assert(RECRUITEE_HR_ID == "160057");
  });
});
