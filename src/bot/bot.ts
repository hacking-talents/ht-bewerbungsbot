import { HttpError } from "./../http/HttpError.ts";
import { GitlabError } from "./../gitlab/GitlabError.ts";
import Gitlab from "../gitlab/gitlab.ts";
import { GitlabProject, Issue, User as GitlabUser } from "../gitlab/types.ts";
import Recruitee from "../recruitee/recruitee.ts";
import {
  Candidate,
  CandidateSingleLineField,
  Task,
} from "../recruitee/types.ts";
import { addDaysToDate } from "../tools.ts";
import { isDropdownField, isSingleLineField } from "./../recruitee/tools.ts";
import { EmojiErrorCodes } from "../errormojis.ts";
import { RecruiteeError } from "../recruitee/RecruiteeError.ts";
import Monitorer from "../monitoring/monitorer.ts";

const HOMEWORK_TASK_TITLE = "hausaufgabe";
const HOMEWORK_EXTENSION_TITLE = "Abgabe verschieben";
const ERROR_TASK_TITLE = "Fehler fixen";
const HOMEWORK_SENT_STAGE_TITLE = "Hausaufgabe versendet";
const HOMEWORK_RECEIVED_STAGE_TITLE = "Hausaufgabe erhalten";
export const HOMEWORK_FIELD_NAME = "Hausaufgabe";
export const GITLAB_USERNAME_FIELD_NAME = "GitLab Account";
export const GITLAB_REPO_FIELD_NAME = "GitLab Repo";
const GITHUB_BASE_URL = "https://gitlab.com/";
const DEFAULT_HOMEWORK_DURATION_IN_DAYS = 8;
export const TASK_ASSIGN_MK_TEXT = "MK bilden und zuordnen";

export default class Bot {
  private gitlab: Gitlab;
  private recruitee: Recruitee;
  private deleteProjectInTheEnd = false;
  private requiredTag: string | null = null;
  private monitorer: Monitorer;
  private dryRun: boolean;

  constructor(
    gitlab: Gitlab,
    recruitee: Recruitee,
    monitorer: Monitorer,
    deleteProjectInTheEnd: boolean,
    requiredTag?: string,
    dryRun?: boolean,
  ) {
    this.gitlab = gitlab;
    this.recruitee = recruitee;
    this.requiredTag = requiredTag || null;
    this.deleteProjectInTheEnd = deleteProjectInTheEnd;
    this.monitorer = monitorer;
    this.dryRun = dryRun ?? false;
  }

  async poll() {
    const candidates = await this.recruitee.getAllQualifiedCandidates();

    const candidatesWithRequiredTag = candidates.filter(
      (candidate: Candidate) => {
        return this.candidateHasRequiredTag(candidate);
      },
    );

    const filterCandidatesWithoutUnfinishedErrorTask = async (
      candidates: Candidate[],
    ) => {
      const results: boolean[] = await Promise.all(
        candidates.map(
          async (candidate) => !(await this.hasUnfinishedErrorTask(candidate)),
        ),
      );

      return candidates.filter((_, index: number) => results[index]);
    };

    const candidatesWithoutUnfinishedErrorTask =
      await filterCandidatesWithoutUnfinishedErrorTask(
        candidatesWithRequiredTag,
      );

    await this.sendAllPendingHomeworks(
      candidatesWithoutUnfinishedErrorTask,
    ).catch(console.warn);

    await this.checkForClosedIssues(candidatesWithoutUnfinishedErrorTask).catch(
      console.warn,
    );

    await this.extendAllHomeworks(candidatesWithoutUnfinishedErrorTask).catch(
      console.warn,
    );

    await this.monitorer.signalSuccess();
  }

  // TODO: Assign Tasks for personel-team, when candidates are moved to "hired"-stage
  // see [Issue #5](https://github.com/hacking-talents/ht-bewerbungsbot/issues/5)

  private async extendAllHomeworks(candidates: Candidate[]) {
    await Promise.all(
      candidates.map(
        async (candidate) =>
          await this.extendHomework(candidate).catch((error) =>
            this.handleError(error, candidate)
          ),
      ),
    );
  }

