import { isBooleanField, isSingleLineField } from "./tools.ts";
import HttpClient from "../http/http.ts";
import {
  sendHomeworkSubject,
  sendHomeworkTemplate,
  SendHomeworkTemplateValues,
} from "../messages.ts";
import {
  AddNoteToCandidateBody,
  Candidate,
  CandidateDetails,
  CandidateDropdownField,
  CandidateField,
  CandidateSingleLineField,
  CompleteTaskBody,
  CreateCandidateTaskBody,
  MinimalCandidate,
  Note,
  Offer,
  SendMailToCandidateBody,
  StageDetail,
  Task,
  TaskDetails,
  UpdateProfileFieldDropdownBody,
  UpdateProfileFieldSingleLineBody,
} from "./types.ts";
import { RecruiteeError } from "./RecruiteeError.ts";
import { EmojiErrorCodes } from "../errormojis.ts";

export const ADDRESS_FIELD_NAME = "Anrede Override";
export const SIGNATURE_FIELD_NAME = "Unterschrift Override";
export const SHOULD_SEND_MAIL_FIELD_NAME = "Bot-Mails";
export const DEFAULT_SIGNATURE = "deine sipgate hacking talents";
const OFFER_BOT_TAG = "HT-Bot Target";

export default class Recruitee extends HttpClient {
  public static BASE_URL = "https://api.recruitee.com/c";

  constructor(companyId: string, apiToken: string) {
    super(`${Recruitee.BASE_URL}/${companyId}`, apiToken);
  }

  async getOffersWithTag(tag: string): Promise<Offer[]> {
    const allOffers = await this.makeRequest<{ offers: Offer[] }>(`/offers`);

    const offers = allOffers.offers.filter((offer: Offer) => {
      return offer.offer_tags.includes(tag);
    });
    if (offers.length === 0) {
      throw new RecruiteeError(
        `Keine Jobangebote mit dem Tag "${tag}" gefunden`,
      );
    }

    return offers;
  }

  async getAllCandidatesForOffers(
    offers: Offer[],
  ): Promise<MinimalCandidate[]> {
    const responses = await Promise.all(
      offers.map(
        async (offer) =>
          await this.makeRequest<{ candidates: MinimalCandidate[] }>(
            `/candidates?qualified=true&offer_id=${offer.id}`,
          ),
      ),
    );

    let allCandidates: MinimalCandidate[] = [];

    responses.forEach((response) => {
      allCandidates = allCandidates.concat(response.candidates);
    });

    return allCandidates;
  }

  async getCandidateTasks(candidateId: number): Promise<Task[]> {
    const response = await this.makeRequest<{ tasks: Task[] }>(
      `/candidates/${candidateId}/tasks`,
    );

    return response.tasks;
  }

  async createCandidateTask(
    candidate: Candidate,
    title: string,
    adminID?: string,
  ): Promise<TaskDetails> {
    const body = {
      task: {
        title,
        candidate_id: candidate.id,
        admin_ids: adminID ? [adminID] : undefined,
      },
    };
    return await this.makeRequest<TaskDetails, CreateCandidateTaskBody>(
      `/tasks/`,
      {
        method: "POST",
        body,
      },
    );
  }

  async getCandidateById(candidateId: number): Promise<Candidate> {
    const candidateDetails = await this.makeRequest<CandidateDetails>(
      `/candidates/${candidateId}`,
    );
    return candidateDetails.candidate;
  }

  async completeTask(id: number): Promise<void> {
    await this.makeRequest<never, CompleteTaskBody>(`/tasks/${id}`, {
      method: "PATCH",
      body: {
        task: {
          completed: true,
        },
      },
    });

    console.log(`[Recruitee] Checked candidate task with taskId ${id}`);
  }

  async addNoteToCandidate(
    candidateId: number,
    message: string,
  ): Promise<void> {
    await this.makeRequest<never, AddNoteToCandidateBody>(
      `/candidates/${candidateId}/notes`,
      {
        method: "POST",
        body: {
          note: {
            body: message,
          },
        },
      },
    );
  }

