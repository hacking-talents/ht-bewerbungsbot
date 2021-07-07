export class GitLabError extends Error {
  constructor(message: string) {
    super("[Gitlab] " + message);
  }
}
