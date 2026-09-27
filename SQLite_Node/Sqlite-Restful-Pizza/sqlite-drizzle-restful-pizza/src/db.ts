import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

const client = createClient({ url: "file:./pizza.sqlite" });

export const db = drizzle(client, { schema });
