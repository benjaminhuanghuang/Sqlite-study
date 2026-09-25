import { db } from "./db/index";
import { articles } from "./db/schema";

async function main() {
  const all = await db.select().from(articles);
  console.log(all);
}

main();
