import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import {
  Candidate,
  CandidateField,
  CandidateReference,
  CandidateSingleLineField,
  MinimalCandidate,
  Offer,
  Task,
  TaskDetails,
} from "./types.ts";
import { withMockedFetch } from "../http/http.test.ts";
import Recruitee, {
  ADDRESS_FIELD_NAME,
  DEFAULT_SIGNATURE,
  SIGNATURE_FIELD_NAME,
} from "./recruitee.ts";
import { SendHomeworkTemplateValues } from "../messages.ts";

function recruitee() {
  return new Recruitee("companyId", "apiToken");
}

Deno.test("getOffersWithTag returns correct offers", () => {
  const offers: Offer[] = [
    mockOffer(123, ["testTag", "Facility-Manager", "Human-Ressource"]),
    mockOffer(345, ["testTag", "Facility-Manager", "Human-Ressource"]),
    mockOffer(567, ["testTag", "Hotdog-Trader"]),
  ];

  withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Recruitee.BASE_URL}/companyId/offers`);
      assertEquals(init?.method, "GET");

      return new Response(
        JSON.stringify({
          offers,
        }),
      );
    },
    async () => {
      const r = recruitee();
      const response = await r.getOffersWithTag("Facility-Manager");

      assertEquals(response, offers.slice(0, 2));
    },
  );
});

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

      return new Response(
        JSON.stringify({
          candidates,
        }),
      );
    },
    async () => {
      const r = recruitee();
      const offers: Offer[] = [mockOffer(123), mockOffer(1234)];
      const response = await r.getAllCandidatesForOffers(offers);

      assertEquals(response, candidates);
    },
  );
});

Deno.test("getCandidateTasks returns correct tasks", () => {
  const candidateId = 345;
  const mockedTasks = [mockTask(1), mockTask(2)];

  withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Recruitee.BASE_URL}/companyId/candidates/${candidateId}/tasks`,
      );
      assertEquals(init?.method, "GET");

      return new Response(
        JSON.stringify({
          tasks: mockedTasks,
        }),
      );
    },
    async () => {
      const r = recruitee();
      const response = await r.getCandidateTasks(candidateId);

      assertEquals(response, mockedTasks);
    },
  );
});

Deno.test("getTaskDetails returns correct task details", () => {
  const taskId = 15;
  const mockedTask = mockTask(taskId);
  const mockedTaskDetails = mockTaskDetails(taskId);

  withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Recruitee.BASE_URL}/companyId/tasks/${mockedTask.id}`,
      );
      assertEquals(init?.method, "GET");

      return new Response(JSON.stringify(mockedTaskDetails));
    },
    async () => {
      const r = recruitee();
      const response = await r.getTaskDetails(mockedTask);

      assertEquals(response, mockedTaskDetails);
    },
  );
});

Deno.test("getCandidateById returns correct candidate", () => {
  const mockedCandidate = mockCandidate();
  const candidateId = mockedCandidate.id;

  withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Recruitee.BASE_URL}/companyId/candidates/${candidateId}`,
      );
      assertEquals(init?.method, "GET");

      return new Response(JSON.stringify({ candidate: mockedCandidate }));
    },
    async () => {
      const r = recruitee();
      const response = await r.getCandidateById(candidateId);

      assertEquals(response, mockedCandidate);
    },
  );
});

Deno.test("completeTask uses the correct URL and HTTP method", () => {
  const taskId = 5;

  withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Recruitee.BASE_URL}/companyId/tasks/${taskId}`);
      assertEquals(init?.method, "PUT");
      return new Response();
    },
    async () => {
      const r = recruitee();
      await r.completeTask(taskId);
    },
  );
});

Deno.test("addNoteToCandidate uses the correct URL and HTTP method", () => {
  const candidateId = 5;
  const note = "Eggs and Milk";

  withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Recruitee.BASE_URL}/companyId/candidates/${candidateId}/notes`,
      );
      assertEquals(init?.method, "POST");
      return new Response();
    },
    async () => {
      const r = recruitee();
      await r.addNoteToCandidate(candidateId, note);
    },
  );
});

Deno.test(
  "getCandidateSalutation gives name of candidate when no override salutation is specified",
  () => {
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
  },
);

