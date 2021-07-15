// deno-lint-ignore-file camelcase
export type Branch = {
  name: string;
  protected: boolean;
  default: boolean;
};

export type GitlabProject = {
  name: string;
  id: string;
  web_url: string;
};

export type ImportStatus = {
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
  author: User;
  web_url: string;
};

export type ForkProjectBody = {
  namespace_id: string;
  name: string;
  path: string;
};

export type AddMaintainerToProjectBody = {
  id: string;
  user_id: string;
  access_level: number;
  expires_at: string;
};

export type CreateHomeworkIssueBody = {
  title: string;
  description: string;
  assignee_ids: string;
  due_date: string;
};
