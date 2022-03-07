// deno-lint-ignore-file camelcase
export type Offer = {
  title: string;
  id: number;
  offer_tags: string[];
  pipeline_template: PipelineTemplate;
};

export type CandidateDetails = {
  candidate: Candidate;
  references: CandidateReference[];
};

export type MinimalCandidate = {
  id: number;
};

export type Candidate = MinimalCandidate & {
  placements: Placement[];
  tags: string[];
  fields: CandidateField[];
  name: string;
  emails: string[];
};

export type CandidateField = {
  name: string;
  id: number | null | undefined;
  kind:
    | "dropdown"
    | "single_line"
    | "date_of_birth"
    | "address"
    | "gender"
    | "language_skill"
    | "boolean"
    | "education"
    | "experience";
};

export type CandidateSingleLineField = CandidateField & {
  kind: "single_line";
  values: { text: string }[];
};

export type CandidateDropdownField = CandidateField & {
  kind: "dropdown";
  options: { values: string[] };
  values: { value: string }[];
};

export type CandidateBooleanField = CandidateField & {
  kind: "boolean";
  values: { flag: boolean }[];
};

export type CandidateReference = {
  type: string;
  first_name?: string;
};

export type Placement = {
  candidate_id: number;
  id: number;
  stage_id: number;
  disqualify_reason: string;
  offer_id: number;
};

export type Task = {
  id: number;
  completed: boolean;
  title: string;
  due_date: string;
  created_at: string;
  references: CandidateReference[];
};

export type TaskDetails = {
  references: CandidateReference[];
  task: Task;
};

export type PipelineTemplate = {
  stages: StageDetail[];
};

export type StageDetail = {
  id: number;
  name: string;
};

export type CreateCandidateTaskBody = {
  task: {
    title: string;
    candidate_id: number;
    admin_ids?: string[];
  };
};

export type CompleteTaskBody = {
  task: {
    completed: boolean;
  };
};

export type Note = {
  body: string;
};

export type AddNoteToCandidateBody = {
  note: {
    body: string;
  };
};

export type SendMailToCandidateBody = {
  body_html: string;
  subject: string;
  to: { candidate_id: number; candidate_email: string }[];
};

export type UpdateProfileFieldSingleLineBody = {
  field: unknown; // TODO: add correct type
};

export type UpdateProfileFieldDropdownBody = {
  field: unknown; // TODO: add correct type
};
