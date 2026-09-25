# sqlite + prisma setup

```sh
npm i drizzle-orm better-sqlite3 dotenv
npm i -D drizzle-kit drizzle-seed @types/better-sqlite3
```

drizzle-orm: TypeScript ORM，跑在 better-sqlite3 之上，干三件事：

- 用 TS 代码定义表结构（schema），自动推导出查询结果的类型
- 提供类型安全的查询构造器（db.select().from(articles).where(...)），也能写原生 SQL
- 需要搭配 drizzle-kit 才能把 schema 变成实际的数据库迁移

better-sqlite3: Node 下最常用的 SQLite 驱动，同步 API（不用 async/await 就能查询），直接读写本地 .db 文件，不需要单独起数据库服务

The drizzle-kit package is all the CLI commands you need to run Drizzle. So creating migrations, running migrations, etc.

drizzle-seed 造测试/示例数据。给定 schema，能按类型自动生成随机但结构合法的假数据（字符串、日期、外键关联等），用来填充开发环境的数据库，不用手写一堆 INSERT 语句。

create drizzle.config.ts

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./sqlite.db",
  },
});
```

create db client (e.g. src/db/index.ts)

```ts
import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_URL ?? "./sqlite.db");
export const db = drizzle(sqlite, { schema });
```

add script

```json
"db:seed": "tsx src/db/seed.ts",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

## Create a Drizzle Schema
