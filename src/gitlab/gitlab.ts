// deno-lint-ignore-file camelcase
import { gitlabIssueTemplate, GitlabIssueTemplateValues } from "../messages.ts";
import {
  AddMaintainerToProjectBody,
  Branch,
  CreateHomeworkIssueBody,
  ForkProjectBody,
  GitlabProject as GitlabProject,
  ImportStatus,
  Issue,
  User,
} from "./types.ts";
import HttpClient from "../http/http.ts";
import { dateToISO } from "../tools.ts";
import { GitlabError } from "./GitlabError.ts";
import { EmojiErrorCodes } from "../errormojis.ts";

const GITLAB_ACCESS_LEVEL_DEVELOPER = 30;
const SOLUTION_BRANCH_NAME = "solution";

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

  async searchAllProjectsByName(
    name: string,
    namespaceID: string,
  ): Promise<GitlabProject[]> {
    const queryParams = {
      search: name,
    };
    const projects = await this.makeRequest<GitlabProject[]>(
      `/groups/${namespaceID}/projects`,
      {
        queryParams,
      },
    );
    return projects;
  }

  async getProject(name: string, namespaceID: string): Promise<GitlabProject> {
    const queryParams = {
      search: name,
    };
    const projects = await this.makeRequest<GitlabProject[]>(
      `/groups/${namespaceID}/projects`,
      {
        queryParams,
      },
    );

    const project = projects.find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );

    if (!project) {
      throw new GitlabError(
        `${EmojiErrorCodes.PROJECT_NOT_FOUND} Die Hausaufgabe \"${name}\" konnte nicht gefunden werden.`,
      );
    }
    return project;
  }

  async getTemplateProject(name: string) {
    return await this.getProject(name, this.templateNamespace);
  }

  async getHomeworkProject(name: string) {
    return await this.getProject(name, this.homeworkNamespace);
  }

  async getHomeworkProjects(name: string) {
    return await this.searchAllProjectsByName(name, this.homeworkNamespace);
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
    return await this.makeRequest<GitlabProject, ForkProjectBody>(
      `/projects/${homeworkProjectId}/fork`,
      { method: "POST", body },
    );
  }

  async waitForForkFinish(homeworkForkId: string): Promise<void> {
    console.log("[GitLab] Forking project...");

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
    console.log("[GitLab] Project successfully forked");
  }

  async forkHomework(
    homeworkProjectId: string,
    repoName: string,
  ): Promise<GitlabProject> {
    const homeworkFork = await this.forkProject(homeworkProjectId, repoName);

    await this.waitForForkFinish(homeworkFork.id);
    await this.deleteSolutionBranch(homeworkFork);
    await this.unprotectAllBranches(homeworkFork);

    console.log(
      `[GitLab] Forked Git Repo with id ${homeworkProjectId} as \"${repoName}\"`,
    );

    return homeworkFork;
  }

  async getBranches(project: GitlabProject): Promise<Branch[]> {
    return await this.makeRequest(
      `/projects/${project.id}/repository/branches`,
    );
  }

  async deleteBranch(project: GitlabProject, branchName: string) {
    const path = `/projects/${project.id}/repository/branches/${branchName}`;
    await this.makeRequest(path, { method: "DELETE" });

    console.log(
      `[GitLab] Deleted branch "${branchName}" of repository ${project.id}`,
    );
  }

  async unprotectBranch(project: GitlabProject, branch: Branch) {
    await this.makeRequest(
      `/projects/${project.id}/protected_branches/${branch.name}`,
      {
        method: "DELETE",
      },
    );
    console.log(`[GitLab] Unprotected branch \"${branch.name}\"`);
  }

  async deleteSolutionBranch(project: GitlabProject) {
    const branches = await this.getBranches(project);
    const hasSolutionBranch = branches.some(
      (branch) => branch.name === SOLUTION_BRANCH_NAME,
    );
    if (hasSolutionBranch) {
      await this.deleteBranch(project, SOLUTION_BRANCH_NAME);
    }
  }

  async unprotectAllBranches(project: GitlabProject) {
    const branches = await this.getBranches(project);

    await Promise.all(
      branches.map(async (branch) => {
        if (branch.protected) {
          await this.unprotectBranch(project, branch);
        }
      }),
    );

    console.warn("[GitLab] Successfully unprotected branches");
  }

  async deleteProject(id: string) {
    await this.makeRequest(`/projects/${id}`, {
      method: "DELETE",
    });

    console.log(`[GitLab] Deleted project with id ${id}`);
  }

  async addMaintainerToProject(
    projectId: string,
    userId: string,
    expirationDate: Date,
  ): Promise<void> {
    const body = {
      id: projectId,
      user_id: userId,
      access_level: GITLAB_ACCESS_LEVEL_DEVELOPER,
      expires_at: dateToISO(expirationDate),
    };
    await this.makeRequest<never, AddMaintainerToProjectBody>(
      `/projects/${projectId}/members`,
      {
        method: "POST",
        body,
      },
    );

    console.log(
      `[GitLab] Added user with id ${userId} to Repo with id ${projectId}`,
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

    console.log(`[GitLab] Found User ${user.username} with id ${user.id}`);

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

    const issue = await this.makeRequest<Issue, CreateHomeworkIssueBody>(
      `/projects/${projectId}/issues`,
      {
        method: "POST",
        body,
      },
    );

    console.log(
      `[GitLab] Created Issue \"${issue.title}\" with assignee ${issue.assignee.username}`,
    );

    return issue;
  }

  async getProjectIssues(
    projectId: string,
    state = "all",
    author?: User,
  ): Promise<Issue[]> {
    const queryParams: { state: string; author_id?: string } = {
      state: state,
    };
    if (author) {
      queryParams.author_id = author.id.toString();
    }

    const issues = await this.makeRequest<Issue[]>(
      `/projects/${projectId}/issues`,
      {
        method: "GET",
        queryParams,
      },
    );

    if (issues.length > 0) {
      console.log(
        `[GitLab] found ${issues.length} closed issues${
          author ? " with author " + author.username : ""
        } in project ${projectId}`,
      );
    }

    return issues;
  }
}
