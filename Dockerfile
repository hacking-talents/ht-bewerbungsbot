FROM hayd/alpine-deno:1.5.4

ENV POLL_INTERVAL=300

WORKDIR /app

ADD ./src /app
ADD ./.env.example /app/.env.example

RUN chown -R deno:deno /app

USER deno

RUN deno cache index.ts

CMD ["sh", "-c", "deno run --allow-read --allow-net --allow-env ./index.ts --interval=${POLL_INTERVAL}"]
