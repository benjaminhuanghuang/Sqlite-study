# Pizza order RESTful API

## sync sqlite

```ts
import { DatabaseSync } from "node:sqlite";

export const rawDb = new DatabaseSync("./pizza.sqlite");
```

## async sqlite

```sh
npm i sqlite3 promised-sqlite3"
```

```ts
import { AsyncDatabase } from "promised-sqlite3";

export const rawDb = await AsyncDatabase.open("./pizza.sqlite");
```

## drizzle

https://orm.drizzle.team/docs/sqlite/connect-node-sqlite

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

const client = createClient({ url: "file:./pizza.sqlite" });

export const db = drizzle(client, { schema });
```

## Data table

### pizza_types

| Column        | Type |
| ------------- | ---- |
| pizza_type_id | TEXT |
| name          | TEXT |
| category      | TEXT |
| ingredients   | TEXT |

### pizzas

| Column        | Type |
| ------------- | ---- |
| pizza_id      | TEXT |
| pizza_type_id | TEXT |
| size          | TEXT |
| price         | TEXT |

### orders

| Column   | Type                |
| -------- | ------------------- |
| order_id | INTEGER PRIMARY KEY |
| date     | TEXT                |
| time     | TEXT                |

### order_details

| Column           | Type                |
| ---------------- | ------------------- |
| order_details_id | INTEGER PRIMARY KEY |
| order_id         | INTEGER             |
| pizza_id         | TEXT                |
| quantity         | INTEGER             |
