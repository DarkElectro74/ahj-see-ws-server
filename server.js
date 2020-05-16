const http = require("http");
const Koa = require("koa");
const Router = require("koa-router");
const { streamEvents } = require("http-event-stream");
const uuid = require("uuid");
const app = new Koa();

app.use(async (ctx, next) => {
  const origin = ctx.request.get("Origin");
  if (!origin) {
    return await next();
  }

  const headers = { "Access-Control-Allow-Origin": "*" };

  if (ctx.request.method !== "OPTIONS") {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get("Access-Control-Request-Method")) {
    ctx.response.set({
      ...headers,
      "Access-Control-Allow-Methods": "GET, POST, PUD, DELETE, PATCH"
    });

    if (ctx.request.get("Access-Control-Request-Headers")) {
      ctx.response.set(
        "Access-Control-Allow-Headers",
        ctx.request.get("Access-Control-Request-Headers")
      );
    }

    ctx.response.status = 204;
  }
});

const router = new Router();
const maxMessages = 50;
const cashedMessages = [];
let countMessages = 0;

const broadcastMessage = {
  event: "comment",
  data: JSON.stringify({
    field: "action",
    msg: "Итак, с начала игры прошло всего несколько минут",
    date: new Date()
  }),
  id: uuid.v4()
};
cashedMessages.push(broadcastMessage);

const interval = setInterval(() => {
  const actionMessage = {
    field: "action",
    msg: "Идёт перемещение мяча по полю, игроки и той, и другой команды активно пытаются атаковать"
  };
  const freekickMessage = {
    field: "freekick",
    msg: "Нарушение правил, будет штрафной удар"
  };
  const goalMessage = { 
    field: "goal", 
    msg: "Отличный удар! И Г-О-Л!" 
  };
  const randomMessages = [actionMessage, freekickMessage, goalMessage];

  let shownedMessage = 0;
  const idMessage = uuid.v4();
  const shuffledMessage = Math.floor(Math.random() * 100);
  if (shuffledMessage < 10) {
    shownedMessage = 2;
  } else if (shuffledMessage < 50) {
    shownedMessage = 1;
  } else {
    shownedMessage = 0;
  }
  randomMessages[shownedMessage].date = new Date();
  randomMessages[shownedMessage].id = idMessage;

  const broadcastMessage = {
    event: "comment",
    data: JSON.stringify(randomMessages[shownedMessage]),
    id: idMessage
  };

  cashedMessages.push(broadcastMessage);

  countMessages += 1;
  if (countMessages > maxMessages) clearInterval(interval);
}, 3000);

router.get("/sse", async ctx => {
  console.log("start sse");
  streamEvents(ctx.req, ctx.res, {
    async fetch(lastEventId) {
      console.log(lastEventId);
      return [];
    },
    stream(sse) {
      let countMessages = 0;
      const interval = setInterval(() => {
        if (cashedMessages.length > countMessages) {
          sse.sendEvent(cashedMessages[countMessages]);
          countMessages += 1;
        }

        if (countMessages > maxMessages) clearInterval(interval);
      }, 2000);

      return () => clearInterval(interval);
    }
  });

  ctx.respond = false;
});

router.get("/index", async ctx => {
  ctx.response.body = "get index";
});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());
server.listen(port);