  async getCandidateNotes(candidateId: number): Promise<Note[]> {
    const response = await this.makeRequest<{ notes: Note[] }>(
      `/candidates/${candidateId}/notes`,
    );

    return response.notes;
  }

  async noteExists(candidateId: number, errorString: string): Promise<boolean> {
    const notes = await this.getCandidateNotes(candidateId);
    return notes.some((note) => note.body.includes(errorString));
  }

  getCandidateSalutation(candidate: Candidate): string {
    const addressOverride = candidate.fields.find(
      (field) => field.name == ADDRESS_FIELD_NAME,
    );

    if (addressOverride && isSingleLineField(addressOverride)) {
      const override = addressOverride?.values[0]?.text;
      if (override) {
        return override;
      }
    }

    const nameParts = candidate.name.split(" ");
    return nameParts[0];
  }

  async sendMailToCandidate(
    // deno-lint-ignore camelcase
    candidate_id: number,
    // deno-lint-ignore camelcase
    candidate_email: string,
    cc: string[],
    sendHomeworkTemplateValues: SendHomeworkTemplateValues,
  ): Promise<void> {
    const homeworkMailContent = sendHomeworkTemplate(
      sendHomeworkTemplateValues,
    );

    const body = {
      // deno-lint-ignore camelcase
      body_html: homeworkMailContent,
      cc,
      subject: sendHomeworkSubject,
      to: [
        {
          candidate_id,
          candidate_email,
        },
      ],
    };

    await this.makeRequest<never, SendMailToCandidateBody>(`/mailbox/send`, {
      method: "POST",
      body: body,
    });
  }

  private async updateProfileFieldSingleLine(
    candidate: Candidate,
    field: CandidateSingleLineField,
    content: string[],
  ) {
    const formattedContent = content.map((item) => {
      return { text: item };
    });

    if (field.values.length == 0) {
      field.values.push(formattedContent[0]);
    } else {
      field.values = formattedContent;
    }

    const body = {
      field: { values: field.values, kind: field.kind, name: field.name },
    };

    if (field.id !== null) {
      await this.makeRequest<never, UpdateProfileFieldSingleLineBody>(
        `/custom_fields/candidates/${candidate.id.toString()}/fields/${
          field.id?.toString()
        }`,
        { method: "PATCH", body },
      );
    } else {
      await this.makeRequest<never, UpdateProfileFieldSingleLineBody>(
        `/custom_fields/candidates/${candidate.id.toString()}/fields`,
        { method: "POST", body },
      );
    }
  }

  private async updateProfileFieldDropdown(
    candidate: Candidate,
    field: CandidateDropdownField,
    content: string[],
  ) {
    const formattedContent = content.map((item) => {
      return { value: item };
    });

    if (field.values.length == 0) {
      field.values.push(formattedContent[0]);
    } else {
      field.values = formattedContent;
    }

    const body = {
      field: field,
    };

    if (field.id !== null) {
      await this.makeRequest<never, UpdateProfileFieldDropdownBody>(
        `/custom_fields/candidates/${candidate.id.toString()}/fields/${
          field.id?.toString()
        }`,
        { method: "PATCH", body },
      );
    } else {
      await this.makeRequest<never, UpdateProfileFieldDropdownBody>(
        `/custom_fields/candidates/${candidate.id.toString()}/fields`,
        { method: "POST", body },
      );
    }
  }

  async updateProfileField(
    candidate: Candidate,
    field: CandidateField,
    content: string[],
  ) {
    if (field.kind === "single_line") {
      await this.updateProfileFieldSingleLine(
        candidate,
        field as CandidateSingleLineField,
        content,
      );
    } else {
      await this.updateProfileFieldDropdown(
        candidate,
        field as CandidateDropdownField,
        content,
      );
    }
  }

