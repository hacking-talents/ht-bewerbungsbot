// deno-lint-ignore-file camelcase
import {
  assert,
  assertEquals,
  assertThrowsAsync,
} from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { Stub, stub } from "https://deno.land/x/mock@v0.9.5/mod.ts";
import { withMockedFetch } from "../http/http.test.ts";
import {
  gitlabIssueTemplate,
  GitlabIssueTemplateValues,
} from "./../messages.ts";
import Gitlab from "./gitlab.ts";
import { Branch, GitlabProject, ImportStatus, Issue, User } from "./types.ts";
import { GitlabError } from "./GitlabError.ts";

const gitlab = () =>
  new Gitlab("gitlabToken", "templateNamespace", "homeworkNamespace");

Deno.test("getHomeworkProject makes correct api call", async () => {
  await withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Gitlab.API_BASE_URL}/groups/templateNamespace/projects?search=b`,
      );
      assertEquals(init?.method, "GET");
      const body: GitlabProject[] = [
        {
          name: "a",
          id: "idA",
          web_url: "",
        },
        {
          name: "b",
          id: "idB",
          web_url: "",
        },
      ];
      return new Response(JSON.stringify(body));
    },
    async () => {
      const project = await gitlab().getHomeworkProject("b");
      assertEquals(project?.name, "b");
    },
  );
});

Deno.test("waitForForkFinish makes correct api call", async () => {
  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/projects/forkId/import`);
      assertEquals(init?.method, "GET");
      console.log(input);

      const body: ImportStatus = { import_status: "finished" };
      return new Response(JSON.stringify(body));
    },
    async () => {
      await gitlab().waitForForkFinish("forkId");
    },
  );
});

Deno.test("waitForForkFinish retries", async () => {
  let retryCount = 0;
  await withMockedFetch(
    () => {
      retryCount += 1;

      const body: ImportStatus = { import_status: "started" };
      return new Response(JSON.stringify(body));
    },
    async () => {
      await assertThrowsAsync(() => gitlab().waitForForkFinish("forkId"));
    },
  );

  assert(retryCount > 1);
});

Deno.test("waitForForkFinish resolves", async () => {
  let retryCount = 0;
  await withMockedFetch(
    () => {
      retryCount += 1;

      const body: ImportStatus = {
        import_status: retryCount > 5 ? "finished" : "started",
      };
      return new Response(JSON.stringify(body));
    },
    async () => {
      await gitlab().waitForForkFinish("forkId");
    },
  );
});

Deno.test("getBranches makes correct api call", async () => {
  await withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Gitlab.API_BASE_URL}/projects/id/repository/branches`,
      );
      assertEquals(init?.method, "GET");
      const body: Branch[] = [{ name: "main", protected: true, default: true }];
      return new Response(JSON.stringify(body));
    },
    async () => {
      const branches = await gitlab().getBranches({
        name: "name",
        id: "id",
        web_url: "",
      });
      assertEquals(branches, [
        {
          name: "main",
          protected: true,
          default: true,
        },
      ]);
    },
  );
});

Deno.test("addMaintainerToProject makes correct api call", async () => {
  await withMockedFetch(
    (_, init) => {
      assertEquals(
        init?.body,
        JSON.stringify({
          id: "projectId",
          user_id: "userId",
          access_level: 30,
          expires_at: "2000-02-01",
        }),
      );
      return new Response();
    },
    async () => {
      await gitlab().addMaintainerToProject(
        "projectId",
        "userId",
        new Date("2000-02-01"),
      );
    },
  );
});

Deno.test("forkProject makes a correct api call", async () => {
  const mockProject = {
    id: "projectId",
    name: "repoName",
    web_url: "",
  };
  const projectId = "projectId";
  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/projects/${projectId}/fork`);
      assertEquals(init?.method, "POST");
      return new Response(JSON.stringify(mockProject));
    },
    async () => {
      await gitlab().forkProject(projectId, "repoName");
    },
  );
});

Deno.test(
  "forkHomework forks a project, waits until finished and unprotects branches",
  async () => {
    const gitlabInstance = gitlab();
    const mockProject = {
      id: "projectId",
      name: "repoName",
      web_url: "",
    };
    const waitForForkFinishStub: Stub<Gitlab> = stub(
      gitlabInstance,
      "waitForForkFinish",
    );
    const unprotectAllBranchesStub: Stub<Gitlab> = stub(
      gitlabInstance,
      "unprotectAllBranches",
    );
    const forkProjectStub: Stub<Gitlab> = stub(gitlabInstance, "forkProject", [
      mockProject,
    ]);
    const homeworkFork = await gitlabInstance.forkHomework(
      "projectId",
      "repoName",
    );
    assertEquals(homeworkFork, mockProject);
    assert(
      waitForForkFinishStub.calls.length == 1,
      "waitForForkFinish has not been called exactly once",
    );
    assert(
      unprotectAllBranchesStub.calls.length == 1,
      "unprotectAllBranches has not been called exactly once",
    );
    assert(
      forkProjectStub.calls.length == 1,
      "forkProject has not been called exactly once",
    );
  },
);

