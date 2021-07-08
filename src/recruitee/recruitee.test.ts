import {
  assert,
  assertEquals,
  assertThrowsAsync,
} from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { Stub, stub } from "https://deno.land/x/mock@v0.9.5/mod.ts";
import {
  Candidate,
  CandidateField,
  CandidateReference,
  CandidateSingleLineField,
  MinimalCandidate,
  Offer,
  Placement,
  StageDetail,
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
    mockOffer(123, "1", ["testTag", "Facility-Manager", "Human-Ressource"]),
    mockOffer(345, "2", ["testTag", "Facility-Manager", "Human-Ressource"]),
    mockOffer(567, "3", ["testTag", "Hotdog-Trader"]),
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
      const offers: Offer[] = [mockOffer(123, "1"), mockOffer(1234, "2")];
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
  "updateProfileFieldSingleLine adds a new line and uses the correct URL and HTTP method when no fields are provided",
  () => {
    const mockedCandidate = mockCandidate();
    const candidateId = mockedCandidate.id;
    const mockedCandidateSingleLineField = mockCandidateSingleLineField(
      123,
      [],
    );
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

Deno.test("clearProfileField uses the correct URL and HTTP method", () => {
  const mockedCandidate = mockCandidate();
  const candidateId = mockedCandidate.id;
  const mockedCandidateField = mockCandidateField(125);

  withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Recruitee.BASE_URL}/companyId/custom_fields/candidates/${candidateId}/fields/${mockedCandidateField.id}`,
      );
      assertEquals(init?.method, "DELETE");
      return new Response();
    },
    async () => {
      const r = recruitee();
      await r.clearProfileField(mockedCandidate, mockedCandidateField);
    },
  );
});

Deno.test("clearProfileField throws an exception when no candidate field with a valid id was provided", () => {
  const mockedCandidate = mockCandidate();
  const candidateId = mockedCandidate.id;
  const mockedCandidateField = mockCandidateField(undefined);
  console.log(mockedCandidateField);

  withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Recruitee.BASE_URL}/companyId/custom_fields/candidates/${candidateId}/fields/${mockedCandidateField.id}`,
      );
      assertEquals(init?.method, "DELETE");
      return new Response();
    },
    async () => {
      await assertThrowsAsync(async () => {
        await recruitee().clearProfileField(
          mockedCandidate,
          mockedCandidateField,
        );
      });
    },
  );
});

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

Deno.test(
  "proceedCandidateToStage uses the correct URL and HTTP method",
  () => {
    const mockedCandidate = mockCandidate();
    mockedCandidate.placements = [mockPlacement(7)];
    const nextStage = "Invited to interview";
    const stageId = 535;

    withMockedFetch(
      (input, init) => {
        assertEquals(
          input,
          `${Recruitee.BASE_URL}/companyId/placements/${
            mockedCandidate.placements[0].id
          }/change_stage?stage_id=${stageId}&proceed=true`,
        );
        assertEquals(init?.method, "PATCH");
        return new Response();
      },
      async () => {
        const recruiteeInstance = recruitee();
        stub(recruiteeInstance, "getStageByName", () => ({ id: stageId }));
        await recruiteeInstance.proceedCandidateToStage(
          mockedCandidate,
          nextStage,
        );
      },
    );
  },
);

Deno.test(
  "getProfileFieldByName returns the correct CandidateField",
  () => {
    const fieldName = "bar";
    const candidate = mockCandidate();
    candidate.fields = [
      {
        name: "foo",
        id: 123,
        kind: "boolean",
      },
      {
        name: fieldName,
        id: 345,
        kind: "boolean",
      },
    ];
    const candidateField = recruitee().getProfileFieldByName(
      candidate,
      fieldName,
    );
    assertEquals(candidateField?.id, 345);
  },
);

Deno.test(
  "getProfileFieldByName returns undefined when no field with the appropriate fieldName exists",
  () => {
    const fieldName = "baz";
    const candidate = mockCandidate();
    candidate.fields = [
      {
        name: "foo",
        id: 123,
        kind: "boolean",
      },
      {
        name: "bar",
        id: 345,
        kind: "boolean",
      },
    ];
    const candidateField = recruitee().getProfileFieldByName(
      candidate,
      fieldName,
    );
    assertEquals(candidateField, undefined);
  },
);

Deno.test("getStageByName returns correct stages", () => {
  const stageName = "Homework sent";
  const offerId = 13212;

  const mockedOffers = [
    mockOffer(
      offerId,
      "1",
      ["Fachinformatiker"],
      [
        { id: 5, name: stageName },
        { id: 7, name: "Invited to interview" },
        { id: 8, name: "Quatsch" },
      ],
    ),
    mockOffer(
      70973,
      "2",
      ["Fachinformatiker"],
      [{ id: 7, name: "Invited to interview" }],
    ),
    mockOffer(
      546345734,
      "3",
      ["Fachinformatiker"],
      [
        { id: 5, name: stageName },
        { id: 7, name: "Invited to interview" },
      ],
    ),
  ];

  withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Recruitee.BASE_URL}/companyId/offers?scope=not_archived&view_mode=default`,
      );
      assertEquals(init?.method, "GET");
      return new Response(
        JSON.stringify({
          offers: mockedOffers,
        }),
      );
    },
    async () => {
      const r = recruitee();
      const actual = await r.getStageByName(stageName, offerId);
      assertEquals(actual, { id: 5, name: "Homework sent" });
    },
  );
});

Deno.test(
  "getAllQualifiedCandidates returns a list of qualified candidates",
  async () => {
    const minimalCandidates = [{ id: 123 }, { id: 345 }, { id: 567 }];
    const expectedCandidates = minimalCandidates.map((item) =>
      mockCandidate(item.id)
    );
    const recruiteeInstance = recruitee();
    const getOffersWithTagStub: Stub<Recruitee> = stub(
      recruiteeInstance,
      "getOffersWithTag",
      [[mockOffer(123, "1")]],
    );
    const getAllCandidatesForOffersStub: Stub<Recruitee> = stub(
      recruiteeInstance,
      "getAllCandidatesForOffers",
      [minimalCandidates],
    );
    const getCandidateByIdStub: Stub<Recruitee> = stub(
      recruiteeInstance,
      "getCandidateById",
      (id) => mockCandidate(id),
    );

    const candidates = await recruiteeInstance.getAllQualifiedCandidates();
    assertEquals(candidates, expectedCandidates);
    assert(
      getOffersWithTagStub.calls.length == 1,
      "getOffersWithTag has not been called",
    );
    assert(
      getAllCandidatesForOffersStub.calls.length == 1,
      "getAllCandidatesForOffersStub has not been called",
    );
    assert(
      getCandidateByIdStub.calls.length == minimalCandidates.length,
      "getCandidateByIdStub has not been called",
    );
  },
);

function mockAssignee(firstName: string): CandidateReference {
  return {
    type: "Admin",
    first_name: firstName,
  };
}

function mockCandidate(id = 123): Candidate {
  return {
    id,
    emails: [],
    name: "",
    fields: [],
    placements: [],
    tags: [],
  };
}

function mockPlacement(id: number): Placement {
  return {
    candidate_id: 123,
    id: id,
    stage_id: 36345,
    disqualify_reason: "",
    offer_id: 7646574,
  };
}

function mockOffer(
  id: number,
  title: string,
  tags: string[] = [],
  stages: StageDetail[] = [],
): Offer {
  return {
    id,
    title,
    offer_tags: tags,
    pipeline_template: {
      stages: stages,
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

function mockCandidateField(id: number | null | undefined): CandidateField {
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
