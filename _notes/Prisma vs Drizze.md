# Prisma vs Drizzle

| 功能         | Prisma                        | Drizzle                                       |
| ------------ | ----------------------------- | --------------------------------------------- |
| 定义表       | schema.prisma                 | sqliteTable()                                 |
| 整数主键     | Int @default(autoincrement()) | integer().primaryKey({ autoIncrement: true }) |
| 布尔字段     | Boolean                       | integer({ mode: "boolean" })                  |
| 日期时间     | DateTime                      | 可选 integer 时间戳或 text                    |
| 一对多关系   | orders Order[]                | relations()                                   |
| 关联查询     | include                       | with 或 JOIN                                  |
| 创建关联数据 | 嵌套 create                   | 显式插入或事务                                |
| 迁移工具     | Prisma Migrate                | Drizzle Kit                                   |
| SQL 控制     | 支持原生 SQL                  | 查询 API 更贴近 SQL                           |

## Schema

```prisma
datasource db {
  provider = "sqlite"
}

model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  orders    Order[]
}

model Order {
  id         Int      @id @default(autoincrement())
  amountCents Int      // use 金额的整数分值
  createdAt  DateTime @default(now())

  userId     Int
  user       User     @relation(
    fields: [userId],
    references: [id],
    onDelete: Cascade
  )

  @@index([userId])
}
```

```ts
import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  isActive: integer("is_active", {
    mode: "boolean",
  })
    .notNull()
    .default(true),

  createdAt: integer("created_at", {
    mode: "timestamp",
  })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    amountCents: integer("amount_cents").notNull(),
    createdAt: integer("created_at", {
      mode: "timestamp",
    })
      .notNull()
      .$defaultFn(() => new Date()),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [index("orders_user_id_idx").on(table.userId)]
);

// Relations
import { relations } from "drizzle-orm";
import { users, orders } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
}));
```

## Create

```ts
const user = await prisma.user.create({
  data: {
    name: "Alice",
    email: "alice@example.com",
    orders: {
      create: [{ amountCents: 1999 }, { amountCents: 4999 }], // Nested
    },
  },
  include: {
    orders: true,
  },
});
```

```ts
import { db } from "./db";
import { users, orders } from "./db/schema";

const result = await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(users)
    .values({
      name: "Alice",
      email: "alice@example.com",
    })
    .returning();

  const newOrders = await tx
    .insert(orders)
    .values([
      { amountCents: 1999, userId: user.id },
      { amountCents: 4999, userId: user.id },
    ])
    .returning();

  return { ...user, orders: newOrders };
});
```

## Query

```ts
const user = await prisma.user.findUnique({
  where: {
    id: 1,
  },
  include: {
    orders: true,
  },
});
```

```ts
const user = await db.query.users.findFirst({
  where: (users, { eq }) => eq(users.id, 1),
  with: {
    orders: true,
  },
});

const result = await db
  .select()
  .from(users)
  .leftJoin(orders, eq(users.id, orders.userId))
  .where(eq(users.id, 1));
```
