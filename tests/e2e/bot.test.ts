import {
  GITLAB_REPO_FIELD_NAME,
  GITLAB_USERNAME_FIELD_NAME,
  TASK_ASSIGN_MK_TEXT,
} from "../../src/bot/bot.ts";
import { assert } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import {
  afterAll,
  beforeAll,
  describe,
  it,
} from "https://deno.land/x/test_suite@v0.7.1/mod.ts";
import HttpClient from "../../src/http/http.ts";
import Recruitee from "../../src/recruitee/recruitee.ts";
import {
  Candidate,
  CandidateField,
  CandidateSingleLineField,
} from "../../src/recruitee/types.ts";
import Gitlab from "../../src/gitlab/gitlab.ts";
import { GitlabProject } from "../../src/gitlab/types.ts";
import Bot from "../../src/bot/bot.ts";

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
} = Deno.env.toObject();

const createCandidate = async (httpClient: HttpClient): Promise<number> => {
  const body = {
    candidate: {
      name: TEST_CANDIDATE_NAME,
      emails: [TEST_CANDIDATE_EMAIL],
      phones: [TEST_CANDIDATE_PHONE],
    },
    offers: [TEST_CANDIDATE_OFFER_ID],
  };

  const response = await httpClient.makeRequest<{ candidate: Candidate }>(
    `/${COMPANY_ID}/candidates`,
    {
      method: "POST",
      body,
    },
  );
  const id = response.candidate.id;
  await addTagToCandidate(httpClient, id);
  const fields = await getTestCandidateProfileFields(httpClient, id);
  await setTestProfileInformation(
    httpClient,
    id,
    { text: TEST_CANDIDATE_GITLAB_USER },
    fields.gitlabField,
  );
  await setTestProfileInformation(
    httpClient,
    id,
    { value: "TodoApi" },
    fields.homeworkField,
  );
  await addTaskToTestCandidate(httpClient, id, "Hausaufgabe");
  return id;
};

const addTagToCandidate = async (
  httpClient: HttpClient,
  candidateId: number,
) => {
  const body = {
    tag: "Bot-Test",
  };
  await httpClient.makeRequest<{ candidate: { id: number } }>(
    `/${COMPANY_ID}/candidates/${candidateId}/tags`,
    {
      method: "POST",
      body,
    },
  );
};

const getTestCandidateProfileFields = async (
  httpClient: HttpClient,
  candidateId: number,
): Promise<{
  gitlabField?: CandidateField;
  homeworkField?: CandidateField;
  repoField?: CandidateField;
}> => {
  const response = await httpClient.makeRequest<{ candidate: Candidate }>(
    `/${COMPANY_ID}/candidates/${candidateId}`,
    {},
  );
  const candidate = response.candidate;
  const gitlabField = candidate.fields.find(
    (field) => field.name === GITLAB_USERNAME_FIELD_NAME,
  );
  const homeworkField = candidate.fields.find(
    (field) => field.name === "Hausaufgabe",
  );
  const repoField = candidate.fields.find(
    (field) => field.name === GITLAB_REPO_FIELD_NAME,
  );
  return {
    gitlabField,
    homeworkField,
    repoField,
  };
};

const setTestProfileInformation = async (
  httpClient: HttpClient,
  candidateId: number,
  values: unknown,
  field?: CandidateField,
) => {
  if (!field) return;
  const body = {
    field: {
      ...field,
      values: [values],
    },
  };
  await httpClient.makeRequest<{ candidate: { id: number } }>(
    `/${COMPANY_ID}/custom_fields/candidates/${candidateId}/fields/`,
    {
      method: "POST",
      body,
    },
  );
};

const addTaskToTestCandidate = async (
  httpClient: HttpClient,
  candidateId: number,
  title: string,
) => {
  const body = {
    task: {
      candidate_id: candidateId,
      title,
    },
  };
  await httpClient.makeRequest<{ candidate: { id: number } }>(
    `/${COMPANY_ID}/tasks`,
    {
      method: "POST",
      body,
    },
  );
};

