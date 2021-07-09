// deno-lint-ignore-file camelcase
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
import { GitlabError } from "./GitlabError.ts";
import { EmojiErrorCodes } from "../errormojis.ts";

export default class Gitlab extends HttpClient {
  public static API_BASE_URL = "https://gitlab.com/api/v4";

  private templateNamespace: string;
  private homeworkNamespace: string;

  constructor(
    apiToken: string,
    templateNamespace: string,
    homeworkNamespace: string,
  ) {
    super(Gitlab.API_BASE_URL, apiToken);

    this.templateNamespace = templateNamespace;
    this.homeworkNamespace = homeworkNamespace;
  }

  async getHomeworkProject(name: string): Promise<GitlabProject> {
    const queryParams = {
      search: name,
    };
    const projects = await this.makeRequest<GitlabProject[]>(
      `/groups/${this.templateNamespace}/projects`,
      {
        queryParams,
      },
    );

    const project = projects.find((p) => p.name === name);

    if (!project) {
      throw new GitlabError(
        `${EmojiErrorCodes.PROJECT_NOT_FOUND} Die Hausaufgabe \"${name}\" konnte nicht gefunden werden.`,
      );
    }

    return project;
  }

  async forkProject(
    homeworkProjectId: string,
    repoName: string,
  ): Promise<GitlabProject> {
    const body = {
      namespace_id: this.homeworkNamespace,
      name: repoName,
      path: repoName,
    };
    return await this.makeRequest<GitlabProject>(
      `/projects/${homeworkProjectId}/fork`,
      { method: "POST", body },
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
        throw new GitlabError(
          `${EmojiErrorCodes.FORK_FAILED} Das Repository konnte nicht geforkt werden. Status: \"${importStatus}\"`,
        );
      }
    }
    console.log("[Gitlab] Project successfully forked");
  }

  async forkHomework(
    homeworkProjectId: string,
    repoName: string,
  ): Promise<GitlabProject> {
    const homeworkFork = await this.forkProject(homeworkProjectId, repoName);

    await this.waitForForkFinish(homeworkFork.id);

    await this.unprotectAllBranches(homeworkFork);

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

    console.warn("[Gitlab] Successfully unprotected branches");
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
      user_id: userId,
      access_level: 30, // 30 = Developer
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

  async getUser(username: string): Promise<User> {
    const users = await this.makeRequest<User[]>("/users", {
      queryParams: { username },
    });

    const user = users.find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );

    if (!user) {
      throw new GitlabError(
        `${EmojiErrorCodes.USER_NOT_FOUND} GitLab-User \"${username}\" nicht gefunden.`,
      );
    }

    console.log(`[Gitlab] Found User ${user.username} with id ${user.id}`);

    return user;
  }

  async getOwnUserInfo(): Promise<User> {
    const userInfo = await this.makeRequest<User>("/user");

    if (!userInfo) {
      throw new GitlabError(
        `${EmojiErrorCodes.USER_NOT_FOUND} Eigene GitLab Profilinformationen nicht gefunden.`,
      );
    }
    return userInfo;
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
      assignee_ids: gitlabUserId,
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

  async getProjectIssues(projectId: string, author?: User): Promise<Issue[]> {
    const queryParams = author
      ? { author_id: author.id.toString() }
      : undefined;

    const issues = await this.makeRequest<Issue[]>(
      `/projects/${projectId}/issues`,
      {
        method: "GET",
        queryParams,
      },
    );

    console.log(
      `[Gitlab] found ${issues.length} issues${
        author ? " with author" + author.username : ""
      } in project ${projectId}`,
    );

    return issues;
  }
}
