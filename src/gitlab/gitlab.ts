import { gitlabIssueTemplate, GitlabIssueTemplateValues } from "../messages.ts";
import {
  Branch,
  GitlabProject as GitlabProject,
  ImportStatus,
  Issue,
  User,
} from "./types.ts";
import HttpClient from "../http/http.ts";
import { dateToISO } from "../tools.ts";

export default class Gitlab extends HttpClient {
  public static BASE_URL = "https://gitlab.com/api/v4";

  private templateNamespace: string;
  private homeworkNamespace: string;

  constructor(
    apiToken: string,
    templateNamespace: string,
    homeworkNamespace: string,
  ) {
    super(Gitlab.BASE_URL, apiToken);

    this.templateNamespace = templateNamespace;
    this.homeworkNamespace = homeworkNamespace;
  }

  async getHomeworkProject(name: string): Promise<GitlabProject | undefined> {
    const queryParams = {
      search: name,
    };
    const projects = await this.makeRequest<GitlabProject[]>(
      `/groups/${this.templateNamespace}/projects`,
      {
        queryParams,
      },
    );

    return projects.find((p) => p.name === name);
  }

  async forkProject(
    homeworkProjectId: string,
    repoName: string
  ): Promise<GitlabProject> {
    const body = {
      // deno-lint-ignore camelcase
      namespace_id: this.homeworkNamespace,
      name: repoName,
      path: repoName,
    };
    return this.makeRequest<GitlabProject>(
      `/projects/${homeworkProjectId}/fork`,
      { method: "POST", body }
    );
  }

  async waitForForkFinish(homeworkForkId: string): Promise<void> {
    console.log("[Gitlab] Forking project...");

    let importStatus = "";
    let retryCount = 100;
    while (importStatus !== "finished") {
      const importStatusResponse = await this.makeRequest<ImportStatus>(
        `/projects/${homeworkForkId}/import`,
      );
      importStatus = importStatusResponse["import_status"];
      if (importStatus === "failed" || --retryCount === 0) {
        throw new Error(`[Gitlab] Fork import failed`);
      }
    }
    console.log("[Gitlab] Project successfully forked");
  }

  async forkHomework(
    homeworkProjectId: string,
    repoName: string,
  ): Promise<GitlabProject> {
    const homeworkFork = await this.forkProject(homeworkProjectId, repoName);

    if (!homeworkFork) throw Error("Failed to fork project.");

    await this.waitForForkFinish(homeworkFork.id);

    try {
      await this.unprotectAllBranches(homeworkFork);
    } catch (e) {
      console.log(e);
    }
    console.warn("[Gitlab] Successfully unprotected branches");

    console.log(
      `[Gitlab] Forked Git Repo with id ${homeworkProjectId} as \"${repoName}\"`,
    );

    return homeworkFork;
  }

  async getBranches(project: GitlabProject): Promise<Branch[]> {
    return await this.makeRequest(
      `/projects/${project.id}/repository/branches`,
    );
  }

  async unprotectBranch(project: GitlabProject, branch: Branch) {
    await this.makeRequest(
      `/projects/${project.id}/protected_branches/${branch.name}`,
      {
        method: "DELETE",
      },
    );
    console.log(`[Gitlab] Unprotected branch \"${branch.name}\"`);
  }

  async unprotectAllBranches(project: GitlabProject) {
    const branches = await this.getBranches(project);

    await Promise.all(
      branches.map(async (branch) => {
        await this.unprotectBranch(project, branch);
      }),
    );
  }

  async deleteProject(id: string) {
    await this.makeRequest(`/projects/${id}`, {
      method: "DELETE",
    });

    console.log(`[Gitlab] Deleted project with id ${id}`);
  }

  async addMaintainerToProject(
    projectId: string,
    userId: string,
    expirationDate: Date,
  ): Promise<void> {
    const body = {
      id: projectId,
      // deno-lint-ignore camelcase
      user_id: userId,
      // deno-lint-ignore camelcase
      access_level: 30, // 30 = Developer
      // deno-lint-ignore camelcase
      expires_at: dateToISO(expirationDate),
    };
    await this.makeRequest(`/projects/${projectId}/members`, {
      method: "POST",
      body,
    });

    console.log(
      `[Gitlab] Added user with id ${userId} to Repo with id ${projectId}`,
    );
  }

  async getUser(username: string): Promise<User | undefined> {
    const users = await this.makeRequest<User[]>("/users", {
      queryParams: { username },
    });

    if (users.length == 0) {
      return undefined;
    }

    const user = users.find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );

    if (user) {
      console.log(`[Gitlab] Found User ${user.username} with id ${user.id}`);
    } else {
      console.warn(`[Gitlab] Cannot find user with username ${username}`);
    }

    return user;
  }

  async createHomeworkIssue(
    projectId: string,
    gitlabUserId: string,
    dueDate: Date,
    gitlabIssueTemplateValues: GitlabIssueTemplateValues,
  ): Promise<Issue> {
    const issueTemplate = gitlabIssueTemplate(gitlabIssueTemplateValues);
    const body = {
      title: gitlabIssueTemplateValues.title,
      description: issueTemplate,
      // deno-lint-ignore camelcase
      assignee_ids: gitlabUserId,
      // deno-lint-ignore camelcase
      due_date: dateToISO(dueDate),
    };

    const issue = await this.makeRequest<Issue>(
      `/projects/${projectId}/issues`,
      {
        method: "POST",
        body,
      },
    );

    console.log(
      `[Gitlab] Created Issue \"${issue.title}\" with assignee ${issue.assignee.username}`,
    );

    return issue;
  }
}
