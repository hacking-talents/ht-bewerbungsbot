export class GitlabError extends Error {
  constructor(message: string) {
    super("[Gitlab] " + message);
  }
}