  private async extendHomework(candidate: Candidate) {
    const homeworkExtensionTask = await this.getHomeworkExtensionTask(
      candidate,
    );
    if (!homeworkExtensionTask) {
      return;
    }

    if (this.dryRun) {
      console.log(
        `[Bot/dry-run] would have extended homework due date for ${candidate.name}`,
      );
      return;
    }

    const project = await this.getProjectByCandidate(candidate);
    const issues = await this.gitlab.getProjectIssues(project.id, "opened");

    const issueIid = 1;
    const firstIssue = issues.filter((issue) => issue.iid === issueIid)[0];
    if (!firstIssue) {
      return;
    }

    let oldDueDate;
    if (firstIssue.due_date) {
      new Date(firstIssue.due_date);
    }
    const newDueDate = this.calculateDueDateFromTask(
      homeworkExtensionTask,
      oldDueDate,
    );

    const body = {
      due_date: newDueDate,
    };

    // TODO: move function to GitLab module
    await this.gitlab
      .makeRequest<unknown>(`/projects/${project.id}/issues/${issueIid}`, {
        method: "PUT",
        body,
      })
      .catch(console.warn);

    console.log(
      `[Bot] Extending homework of candidate with id ${candidate.id}. Extension Time: ${homeworkExtensionTask.due_date}`,
    );
  }

  private async handleError(error: Error, candidate: Candidate) {
    if (error instanceof GitlabError || error instanceof RecruiteeError) {
      await this.notifyAboutError(candidate, error.message);
    } else if (error instanceof HttpError) {
      await this.notifyAboutError(
        candidate,
        `${EmojiErrorCodes.UNEXPECTED_HTTP} Unerwarteter HTTP-Fehler mit Code ${error.statusCode}. Für mehr Infos bitte in die Logs schauen.`,
        error,
      );
    } else {
      await this.notifyAboutError(
        candidate,
        `${EmojiErrorCodes.UNEXPECTED} Unerwarteter Fehler. Bitte in die Logs schauen.`,
        error,
      );
    }

    await this.recruitee.addTagToCandidate(candidate, "Bot-Fehler aufgetreten");
    await this.recruitee.createCandidateTask(candidate, ERROR_TASK_TITLE);
  }

  private async sendAllPendingHomeworks(candidates: Candidate[]) {
    await Promise.all(
      candidates.map((candidate) =>
        this.sendHomeworkForCandidate(candidate).catch((error) =>
          this.handleError(error, candidate)
        )
      ),
    );
  }

  private async checkForClosedIssues(candidates: Candidate[]) {
    const homeworkSentCandidates = (
      await Promise.all(
        candidates.map(async (candidate) => {
          const placement = candidate.placements[0];
          if (!placement || !placement.stage_id) return;
          try {
            const stage = await this.recruitee.getStageByName(
              HOMEWORK_SENT_STAGE_TITLE,
              placement.offer_id,
            );
            if (placement.stage_id == stage.id) {
              return candidate;
            }
          } catch (e) {
            this.handleError(e, candidate);
          }
        }),
      )
    ).filter((c): c is Candidate => c !== undefined);

    await Promise.all(
      homeworkSentCandidates.map((candidate) =>
        this.handleClosedCandidateIssues(candidate).catch((error) =>
          this.handleError(error, candidate)
        )
      ),
    );
  }