const getGitlabProjectIdByUrl = async (
  httpClient: HttpClient,
  projectUrl: string,
): Promise<GitlabProject | undefined> => {
  const projects = await httpClient.makeRequest<GitlabProject[]>(
    `/groups/${GITLAB_HOMEWORK_NAMESPACE}/projects`,
    {},
  );
  const project = projects.find((p) => p.web_url == projectUrl);
  return project;
};

const getHomeworkIssueId = async (
  httpClient: HttpClient,
  project: GitlabProject,
) => {
  const projectId = project.id;
  const issues = await httpClient.makeRequest<[{ title: string; iid: number }]>(
    `/projects/${projectId}/issues`,
    {},
  );
  const issue = issues.find((i) => i.title === "Hausaufgabe abschließen");
  return issue?.iid ?? 0;
};

const closeGitlabIssue = async (httpClient: HttpClient, projectUrl: string) => {
  const project = await getGitlabProjectIdByUrl(httpClient, projectUrl);
  if (!project) return;
  const projectId = project.id;
  const issueId = await getHomeworkIssueId(httpClient, project);
  await httpClient.makeRequest<{ candidate: { id: number } }>(
    `/projects/${projectId}/issues/${issueId}?state_event=close`,
    {
      method: "PUT",
    },
  );
};

const getTestCandidateTasks = async (
  httpClient: HttpClient,
  candidateId: number,
) => {
  const tasks = await httpClient.makeRequest<{ tasks: [{ title: string }] }>(
    `/${COMPANY_ID}/candidates/${candidateId}/tasks`,
    {},
  );
  return tasks;
};

const deleteCandidate = async (httpClient: HttpClient, candidateId: number) => {
  console.log(`Deleting Test-Candidate with id ${candidateId}`);
  await httpClient.makeRequest<{ candidate: { id: number } }>(
    `/${COMPANY_ID}/candidates/${candidateId}`,
    {
      method: "DELETE",
    },
  );
};

describe("End-to-end test for HT-Bewerbungsbot", () => {
  const recruiteeApiToken = RECRUITEE_TOKEN;
  const gitlabApiToken = GITLAB_TOKEN;
  const recruiteeBaseUrl = "https://api.recruitee.com/c";
  const gitlabBaseUrl = "https://gitlab.com/api/v4";
  const recruiteeHttpClient = new HttpClient(
    recruiteeBaseUrl,
    recruiteeApiToken,
  );
  const gitlabHttpClient = new HttpClient(gitlabBaseUrl, gitlabApiToken);
  const gitlab = new Gitlab(
    GITLAB_TOKEN,
    GITLAB_TEMPLATES_NAMESPACE,
    GITLAB_HOMEWORK_NAMESPACE,
  );
  const recruitee = new Recruitee(COMPANY_ID, RECRUITEE_TOKEN);
  const bot = new Bot(gitlab, recruitee, false, "Bot-Test");
  let id: number;

  beforeAll(async () => {
    id = await createCandidate(recruiteeHttpClient);
  });
  afterAll(async () => {
    await deleteCandidate(recruiteeHttpClient, id);
  });

  it("checks that a homework is forked and the 'GitLab Repository' field is correctly set", async () => {
    await bot.poll();
    const fields = await getTestCandidateProfileFields(recruiteeHttpClient, id);
    const repoField = fields.repoField;
    const gitlabRepo = (repoField as CandidateSingleLineField).values[0].text ??
      "";
    assert(gitlabRepo !== "");
  });

  it("checks that a task is added to the Recruitee profile", async () => {
    const fields = await getTestCandidateProfileFields(recruiteeHttpClient, id);
    const repoField = fields.repoField;
    const projectUrl = (repoField as CandidateSingleLineField).values[0].text ??
      "";
    await closeGitlabIssue(gitlabHttpClient, projectUrl);
    await bot.poll();
    const tasks = await (
      await getTestCandidateTasks(recruiteeHttpClient, id)
    ).tasks;
    const mkTask = tasks.find((t) => t.title == TASK_ASSIGN_MK_TEXT);
    assert(mkTask);
  });
});
