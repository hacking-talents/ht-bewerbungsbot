import { HttpError } from "./../http/HttpError.ts";
import { GitlabError } from "./../gitlab/GitlabError.ts";
import Gitlab from "../gitlab/gitlab.ts";
import { GitlabProject, Issue, User as GitlabUser } from "../gitlab/types.ts";
import Recruitee from "../recruitee/recruitee.ts";
import { Candidate, CandidateReference, Task } from "../recruitee/types.ts";
import { addDaysToDate } from "../tools.ts";
import { isDropdownField, isSingleLineField } from "./../recruitee/tools.ts";
import { EmojiErrorCodes } from "../errormojis.ts";

const HOMEWORK_TASK_TITLE = "hausaufgabe";
const HOMEWORK_FIELD_NAME = "Hausaufgabe";
const GITLAB_USERNAME_FIELD_NAME = "GitLab Account";
const GITLAB_REPO_FIELD_NAME = "GitLab Repo";
const DEFAULT_HOMEWORK_DURATION_IN_DAYS = 8;

export default class Bot {
  private gitlab: Gitlab;
  private recruitee: Recruitee;
  private requiredTag: string | null = null;
  private deleteProjectInTheEnd = false;

  constructor(
    gitlab: Gitlab,
    recruitee: Recruitee,
    deleteProjectInTheEnd: boolean,
    requiredTag?: string,
  ) {
    this.gitlab = gitlab;
    this.recruitee = recruitee;
    this.requiredTag = requiredTag || null;
    this.deleteProjectInTheEnd = deleteProjectInTheEnd;
  }

  async poll() {
    await this.sendAllPendingHomeworks().catch(console.warn);
  }

  private async sendAllPendingHomeworks() {
    const candidates = await this.recruitee.getAllQualifiedCandidates();

    await Promise.all(
      candidates.map((candidate) =>
        this.sendHomeworkForCandidate(candidate).catch((error) => {
          switch (error) {
            case error instanceof GitlabError:
              this.notifyAboutError(candidate, error.message);
              break;

            case error instanceof HttpError:
              this.notifyAboutError(
                candidate,
                `${EmojiErrorCodes.UNEXPECTED_HTTP} Unerwarteter HTTP-Fehler mit Code ${error.statusCode}`,
                `Unexpected HTTP-Error with code ${error.statusCode}: ${error.body}`,
              );
              break;

            default:
              this.notifyAboutError(
                candidate,
                `${EmojiErrorCodes.UNEXPECTED} Unerwarteter Fehler. Bitte in die Logs schauen.`,
                error,
              );
              break;
          }
        })
      ),
    );
  }

  private async notifyAboutError(
    candidate: Candidate,
    message: string,
    extendedMessage?: string,
  ) {
    await this.recruitee.addNoteToCandidate(candidate.id, message);
    console.warn(extendedMessage || message);
  }