Deno.test(
  "getCandidateSalutation gives override salutation if specified",
  () => {
    const salutationField: CandidateSingleLineField = {
      id: 123,
      kind: "single_line",
      name: ADDRESS_FIELD_NAME,
      values: [
        {
          text: "Bob",
        },
      ],
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
  },
);

Deno.test("sendMailToCandidate uses the correct URL and HTTP method", () => {
  const candidateId = 5;
  const email = "peterle@sipgate.de";
  const subject = "Application";
  const sendHomeworkTemplate = mockSendHomeworkTemplateValues();
  withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Recruitee.BASE_URL}/companyId/mailbox/send`);
      assertEquals(init?.method, "POST");
      return new Response();
    },
    async () => {
      const r = recruitee();
      await r.sendMailToCandidate(
        candidateId,
        email,
        subject,
        sendHomeworkTemplate,
      );
    },
  );
});

Deno.test(
  "updateProfileFieldSingleLine adds a new line and uses the correct URL and HTTP method",
  () => {
    const mockedCandidate = mockCandidate();
    const candidateId = mockedCandidate.id;
    const mockedCandidateSingleLineField = mockCandidateSingleLineField(null, [
      "Homework",
    ]);
    const content = ["Swapgate"];

    withMockedFetch(
      (input, init) => {
        assertEquals(
          input,
          `${Recruitee.BASE_URL}/companyId/custom_fields/candidates/${candidateId}/fields`,
        );
        assertEquals(init?.method, "POST");
        return new Response();
      },
      async () => {
        const r = recruitee();
        await r.updateProfileFieldSingleLine(
          mockedCandidate,
          mockedCandidateSingleLineField,
          content,
        );
      },
    );
  },
);

Deno.test(
  "updateProfileFieldSingleLine adds a new line and uses the correct URL and HTTP method",
  () => {
    const mockedCandidate = mockCandidate();
    const candidateId = mockedCandidate.id;
    const mockedCandidateSingleLineField = mockCandidateSingleLineField(123, [
      "Homework",
    ]);
    const content = ["Swapgate"];

    withMockedFetch(
      (input, init) => {
        assertEquals(
          input,
          `${Recruitee.BASE_URL}/companyId/custom_fields/candidates/${candidateId}/fields/${mockedCandidateSingleLineField.id}`,
        );
        assertEquals(init?.method, "PATCH");
        return new Response();
      },
      async () => {
        const r = recruitee();
        await r.updateProfileFieldSingleLine(
          mockedCandidate,
          mockedCandidateSingleLineField,
          content,
        );
      },
    );
  },
);

Deno.test(
  "getSignature returns default signature when no assignees are specified",
  () => {
    const c: Candidate = {
      id: 123,
      emails: [],
      name: "",
      fields: [],
      placements: [],
      tags: [],
    };
    const actual = recruitee().getSignature(c, []);
    assertEquals(actual, DEFAULT_SIGNATURE);
  },
);

Deno.test("getSignature returns override signature when specified", () => {
  const field: CandidateSingleLineField = {
    id: 123,
    kind: "single_line",
    name: SIGNATURE_FIELD_NAME,
    values: [
      {
        text: "Override",
      },
    ],
  };
  const c: Candidate = {
    id: 123,
    emails: [],
    name: "",
    fields: [field],
    placements: [],
    tags: [],
  };
  const actual = recruitee().getSignature(c, []);
  assertEquals(actual, "Override von den hacking talents");
});

Deno.test("getSignature returns a name when one assignee is specified", () => {
  const c = mockCandidate();
  const actual = recruitee().getSignature(c, [mockAssignee("Bob")]);

  assertEquals(actual, "Bob von den hacking talents");
});

Deno.test(
  "getSignature returns concatenated names when two assignees are specified",
  () => {
    const c = mockCandidate();
    const actual = recruitee().getSignature(c, [
      mockAssignee("Anna"),
      mockAssignee("Bob"),
    ]);

    assertEquals(actual, "Anna und Bob von den hacking talents");
  },
);

Deno.test(
  "getSignature returns concatenated names when more than two assignees are specified",
  () => {
    const c = mockCandidate();
    const actual = recruitee().getSignature(c, [
      mockAssignee("Bob"),
      mockAssignee("Anna"),
      mockAssignee("Chris"),
    ]);

    assertEquals(actual, "Anna, Bob und Chris von den hacking talents");
  },
);

function mockAssignee(firstName: string): CandidateReference {
  return {
    type: "Admin",
    first_name: firstName,
  };
}

function mockCandidate(): Candidate {
  return {
    id: 123,
    emails: [],
    name: "",
    fields: [],
    placements: [],
    tags: [],
  };
}

function mockOffer(id: number, tags: string[] = []): Offer {
  return {
    id,
    offer_tags: tags,
    pipeline_template: {
      stages: [],
    },
  };
}

function mockTask(id: number): Task {
  return {
    id: id,
    completed: false,
    title: "",
    due_date: "",
    created_at: "",
    references: [],
  };
}

function mockTaskDetails(id: number): TaskDetails {
  return {
    references: [],
    task: mockTask(id),
  };
}

function mockSendHomeworkTemplateValues(): SendHomeworkTemplateValues {
  return {
    applicantName: "",
    mk_signature: "",
    projectUrl: "",
    issueUrl: "",
    homeworkDueDate: new Date(),
  };
}

function mockCandidateField(id: number | null): CandidateField {
  return {
    name: "",
    id: id,
    kind: "single_line",
  };
}

function mockCandidateSingleLineField(
  id: number | null,
  values: string[],
): CandidateSingleLineField {
  return {
    ...mockCandidateField(id),
    kind: "single_line",
    values: values.map((value) => {
      return { text: value };
    }),
  };
}