Deno.test("forkHomework forks a project, but unprotect fails", async () => {
  const gitlabInstance = gitlab();
  const mockProject = {
    id: "projectId",
    name: "repoName",
    web_url: "",
  };
  const forkProjectStub: Stub<Gitlab> = stub(gitlabInstance, "forkProject", [
    mockProject,
  ]);
  const waitForForkFinishStub: Stub<Gitlab> = stub(
    gitlabInstance,
    "waitForForkFinish",
  );
  const unprotectAllBranchesStub: Stub<Gitlab> = stub(
    gitlabInstance,
    "unprotectAllBranches",
    () => {
      throw new Error();
    },
  );

  await assertThrowsAsync(
    async () => await gitlabInstance.forkHomework("projectId", "repoName"),
  );

  assertEquals(1, waitForForkFinishStub.calls.length);
  assertEquals(1, forkProjectStub.calls.length);
  assertEquals(1, unprotectAllBranchesStub.calls.length);
});

Deno.test("forkHomework forks a project but forkProject fails", async () => {
  const gitlabInstance = gitlab();
  const waitForForkFinishStub: Stub<Gitlab> = stub(
    gitlabInstance,
    "waitForForkFinish",
  );
  const unprotectAllBranchesStub: Stub<Gitlab> = stub(
    gitlabInstance,
    "unprotectAllBranches",
  );
  const forkProjectStub: Stub<Gitlab> = stub(gitlabInstance, "forkProject", [
    undefined,
  ]);
  await assertThrowsAsync(
    async () => await gitlabInstance.forkHomework("projectId", "repoName"),
  );
  assert(
    waitForForkFinishStub.calls.length == 0,
    "waitForForkFinish has been called",
  );
  assert(
    unprotectAllBranchesStub.calls.length == 0,
    "unprotectAllBranches has been called",
  );
  assert(
    forkProjectStub.calls.length == 1,
    "forkProject has not been called exactly once",
  );
});

Deno.test("unprotectBranch makes correct api call", async () => {
  await withMockedFetch(
    (input, init) => {
      assertEquals(
        input,
        `${Gitlab.API_BASE_URL}/projects/projectId/protected_branches/branchName`,
      );
      assertEquals(init?.method, "DELETE");
      return new Response();
    },
    async () => {
      await gitlab().unprotectBranch(
        { name: "projectName", id: "projectId", web_url: "" },
        { name: "branchName", protected: true, default: true },
      );
    },
  );
});

Deno.test(
  "unprotectAllBranches calls getBranches and unprotectBranches",
  async () => {
    const gitlabInstance = gitlab();
    const testProject: GitlabProject = {
      name: "test-project",
      id: "4122",
      web_url: "www.testurl.de",
    };
    const testBranch: Branch[] = [
      {
        name: "test-branch",
        protected: true,
        default: true,
      },
    ];
    const getBranchesStub: Stub<Gitlab> = stub(gitlabInstance, "getBranches", [
      testBranch,
    ]);
    const unprotectBranchStub: Stub<Gitlab> = stub(
      gitlabInstance,
      "unprotectBranch",
    );

    await gitlabInstance.unprotectAllBranches(testProject);

    assertEquals(1, getBranchesStub.calls.length);
    assertEquals(1, unprotectBranchStub.calls.length);
  },
);

Deno.test("deleteProject makes correct api call", async () => {
  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/projects/projectId`);
      assertEquals(init?.method, "DELETE");
      return new Response();
    },
    async () => {
      await gitlab().deleteProject("projectId");
    },
  );
});

Deno.test("getUser makes correct api call", async () => {
  const user1: User = {
    id: 1234,
    username: "username1",
    name: "",
  };
  const user2: User = {
    id: 1235,
    username: "username2",
    name: "",
  };
  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/users?username=Username2`);
      assertEquals(init?.method, "GET");
      return new Response(JSON.stringify([user1, user2]));
    },
    async () => {
      const response = await gitlab().getUser("Username2");
      assertEquals(response, user2);
    },
  );
});

