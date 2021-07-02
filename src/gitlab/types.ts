export type Branch = {
  name: string;
  protected: boolean;
  default: boolean;
};

export type GitlabProject = {
  name: string;
  id: string;
  // deno-lint-ignore camelcase
  web_url: string;
};

export type ImportStatus = {
  // deno-lint-ignore camelcase
  import_status:
    | "failed"
    | "none"
    | "queued"
    | "started"
    | "finished"
    | "regeneration_in_progress";
};

export type User = {
  id: number;
  username: string;
  name: string;
};

export type Issue = {
  title: string;
  assignee: User;
  // deno-lint-ignore camelcase
  web_url: string;
};
