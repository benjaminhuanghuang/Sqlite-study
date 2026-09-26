import { AsyncDatabase } from "promised-sqlite3";

export const rawDb = await AsyncDatabase.open("./pizza.sqlite");
