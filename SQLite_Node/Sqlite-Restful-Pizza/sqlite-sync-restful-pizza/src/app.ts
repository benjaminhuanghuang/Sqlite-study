import express from "express";
import { router } from "./router.ts";

export const app = express();

app.use(express.json());

app.use(router);
