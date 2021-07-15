import Monitorer from "./monitorer.ts";

export default class HealthchecksIO implements Monitorer {
  private uuid: string;
  public static API_BASE_URL = "https://hc-ping.com";

  constructor(uuid: string) {
    this.uuid = uuid;
  }

  public async signalSuccess() {
    await fetch(this.assembleUrl());
  }

  private assembleUrl(): string {
    return `${HealthchecksIO.API_BASE_URL}/${this.uuid}`;
  }
}
