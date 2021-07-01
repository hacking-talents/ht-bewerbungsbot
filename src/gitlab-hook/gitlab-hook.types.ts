export type GitlabIssueWebhookEvent = {
  project: {
    id: number;
    web_url: string;
  };
  object_attributes: {
    action: "close" | "reopen" | "open";
  };
};