Deno.test(
  "getUser with given username does not exist returns undefined",
  async () => {
    const notExistingUser = "IDontExist";
    await withMockedFetch(
      (input, init) => {
        assertEquals(
          input,
          `${Gitlab.API_BASE_URL}/users?username=${notExistingUser}`,
        );
        assertEquals(init?.method, "GET");
        return new Response(JSON.stringify([]));
      },
      async () => {
        await assertThrowsAsync(
          async () => {
            return await gitlab().getUser(notExistingUser);
          },
          GitlabError,
          `GitLab-User "${notExistingUser}" nicht gefunden.`,
        );
      },
    );
  },
);

Deno.test(
  "getUser there are two users with the same name, but returns only the first",
  async () => {
    const user1: User = {
      id: 1234,
      username: "username1",
      name: "",
    };
    const user2: User = {
      id: 1235,
      username: "username1",
      name: "",
    };
    await withMockedFetch(
      (input, init) => {
        assertEquals(input, `${Gitlab.API_BASE_URL}/users?username=Username1`);
        assertEquals(init?.method, "GET");
        return new Response(JSON.stringify([user1, user2]));
      },
      async () => {
        const response = await gitlab().getUser("Username1");
        assertEquals(response, user1);
      },
    );
  },
);

Deno.test("getOwnUserInfo makes correct api call", async () => {
  const ownUser: User = {
    id: 1234,
    username: "bewerbungsbot",
    name: "Bot de Bewerbung",
  };
  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/user`);
      assertEquals(init?.method, "GET");
      return new Response(JSON.stringify(ownUser));
    },
    async () => {
      const response = await gitlab().getOwnUserInfo();
      assertEquals(response, ownUser);
    },
  );
});

Deno.test("getOwnUserInfo gets nothing and returns Error", async () => {
  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/user`);
      assertEquals(init?.method, "GET");
      return new Response(undefined);
    },
    async () => {
      await assertThrowsAsync(() => gitlab().getOwnUserInfo());
    },
  );
});

Deno.test("createHomeworkIssue makes correct api call", async () => {
  const issueTemplateValues: GitlabIssueTemplateValues = {
    title: "title",
    applicantName: "name",
  };

  const issue: Issue = {
    title: "title",
    author: {
      id: 1,
      name: "",
      username: "",
    },
    assignee: {
      id: 1,
      name: "",
      username: "",
    },
    web_url: "",
  };

  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/projects/projectId/issues`);
      assertEquals(init?.method, "POST");
      assertEquals(
        init?.body,
        JSON.stringify({
          title: "title",
          description: gitlabIssueTemplate(issueTemplateValues),
          assignee_ids: "gitlabUserId",
          due_date: "2020-01-01",
        }),
      );
      return new Response(JSON.stringify(issue));
    },
    async () => {
      const response = await gitlab().createHomeworkIssue(
        "projectId",
        "gitlabUserId",
        new Date("2020-01-01"),
        issueTemplateValues,
      );
      assertEquals(response, issue);
    },
  );
});

Deno.test("getProjectIssues returns all issues of a project", async () => {
  const randomIssue: Issue = {
    title: "Know something",
    author: {
      id: 72,
      name: "Igritte",
      username: "redwildling",
    },
    assignee: {
      id: 13,
      name: "Jon Snow",
      username: "whitewolf",
    },
    web_url: "",
  };

  const homeworkIssue: Issue = {
    title: "Solve the given Task",
    author: {
      id: 42,
      name: "Bewerbungsbot",
      username: "bewerbungsbot",
    },
    assignee: {
      id: 23,
      name: "Sabine Wren",
      username: "futuretalent",
    },
    web_url: "",
  };

  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/projects/projectId/issues`);
      assertEquals(init?.method, "GET");
      return new Response(JSON.stringify([randomIssue, homeworkIssue]));
    },
    async () => {
      const response = await gitlab().getProjectIssues("projectId");
      assertEquals(response, [randomIssue, homeworkIssue]);
    },
  );
});

// TODO: "getProjectIssues also queries for author when given"

Deno.test("getProjectIssues can return no issues", async () => {
  await withMockedFetch(
    (input, init) => {
      assertEquals(input, `${Gitlab.API_BASE_URL}/projects/projectId/issues`);
      assertEquals(init?.method, "GET");
      return new Response(JSON.stringify([]));
    },
    async () => {
      const response = await gitlab().getProjectIssues("projectId");
      assertEquals(response, []);
    },
  );
});