  private async handleClosedCandidateIssues(candidate: Candidate) {
    let project: GitlabProject;
    let botGitlabUser: GitlabUser;
    let closedIssuesByBot: Issue[];
    try {
      project = await this.getProjectByCandidate(candidate);
      botGitlabUser = await this.gitlab.getOwnUserInfo();
      closedIssuesByBot = await this.gitlab.getProjectIssues(
        project.id,
        "closed",
        botGitlabUser,
      );
    } catch (e) {
      console.warn(e.message);
      return;
    }

    if (!closedIssuesByBot || closedIssuesByBot.length < 1) {
      return;
    }
    if (closedIssuesByBot.length > 1) {
      throw Error(
        `There are multiple closed issues created by the Bot in project ${project.id}`,
      );
    }

    if (this.dryRun) {
      console.log(
        `[Bot/dry-run] Candidate ${candidate.name} is done with their homework at ${project}`,
      );
      return;
    }

    await this.recruitee.proceedCandidateToStage(
      candidate,
      HOMEWORK_RECEIVED_STAGE_TITLE,
    );
    await this.recruitee.createCandidateTask(
      candidate,
      TASK_ASSIGN_MK_TEXT,
      Deno.env.get("RECRUITEE_HR_ID"),
    );
    await this.recruitee.addNoteToCandidate(
      candidate.id,
      "📥 Hausaufgabe eingegangen.",
    );
  }

  private async getProjectByCandidate(candidate: Candidate) {
    const projectUrlField = this.recruitee.getProfileFieldByName(
      candidate,
      GITLAB_REPO_FIELD_NAME,
    );
    if (
      projectUrlField != undefined &&
      (projectUrlField as CandidateSingleLineField).values.length != 0
    ) {
      const projectUrl = (projectUrlField as CandidateSingleLineField).values[0]
        .text;
      const projectPath = projectUrl.replace(GITHUB_BASE_URL, "");
      const splittedPath = projectPath.split("/");
      return await this.gitlab.getHomeworkProject(
        splittedPath[splittedPath.length - 1],
      );
    } else {
      throw Error(
        `No project-field found for candidate with id ${candidate.id} in offer ${
          candidate.placements[0].offer_id
        }`,
      );
    }
  }

  private async notifyAboutError(
    candidate: Candidate,
    message: string,
    extendedMessage?: Error,
  ) {
    await this.recruitee.addNoteToCandidate(candidate.id, message);
    console.warn(extendedMessage || message);
  }

  private async sendHomeworkForCandidate(candidate: Candidate) {
    const homeworkTask = await this.getHomeworkTask(candidate);
    if (!homeworkTask) {
      return;
    }

    if (this.dryRun) {
      console.log(
        `[Bot/dry-run] Processing candidate "${candidate.name}" with id ${candidate.id}. Task-ID: ${homeworkTask.id}`,
      );
      return;
    }

    console.log(
      `[Bot] Processing candidate "${candidate.name}" with id ${candidate.id}. Task-ID: ${homeworkTask.id}`,
    );

    if (candidate.emails[0] == undefined) {
      console.log(`[Bot] e-mail address could not be found. No homework sent`);
      throw new RecruiteeError("⚠️ Keine Mailadresse gefunden.");
    }

    const homework = this.getHomeworkToSend(candidate);

    const gitlabUsername = this.getGitlabUsername(candidate);

    const gitlabUser = await this.gitlab.getUser(gitlabUsername);

    const {
      issue: gitlabIssue,
      fork: gitlabFork,
      dueDate,
    } = await this.createHomeworkProjectFork(
      candidate,
      gitlabUser,
      homework,
      homeworkTask,
    );

    const shouldSendMail = this.recruitee.shouldSendMail(candidate);

    if (shouldSendMail) {
      await this.notifyCandidate(
        candidate,
        gitlabIssue,
        gitlabFork,
        addDaysToDate(dueDate, -1),
      ).catch((error) => this.handleError(error, candidate));
    }

    await this.finalizeCandidate(
      candidate,
      homeworkTask,
      homework,
      dueDate,
      shouldSendMail,
    );

    if (this.deleteProjectInTheEnd) {
      await this.deleteGitlabProjectAndRemoveRepoField(
        candidate.id,
        gitlabFork.id,
      );
    }
  }

  private async deleteGitlabProjectAndRemoveRepoField(
    candidateId: number,
    gitlabForkId: string,
  ) {
    // Retrieve candidate to get the most up-to-date profile field information
    const candidate = await this.recruitee.getCandidateById(candidateId);
    await this.gitlab.deleteProject(gitlabForkId);
    const repoField = this.recruitee.getProfileFieldByName(
      candidate,
      GITLAB_REPO_FIELD_NAME,
    );

    if (repoField !== undefined) {
      await this.recruitee.clearProfileField(candidate, repoField);
    }
  }

