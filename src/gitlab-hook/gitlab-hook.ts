import { Router } from "https://deno.land/x/oak/mod.ts";
import { Application } from "https://deno.land/x/oak/mod.ts";
import { GitlabIssueWebhookEvent } from "./gitlab-hook.types.ts";

export const createGitLabWebhookServer = (
  port: string,
  handler: (event: GitlabIssueWebhookEvent) => void,
) => {
  const app = new Application();
  const router = new Router();

  router.post("", "/hooks", async ({ request, response }) => {
    handler(await request.body().value);
    response.status = 200;
  });

  app.use(router.routes());

  app.listen({ port: Number(port) }).then(() => {
    console.log(`Listening on ${port}`);
  });
};
