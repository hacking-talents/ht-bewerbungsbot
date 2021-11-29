import {
  GITLAB_REPO_FIELD_NAME,
  GITLAB_USERNAME_FIELD_NAME,
  HOMEWORK_FIELD_NAME,
  TASK_ASSIGN_MK_TEXT,
} from "../../src/bot/bot.ts";
import {
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.100.0/testing/asserts.ts";
import {
  afterAll,
  beforeAll,
  describe,
  it,
} from "https://deno.land/x/test_suite@v0.7.1/mod.ts";
import Recruitee from "../../src/recruitee/recruitee.ts";
import {
  Candidate,
  CandidateDropdownField,
  CandidateSingleLineField,
} from "../../src/recruitee/types.ts";
import Gitlab from "../../src/gitlab/gitlab.ts";
import {
  isDropdownField,
  isSingleLineField,
} from "../../src/recruitee/tools.ts";
import { GitlabProject } from "../../src/gitlab/types.ts";
import Bot from "../../src/bot/bot.ts";
import Monitorer from "../../src/monitoring/monitorer.ts";

const E2E_CANDIDATE_TAG = "Bot-E2E-Test";

const {
  GITLAB_TOKEN,
  GITLAB_TEMPLATES_NAMESPACE,
  GITLAB_HOMEWORK_NAMESPACE,
  COMPANY_ID,
  RECRUITEE_TOKEN,
  TEST_CANDIDATE_NAME,
  TEST_CANDIDATE_EMAIL,
  TEST_CANDIDATE_PHONE,
  TEST_CANDIDATE_OFFER_ID,
  TEST_CANDIDATE_GITLAB_USER,
  TEST_HOMEWORK,
} = Deno.env.toObject();

class MockMonitorer implements Monitorer {
  async signalSuccess() {}
}

describe("End-to-end test for HT-Bewerbungsbot", () => {
  const gitlab = new Gitlab(
    GITLAB_TOKEN,
    GITLAB_TEMPLATES_NAMESPACE,
    GITLAB_HOMEWORK_NAMESPACE,
  );
  const recruitee = new Recruitee(COMPANY_ID, RECRUITEE_TOKEN);

  const mockMonitorer = new MockMonitorer();

  const bot = new Bot(
    gitlab,
    recruitee,
    mockMonitorer,
    false,
    E2E_CANDIDATE_TAG,
  );
  let candidateId: number;

  beforeAll(async () => {
    candidateId = await createCandidate(recruitee);
  });

  afterAll(async () => {
    await deleteCandidate(recruitee, candidateId).catch((err) =>
      console.error(
        "Candidate deletion failed. Please delete candidate manually.",
        err,
      )
    );
    await deleteGitLabProject(gitlab).catch((err) => {
      console.error(
        "Project deletion failed. Please delete project manually.",
        err,
      );
    });
  });

  it("checks that a homework is forked and the 'GitLab Repository' field is correctly set", async () => {
    await bot.poll();

    const candidate = await recruitee.getCandidateById(candidateId);
    const gitlabRepoUrl = getGitlabRepoFieldValueOrThrow(recruitee, candidate);
    assertNotEquals(gitlabRepoUrl, "");
  });

  it("checks that a task is added to the Recruitee profile", async () => {
    const candidate = await recruitee.getCandidateById(candidateId);
    const gitlabRepoUrl = getGitlabRepoFieldValueOrThrow(recruitee, candidate);

    await closeGitlabIssue(gitlab, gitlabRepoUrl);
    await bot.poll();

    const tasks = await getTestCandidateTasks(recruitee, candidateId);
    const mkTask = tasks.find((t) => t.title == TASK_ASSIGN_MK_TEXT);
    assertExists(mkTask);
  });
});

function getGitlabRepoFieldValueOrThrow(
  recruitee: Recruitee,
  candidate: Candidate,
): string {
  const field = recruitee.getProfileFieldByName(
    candidate,
    GITLAB_REPO_FIELD_NAME,
  );

  if (!field || !isSingleLineField(field)) {
    throw new Error(
      "expected gitlab repository field to be a single line field",
    );
  }

  return field.values[0].text;
}

function getGitlabUsernameFieldOrThrow(
  recruitee: Recruitee,
  candidate: Candidate,
): CandidateSingleLineField {
  const field = recruitee.getProfileFieldByName(
    candidate,
    GITLAB_USERNAME_FIELD_NAME,
  );

  if (!field || !isSingleLineField(field)) {
    throw new Error("expected gitlab username field to be a single line field");
  }

  return field;
}

function getHomeworkFieldOrThrow(
  recruitee: Recruitee,
  candidate: Candidate,
): CandidateDropdownField {
  const field = recruitee.getProfileFieldByName(candidate, HOMEWORK_FIELD_NAME);

  if (!field || !isDropdownField(field)) {
    throw new Error("expected homework field to be a dropdown field");
  }

  return field;
}

async function createCandidate(recruitee: Recruitee): Promise<number> {
  const body = {
    candidate: {
      name: TEST_CANDIDATE_NAME,
      emails: [TEST_CANDIDATE_EMAIL],
      phones: [TEST_CANDIDATE_PHONE],
    },
    offers: [TEST_CANDIDATE_OFFER_ID],
  };

  const { candidate } = await recruitee.makeRequest<{ candidate: Candidate }>(
    "/candidates",
    {
      method: "POST",
      body,
    },
  );

  await addTagToCandidate(recruitee, candidate.id);

  await recruitee.updateProfileField(
    candidate,
    getGitlabUsernameFieldOrThrow(recruitee, candidate),
    [TEST_CANDIDATE_GITLAB_USER],
  );

  await recruitee.updateProfileField(
    candidate,
    getHomeworkFieldOrThrow(recruitee, candidate),
    [TEST_HOMEWORK],
  );
  await addTaskToTestCandidate(recruitee, candidate.id, "Hausaufgabe");
  return candidate.id;
}

async function addTagToCandidate(recruitee: Recruitee, candidateId: number) {
  const body = {
    tag: E2E_CANDIDATE_TAG,
  };
  await recruitee.makeRequest<{ candidate: { id: number } }>(
    `/candidates/${candidateId}/tags`,
    {
      method: "POST",
      body,
    },
  );
}

async function addTaskToTestCandidate(
  recruitee: Recruitee,
  candidateId: number,
  title: string,
) {
  const body = {
    task: {
      candidate_id: candidateId,
      title,
    },
  };
  await recruitee.makeRequest<{ candidate: { id: number } }>("/tasks", {
    method: "POST",
    body,
  });
}

async function getGitlabProjectIdByUrl(
  gitlab: Gitlab,
  projectUrl: string,
): Promise<GitlabProject | undefined> {
  const projects = await gitlab.makeRequest<GitlabProject[]>(
    `/groups/${GITLAB_HOMEWORK_NAMESPACE}/projects`,
    {},
  );
  const project = projects.find((p) => p.web_url == projectUrl);
  return project;
}

async function getHomeworkIssueId(gitlab: Gitlab, project: GitlabProject) {
  const projectId = project.id;
  const issues = await gitlab.makeRequest<[{ title: string; iid: number }]>(
    `/projects/${projectId}/issues`,
    {},
  );
  const issue = issues.find((i) => i.title === "Hausaufgabe abschließen");
  return issue?.iid ?? 0;
}

async function closeGitlabIssue(gitlab: Gitlab, projectUrl: string) {
  const project = await getGitlabProjectIdByUrl(gitlab, projectUrl);
  if (!project) return;
  const projectId = project.id;
  const issueId = await getHomeworkIssueId(gitlab, project);
  await gitlab.makeRequest<{ candidate: { id: number } }>(
    `/projects/${projectId}/issues/${issueId}?state_event=close`,
    {
      method: "PUT",
    },
  );
}

async function getTestCandidateTasks(
  recruitee: Recruitee,
  candidateId: number,
) {
  const { tasks } = await recruitee.makeRequest<{ tasks: [{ title: string }] }>(
    `/candidates/${candidateId}/tasks`,
    {},
  );
  return tasks;
}

async function deleteGitLabProject(gitlab: Gitlab) {
  if (
    TEST_CANDIDATE_GITLAB_USER == "" ||
    TEST_CANDIDATE_GITLAB_USER == null ||
    TEST_CANDIDATE_GITLAB_USER == undefined
  ) {
    throw new Error(
      "GitLab test username is empty. You are sure that you want delete all projects?",
    );
  }
  const projects = await gitlab.getHomeworkProjects(TEST_CANDIDATE_GITLAB_USER);
  const projectsToDelete = projects.filter((projects) =>
    projects.name.toString().includes("homework-" + TEST_CANDIDATE_GITLAB_USER)
  );
  console.log(
    "Deleting Test-Project with name " +
      projectsToDelete.map((project) => project.name),
  );
  await Promise.all(
    projectsToDelete.map(async (project) => {
      await gitlab.deleteProject(project.id);
    }),
  );
}

async function deleteCandidate(recruitee: Recruitee, candidateId: number) {
  console.log(`Deleting Test-Candidate with id ${candidateId}`);
  await recruitee.makeRequest<{ candidate: { id: number } }>(
    `/candidates/${candidateId}`,
    {
      method: "DELETE",
    },
  );
}