  async clearProfileField(candidate: Candidate, field: CandidateField) {
    if (field.id === undefined) {
      console.warn(
        `[Recruitee] Expected Candidate with id ${candidate.id} to have an id, none given. Possibly the candidate is outdated?`,
      );
      throw new RecruiteeError(
        `${EmojiErrorCodes.MISSING_CANDIDATE_FIELD} Kandidat:in hat nicht die erwarteten Profilfelder.`,
      );
    }
    console.log(
      `[Recruitee] Clearing profile field '${field.name}' for candidate ${candidate.id}`,
    );
    if (field.id !== null) {
      await this.makeRequest(
        `/custom_fields/candidates/${candidate.id.toString()}/fields/${field.id.toString()}`,
        { method: "DELETE" },
      );
    }
  }

  getSignature(candidate: Candidate): string {
    const signatureOverride = candidate.fields.find(
      (field) => field.name == SIGNATURE_FIELD_NAME,
    );

    if (signatureOverride && isSingleLineField(signatureOverride)) {
      const override = signatureOverride.values.map((value) => value.text);
      if (override.length > 0) {
        return this.buildSignatureFromNames(override);
      }
    }

    return DEFAULT_SIGNATURE;
  }

  shouldSendMail(candidate: Candidate): boolean {
    const field = candidate.fields.find(
      (field) => field.name === SHOULD_SEND_MAIL_FIELD_NAME,
    );
    if (field && isBooleanField(field) && field.values.length > 0) {
      return field.values[0].flag;
    }
    return true;
  }

  async proceedCandidateToStage(
    candidate: Candidate,
    stageToProceed: string,
  ): Promise<void> {
    const placement = candidate.placements[0];
    const proceedStage = await this.getStageByName(
      stageToProceed,
      placement.offer_id,
    );

    const queryParams = {
      // deno-lint-ignore camelcase
      stage_id: proceedStage.id.toString(),
      proceed: "true",
    };

    await this.makeRequest(`/placements/${placement.id}/change_stage`, {
      method: "PATCH",
      queryParams,
    });
  }

  async getStageByName(
    stageName: string,
    offerId: number,
  ): Promise<StageDetail> {
    const queryParams = {
      scope: "not_archived",
      // deno-lint-ignore camelcase
      view_mode: "default",
    };

    const { offers } = await this.makeRequest<{ offers: Offer[] }>(`/offers`, {
      method: "GET",
      queryParams,
    });

    const offer = offers.find((offer: Offer) => {
      return offer.id == offerId;
    });

    if (!offer) {
      throw new RecruiteeError(
        `${EmojiErrorCodes.OFFER_NOT_FOUND} Job-Offer mit ID ${offerId} nicht gefunden.`,
      );
    }

    const matchedStage = offer?.pipeline_template.stages.find(
      (stage: StageDetail) => {
        const searchedName = stageName.replace(/ /g, "").toLowerCase();
        const givenName = stage.name.replace(/ /g, "").toLowerCase();
        return givenName.includes(searchedName);
      },
    );
    if (!matchedStage) {
      throw new RecruiteeError(
        `${EmojiErrorCodes.PIPELINE_STAGE_NOT_FOUND} Pipeline-Schritt "${stageName}" nicht gefunden.`,
      );
    }
    return matchedStage;
  }

  public async getAllQualifiedCandidates(): Promise<Candidate[]> {
    const offers = await this.getOffersWithTag(OFFER_BOT_TAG);

    const candidates = await this.getAllCandidatesForOffers(offers);

    return await Promise.all(
      candidates.map((candidate) => this.getCandidateById(candidate.id)),
    );
  }

  public getProfileFieldByName(
    candidate: Candidate,
    name: string,
  ): CandidateField | undefined {
    return candidate.fields.find((field) => field.name === name);
  }

  private buildSignatureFromNames(names: string[]): string {
    if (names.length > 1) {
      const sorted = names.sort();
      const last = sorted.pop();
      const remaining = sorted.join(", ");

      return `${remaining} und ${last} von den sipgate hacking talents`;
    }
    return `${names[0]} von den sipgate hacking talents`;
  }
}
