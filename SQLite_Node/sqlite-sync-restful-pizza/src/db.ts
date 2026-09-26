import { DatabaseSync } from "node:sqlite";

export const rawDb = new DatabaseSync("./pizza.sqlite");