  private async finalizeCandidate(
    candidate: Candidate,
    homeworkTask: Task,
    homework: string,
    dueDate: Date,
    shouldSendMail: boolean,
  ) {
    await this.recruitee.completeTask(homeworkTask.id);

    await this.recruitee.proceedCandidateToStage(
      candidate,
      "Hausaufgabe versendet",
    );

    const localizedDueDate = dueDate.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    await this.recruitee.addNoteToCandidate(
      candidate.id,
      `📤  Hausaufgabe \"${homework}\" ${
        shouldSendMail ? "versendet" : "angelegt"
      }. Fällig am ${localizedDueDate}.`,
    );

    // TODO: Create additional Tasks, that need to be done. See [Issue #6](https://github.com/hacking-talents/ht-bewerbungsbot/issues/6)
  }

  private async notifyCandidate(
    candidate: Candidate,
    gitlabIssue: Issue,
    gitlabFork: GitlabProject,
    dueDate: Date,
  ) {
    const address = this.recruitee.getCandidateSalutation(candidate);
    const signature = this.recruitee.getSignature(candidate);

    const candidateMailAddress = candidate.emails.shift();
    if (!candidateMailAddress) {
      throw new RecruiteeError(
        `${EmojiErrorCodes.MISSING_CANDIDATE_FIELD} Es wurde keine Emailadresse gefunden.`,
      );
    }
    const optionalMailAddresses = candidate.emails;

    await this.recruitee.sendMailToCandidate(
      candidate.id,
      candidateMailAddress,
      optionalMailAddresses,
      {
        applicantName: address,
        issueUrl: gitlabIssue.web_url,
        projectUrl: gitlabFork.web_url,
        homeworkDueDate: dueDate,
        mk_signature: signature,
      },
    );
  }

  private async createHomeworkProjectFork(
    candidate: Candidate,
    gitlabUser: GitlabUser,
    homework: string,
    homeworkTask: Task,
  ): Promise<{ issue: Issue; fork: GitlabProject; dueDate: Date }> {
    const homeworkProject = await this.gitlab.getTemplateProject(homework);
    const forkName = `homework-${gitlabUser.username}-${
      Math.floor(
        Math.random() * 1000000000000,
      )
    }`;
    const fork = await this.gitlab.forkHomework(homeworkProject!.id, forkName);

    const dueDate = this.calculateDueDateFromTask(homeworkTask);

    await this.gitlab.addMaintainerToProject(
      fork.id,
      String(gitlabUser.id),
      dueDate,
    );

    const issue = await this.gitlab.createHomeworkIssue(
      fork.id,
      String(gitlabUser.id),
      dueDate,
      { title: "Hausaufgabe abschließen", applicantName: candidate.name },
    );

    await this.setGitlabRepoProfileField(candidate, fork.web_url);
    await this.setHomeworkCorrectionGuideProfileField(
      candidate,
      Deno.env.get("CORRECTION_GUIDE_LINK"),
    );

    return { issue, fork, dueDate };
  }

  private calculateDueDateFromTask(task: Task, fromDate?: Date): Date {
    let dueDate;

    if (task.due_date === null) {
      dueDate = addDaysToDate(
        new Date(fromDate ? fromDate : task.created_at),
        DEFAULT_HOMEWORK_DURATION_IN_DAYS,
      );
    } else {
      dueDate = new Date(task.due_date);
    }

    return dueDate;
  }

  private async setGitlabRepoProfileField(
    candidate: Candidate,
    content: string,
  ): Promise<void> {
    const repoField = this.recruitee.getProfileFieldByName(
      candidate,
      GITLAB_REPO_FIELD_NAME,
    );

    if (!repoField || !isSingleLineField(repoField)) {
      throw new Error(
        `${GITLAB_USERNAME_FIELD_NAME} field is not configured correctly. Please check the profile fields template for candidates.`,
      );
    }

    await this.recruitee.updateProfileField(candidate, repoField, [content]);
  }

