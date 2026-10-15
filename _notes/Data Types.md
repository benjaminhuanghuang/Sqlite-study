# SQLite data type

| SQLite data type | 用途                        | 示例               |
| ---------------- | --------------------------- | ------------------ |
| NULL             | 空值                        | NULL               |
| INTEGER          | 整数、布尔值、时间戳等      | 18                 |
| REAL             | 浮点数                      | 3.14               |
| TEXT             | 字符串、日期文本、JSON 文本 | 'Alice'            |
| BLOB             | 二进制数据                  | 图片字节、文件内容 |

## use case

| 业务需求     | SQLite 中常见的选择 | 说明                               |
| ------------ | ------------------- | ---------------------------------- |
| 主键 ID      | INTEGER PRIMARY KEY | 可自动生成整数 ID                  |
| 用户名、邮箱 | TEXT                | 字符串                             |
| 数量、年龄   | INTEGER             | 整数                               |
| 价格、金额   | 整数分值或 NUMERIC  | 金额推荐整数分值，避免浮点误差     |
| 是否启用     | INTEGER             | 通常使用 0 和 1                    |
| 创建时间     | TEXT 或 INTEGER     | ISO 时间文本或 Unix 时间戳         |
| UUID         | TEXT 或 BLOB        | 常见做法是使用文本 UUID            |
| JSON 数据    | TEXT                | 可配合 SQLite JSON 函数            |
| 字符串列表   | TEXT 或独立关联表   | 没有像 PostgreSQL 那样的原生数组列 |
| 图片、文件   | BLOB 或文件系统路径 | 大文件通常放在文件存储中           |

金额不要随意使用浮点数, 使用整数存储最小货币单位
SQLite 项目，最简单稳妥的起点就是：金额用字符串接收、整数美分计算、SQLite INTEGER 保存、字符串格式化展示。

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL
);
```

```ts
function centsToDollars(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("number is invalid");
  }

  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);

  return `${sign}${Math.floor(absolute / 100)}.${String(
    absolute % 100
  ).padStart(2, "0")}`;
}
```
