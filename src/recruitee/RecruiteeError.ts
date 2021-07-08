export class RecruiteeError extends Error {
  constructor(message: string) {
    super("[Recruitee] " + message);
  }
}
