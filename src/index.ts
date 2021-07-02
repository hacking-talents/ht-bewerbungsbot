import Recruitee from "./recruitee/recruitee.ts";
import Gitlab from "./gitlab/gitlab.ts";
import { parse } from "https://deno.land/std@0.78.0/flags/mod.ts";
import Bot from "./bot/bot.ts";

const args = parse(Deno.args, {
  default: { o: false, tagRequired: undefined, d: false },
});

const pollingIntervalInS: number = Math.max(args.interval, 15);
const tagRequired: string | undefined = args.tag;
const deleteProjectInTheEnd: boolean = args.d;

const {
  GITLAB_TOKEN,
  GITLAB_TEMPLATES_NAMESPACE,
  GITLAB_HOMEWORK_NAMESPACE,
  RECRUITEE_TOKEN,
  COMPANY_ID,
} = Deno.env.toObject();

if (!GITLAB_TOKEN) {
  exitWithError("No GITLAB_TOKEN given");
}
if (!GITLAB_TEMPLATES_NAMESPACE) {
  exitWithError("No GITLAB_TEMPLATES_NAMESPACE given");
}
if (!GITLAB_HOMEWORK_NAMESPACE) {
  exitWithError("No GITLAB_HOMEWORK_NAMESPACE given");
}
if (!RECRUITEE_TOKEN) {
  exitWithError("No RECRUITEE_TOKEN given");
}
if (!COMPANY_ID) {
  exitWithError("No COMPANY_ID given");
}

if (tagRequired != undefined) {
  console.log(
    `🏷  Only checking for candidates tagged with tag \"${tagRequired}\"`,
  );
}

const gitlab = new Gitlab(
  GITLAB_TOKEN,
  GITLAB_TEMPLATES_NAMESPACE,
  GITLAB_HOMEWORK_NAMESPACE,
);

const recruitee = new Recruitee(COMPANY_ID, RECRUITEE_TOKEN);

const bot = new Bot(
  gitlab,
  recruitee,
  deleteProjectInTheEnd,
  tagRequired,
);

if (args.interval == undefined) {
  console.log(`🕵️  Checking for uncompleted homework once.\n`);

  await bot.poll();
  Deno.exit();
} else {
  console.log(
    `🕵️  Start checking for uncompleted homework tasks every ${
      pollingIntervalInS != 1 ? pollingIntervalInS + " seconds" : "second"
    }...\n`,
  );

  setInterval(() => bot.poll(), pollingIntervalInS * 1000);
}

function exitWithError(message: string) {
  console.error(message);
  Deno.exit();
}
