import express, { type Request, type Response, type NextFunction } from "express";
import "./types.ts";
import { router } from "./router.ts";

export const app = express();

app.use(express.json());

app.use((req: Request, _res: Response, next: NextFunction) => {
  req.log = console;
  next();
});

app.use(router);
