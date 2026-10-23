import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json());

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
