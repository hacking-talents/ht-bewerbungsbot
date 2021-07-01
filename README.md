# 🤖 BewerbungsBot for Recruitee

## 📤 Workflow

1. Enter homework-name and GitLab Username in the profile fields
2. Optionally override the automatic address and/or signature:
   - The address will be the candidates first name. E.g. "_Hallo Sam,…_"
   - The signature will be the first names of the people assigned on the
     _homework_ task. E.g. "_Viele Grüße, Max und Robert von den hacking
     talents_"
3. Create a new Task on the right:
   - Content should be **Hausaufgabe**
   - Optionally set a due date. The default is seven days.
   - Optionally select the members to sign the mail as assigned teammates on the
     task
4. Wait for the bot to confirm the sent homework in a comment.
5. Finished! 🎉

## 🏃 Running

### 🏞 Required environment variables

Configure the following environment variables in your `.env`-file:

- `RECRUITEE_TOKEN`
- `COMPANY_ID`
- `GITLAB_TOKEN`
- `GITLAB_TEMPLATES_NAMESPACE`
- `GITLAB_HOMEWORK_NAMESPACE`

The hacking-talents configuration is available in the gopass password manager
under `misc/bewerbungsbot-Env`.

Run the project with

```bash
deno run --allow-read --allow-net --allow-env src/index.ts
```

### ⌥ Arguments

The bot automatically only runs once. To run the bot regulary, set the
`--interval=<seconds>` parameter.

- `--interval=<seconds>` set polling interval in seconds. Minimum allowed: 15s.
- `--tag=<tag name>` only check candidates with a tag. E.g. _Bot-Test_
- `-d` delete Repository at the end of successfull homework creation

Possible homeworks have to be entered in the recruitee profile field form to be
selectable.

## 🔧 Building

Use the provided Dockerfile to build an image of the application. Example when
using docker:

```bash
sudo docker build -t ht-bewerbungsbot .
```

## 🌈 Contributing

- **Use `deno fmt` for formatting instead of the default prettier formatting**
- Use the tag `--tag=Bot-Test` to prevent modifying real candidates during
  development. You have to make sure though, that a test candidate with the
  relevant tag exists.
- Use the `-d` option to not have to manually delete a test repo
- Use [Gitmoji](https://gitmoji.carloscuesta.me)
- When adding a new environment variable, make sure it's present in
  `.env.example`, as otherwise deno is not aware of it and will not throw an
  error if it's missing.
  [More Info](https://deno.land/x/dotenv@v1.0.1#safe-mode)
- Please use feature branches to develop new features.