  private async setHomeworkCorrectionGuideProfileField(
    candidate: Candidate,
    content: string | undefined,
  ): Promise<void> {
    const fieldName = Deno.env.get("CORRECTION_GUIDE_PROFILE_FIELD_NAME");
    if (content === undefined) {
      console.warn(
        "WARNING: CORRECTION_GUIDE_LINK is not set. Skipping ProfileField update.",
      );
      return;
    }
    if (fieldName === undefined) {
      console.warn(
        "WARNING: CORRECTION_GUIDE_PROFILE_FIELD_NAME is not set. Skipping ProfileField update.",
      );
      return;
    }
    const repoField = this.recruitee.getProfileFieldByName(
      candidate,
      fieldName,
    );

    if (!repoField || !isSingleLineField(repoField)) {
      throw new Error(
        `${fieldName} field is not configured correctly. Please check the profile fields template for candidates.`,
      );
    }

    await this.recruitee.updateProfileField(candidate, repoField, [content]);
  }

  private getGitlabUsername(candidate: Candidate): string {
    const gitlabUsernameField = this.recruitee.getProfileFieldByName(
      candidate,
      GITLAB_USERNAME_FIELD_NAME,
    );

    if (!gitlabUsernameField || !isSingleLineField(gitlabUsernameField)) {
      throw new Error(
        `${GITLAB_USERNAME_FIELD_NAME} field is not configured correctly. Please check the profile fields template for candidates.`,
      );
    }

    if (!gitlabUsernameField.values.length) {
      throw new RecruiteeError(
        `${EmojiErrorCodes.MISSING_CANDIDATE_FIELD} Es wurde kein GitLab-Benutzername angegeben.`,
      );
    }

    return gitlabUsernameField.values[0].text.replace(/\s+/g, "");
  }

  private getHomeworkToSend(candidate: Candidate): string {
    const homeworkField = this.recruitee.getProfileFieldByName(
      candidate,
      HOMEWORK_FIELD_NAME,
    );

    if (!homeworkField || !isDropdownField(homeworkField)) {
      throw new Error(
        `${HOMEWORK_FIELD_NAME} field exists, but is not of type 'dropdown'. Please check the profile fields template for candidates.`,
      );
    }

    if (!homeworkField.values.length) {
      throw new RecruiteeError(
        `${EmojiErrorCodes.MISSING_CANDIDATE_FIELD} Es wurde keine Hausaufgabe ausgewählt.`,
      );
    }

    return homeworkField.values[0].value;
  }

  private async getHomeworkTask(candidate: Candidate): Promise<Task | null> {
    return await this.getTaskByTitle(candidate, HOMEWORK_TASK_TITLE);
  }

  private async getHomeworkExtensionTask(
    candidate: Candidate,
  ): Promise<Task | null> {
    return await this.getTaskByTitle(candidate, HOMEWORK_EXTENSION_TITLE);
  }

  private async hasUnfinishedErrorTask(candidate: Candidate): Promise<boolean> {
    return (await this.getTaskByTitle(candidate, ERROR_TASK_TITLE)) !== null;
  }

  private async getTaskByTitle(
    candidate: Candidate,
    taskTitle: string,
  ): Promise<Task | null> {
    const allTasks = await this.recruitee.getCandidateTasks(candidate.id);
    const tasks = allTasks.filter(
      (task) =>
        task.completed === false &&
        task.title.toLowerCase() === taskTitle.toLowerCase(),
    );

    if (tasks.length === 0) {
      return null;
    }

    if (tasks.length > 1) {
      const errorString =
        `⚠️ Es scheinen mehrere Aufgaben mit Titel '${taskTitle}' für den Kandidaten "${candidate.name}" vorhanden zu sein, bitte eines davon löschen.`;
      if (!await this.recruitee.noteExists(candidate.id, errorString)) {
        await this.recruitee.addNoteToCandidate(candidate.id, errorString);
      }
    }

    return tasks[0];
  }

  private candidateHasRequiredTag(candidate: Candidate): boolean {
    return this.requiredTag ? candidate.tags.includes(this.requiredTag) : true;
  }
}
