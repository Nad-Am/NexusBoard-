import Router from "@koa/router";

const router = new Router({ prefix: "/health" });

router.get("/", (ctx) => {
  ctx.body = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
});

export { router as healthRouter };
