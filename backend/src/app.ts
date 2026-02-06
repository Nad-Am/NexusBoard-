import Koa from "koa";
import cors from "@koa/cors";
import bodyParser from "koa-bodyparser";
import { canvasRouter } from "./routes/canvas.js";
import { healthRouter } from "./routes/health.js";

const app = new Koa();

// Middleware
app.use(cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.use(bodyParser());

// Error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.body = {
      error: err.message || "Internal Server Error",
    };
    console.error("[Error]", err);
  }
});

// Routes
app.use(healthRouter.routes()).use(healthRouter.allowedMethods());
app.use(canvasRouter.routes()).use(canvasRouter.allowedMethods());

export default app;
