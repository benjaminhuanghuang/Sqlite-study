import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const pizzaTypes = sqliteTable("pizza_types", {
  pizzaTypeId: text("pizza_type_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  ingredients: text("ingredients").notNull(),
});

export const pizzas = sqliteTable("pizzas", {
  pizzaId: text("pizza_id").notNull(),
  pizzaTypeId: text("pizza_type_id").notNull(),
  size: text("size").notNull(),
  price: text("price").notNull(),
});

export const orders = sqliteTable("orders", {
  orderId: integer("order_id").primaryKey(),
  date: text("date").notNull(),
  time: text("time").notNull(),
});

export const orderDetails = sqliteTable("order_details", {
  orderDetailsId: integer("order_details_id").primaryKey(),
  orderId: integer("order_id").notNull(),
  pizzaId: text("pizza_id").notNull(),
  quantity: integer("quantity").notNull(),
});
