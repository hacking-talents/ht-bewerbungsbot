export class GitlabError extends Error {
  constructor(message: string) {
    super("[GitLab] " + message);
  }
}
