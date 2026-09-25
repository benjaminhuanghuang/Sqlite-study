import { db } from "./index";
import { articles } from "./schema";

async function main() {
  await db.delete(articles);
  await db.insert(articles).values([
    { title: "Hello Drizzle", body: "First seeded article." },
    { title: "SQLite + Drizzle", body: "Second seeded article." },
  ]);
  console.log("Seed complete.");
}

main();
