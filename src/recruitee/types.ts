export type Offer = {
  id: number;
  // deno-lint-ignore camelcase
  offer_tags: string[];
  // deno-lint-ignore camelcase
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
  id: number | null;
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

export type CandidateReference = {
  type: string;
  // deno-lint-ignore camelcase
  first_name?: string;
};

export type Placement = {
  // deno-lint-ignore camelcase
  candidate_id: number;
  id: number;
  // deno-lint-ignore camelcase
  stage_id: number;
  // deno-lint-ignore camelcase
  disqualify_reason: string;
  // deno-lint-ignore camelcase
  offer_id: number;
};

export type Task = {
  id: number;
  completed: boolean;
  title: string;
  // deno-lint-ignore camelcase
  due_date: string;
  // deno-lint-ignore camelcase
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
  id: string;
  name: string;
};