  private async sendHomeworkForCandidate(candidate: Candidate) {
    const homeworkTask = await this.getHomeworkTask(candidate);
    if (!homeworkTask) {
      return;
    }

    if (!this.candidateHasRequiredTag(candidate)) {
      return;
    }

    console.log(
      `[Bot] Processing candidate with id ${candidate.id}. Task-ID: ${homeworkTask.id}`,
    );

    if (candidate.emails[0] == undefined) {
      await this.recruitee.addNoteToCandidate(
        candidate.id,
        `⚠️ Keine Mailadresse gefunden. Hausaufgabe kann nicht verschickt werden.`,
      );
      console.log(`[Bot] e-mail address could not be found. No homework sent`);
      return;
    }

    const homework = await this.getHomeworkToSend(candidate);
    if (!homework) {
      await this.recruitee.addNoteToCandidate(
        candidate.id,
        `⚠️ Keine Hausaufgabe ausgewählt! Hausaufgabe kann nicht verschickt werden.`,
      );
      console.log(`[Bot] No homework selected. Homework can not be sent`);
      return;
    }

    const gitlabUsername = this.getGitlabUsername(candidate);
    if (!gitlabUsername) {
      await this.recruitee.addNoteToCandidate(
        candidate.id,
        `⚠️ Kein GitLab User angegeben! Hausaufgabe kann nicht verschickt werden.`,
      );
      console.log(`[Bot] No GitLab user entered. Homework can not be sent`);
      return;
    }

    const gitlabUser = await this.gitlab.getUser(gitlabUsername);

    if (!gitlabUser) {
      await this.recruitee.addNoteToCandidate(
        candidate.id,
        `⚠️ GitLab-user \"${gitlabUsername}\" nicht gefunden. Hausaufgabe kann nicht verschickt werden.`,
      );
      console.log(
        `[Bot] GitLab User could not be found. Homework can not be sent`,
      );
      return;
    }

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

    const homeworkTaskDetails = await this.recruitee.getTaskDetails(
      homeworkTask,
    );

    await this.finalizeCandidate(candidate, homeworkTask, homework, dueDate);

    await this.notifyCandidate(
      candidate,
      homeworkTaskDetails.references,
      gitlabIssue,
      gitlabFork,
      addDaysToDate(dueDate, -1),
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
  ) {
    await this.recruitee.completeTask(homeworkTask.id);

    await this.recruitee.proceedCandidateToStage(
      candidate,
      "Hausaufgabe versendet",
    );

    await this.recruitee.addNoteToCandidate(
      candidate.id,
      `📤  Hausaufgabe \"${homework}\" versendet. Fällig am ${
        dueDate.toLocaleDateString(
          "de-DE",
          { weekday: "long", day: "numeric", month: "long" }, // FIXME: locale Date is not correctly printed
        )
      }`,
    ); // TODO: include more info in log message (in a form of a checklist)
  }

  private async notifyCandidate(
    candidate: Candidate,
    references: CandidateReference[],
    gitlabIssue: Issue,
    gitlabFork: GitlabProject,
    dueDate: Date,
  ) {
    const address = this.recruitee.getCandidateSalutation(candidate);
    const signature = this.recruitee.getSignature(candidate, references);

    const candidateMailAddress = candidate.emails[0]; // TODO: Handle multiple mail addresses

    await this.recruitee.sendMailToCandidate(
      candidate.id,
      candidateMailAddress,
      "sipgate Hausaufgabe", // TODO: Extract subject to messages file
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
    const homeworkProject = await this.gitlab.getHomeworkProject(homework);
    const forkName = `homework-${gitlabUser.username}-${
      Math.floor(
        Math.random() * 1000000000000,
      )
    }`;
    const fork = await this.gitlab.forkHomework(homeworkProject!.id, forkName);

    const dueDate = this.calculateHomeworkDueDate(homeworkTask);

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

    return { issue, fork, dueDate };
  }

  private calculateHomeworkDueDate(homeworkTask: Task): Date {
    let dueDate;

    if (homeworkTask.due_date === null) {
      dueDate = addDaysToDate(
        new Date(homeworkTask.created_at),
        DEFAULT_HOMEWORK_DURATION_IN_DAYS,
      );
    } else {
      dueDate = new Date(homeworkTask.due_date);
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

    if (repoField && isSingleLineField(repoField)) {
      await this.recruitee.updateProfileFieldSingleLine(candidate, repoField, [
        content,
      ]);
    } else {
      console.warn(
        `[Bot] cannot find ${GITLAB_REPO_FIELD_NAME} in candidate ${candidate.id}`,
      );
    }
  }

  private getGitlabUsername(candidate: Candidate): string | null {
    const gitlabUsernameField = this.recruitee.getProfileFieldByName(
      candidate,
      GITLAB_USERNAME_FIELD_NAME,
    );

    if (!gitlabUsernameField || !isSingleLineField(gitlabUsernameField)) {
      return null;
    }

    if (!gitlabUsernameField.values.length) {
      return null;
    }

    return gitlabUsernameField.values[0].text.replace(/\s+/g, "");
  }

  private getHomeworkToSend(candidate: Candidate): string | null {
    const homeworkField = this.recruitee.getProfileFieldByName(
      candidate,
      HOMEWORK_FIELD_NAME,
    );

    if (!homeworkField || !isDropdownField(homeworkField)) {
      console.warn(
        `[Bot] ${HOMEWORK_FIELD_NAME} field exists, but is not of type 'dropdown' for candidate ${candidate.id}`,
      );
      return null;
    }

    if (!homeworkField.values.length) {
      return null;
    }

    return homeworkField.values[0].value;
  }

  private async getHomeworkTask(candidate: Candidate): Promise<Task | null> {
    const tasks = await this.recruitee.getCandidateTasks(candidate.id);
    const homeworkTasks = tasks.filter(
      (task) =>
        task.completed === false &&
        task.title.toLowerCase() === HOMEWORK_TASK_TITLE,
    );

    if (homeworkTasks.length === 0) {
      return null;
    }

    if (homeworkTasks.length > 1) {
      await this.recruitee.addNoteToCandidate(
        candidate.id,
        `⚠️ Es scheinen mehrere Aufgaben mit Titel '${HOMEWORK_TASK_TITLE}' vorhanden zu sein, bitte eines davon löschen.`,
      );
      return null;
    }

    return homeworkTasks[0];
  }

  private candidateHasRequiredTag(candidate: Candidate): boolean {
    return this.requiredTag
      ? !!candidate.tags.includes(this.requiredTag)
      : true;
  }
}
