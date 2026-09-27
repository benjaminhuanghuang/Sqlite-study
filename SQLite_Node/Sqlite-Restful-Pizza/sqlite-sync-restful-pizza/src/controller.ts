import type { Request, Response } from "express";
import { rawDb } from "./db.ts";
import type {
  CartItem,
  OrderItemRow,
  OrderRow,
  PizzaSizeRow,
  PizzaTypeRow,
} from "./types.ts";

export async function getPizzas(req: Request, res: Response) {
  const pizzas = rawDb
    .prepare(
      "SELECT pizza_type_id, name, category, ingredients as description FROM pizza_types"
    )
    .all() as unknown as PizzaTypeRow[];
  const pizzaSizes = rawDb
    .prepare(
      `SELECT
      pizza_type_id as id, size, price
    FROM
      pizzas
  `
    )
    .all() as unknown as PizzaSizeRow[];

  const responsePizzas = pizzas.map((pizza) => {
    const sizes = pizzaSizes.reduce<Record<string, number>>((acc, current) => {
      if (current.id === pizza.pizza_type_id) {
        acc[current.size] = +current.price;
      }
      return acc;
    }, {});
    return {
      id: pizza.pizza_type_id,
      name: pizza.name,
      category: pizza.category,
      description: pizza.description,
      image: `/pizzas/${pizza.pizza_type_id}.webp`,
      sizes,
    };
  });

  res.send(responsePizzas);
}

export async function getPizzaOfTheDay(req: Request, res: Response) {
  const pizzas = rawDb
    .prepare(
      `SELECT
      pizza_type_id as id, name, category, ingredients as description
    FROM
      pizza_types`
    )
    .all() as unknown as (Omit<PizzaTypeRow, "pizza_type_id"> & {
    id: string;
  })[];

  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const pizzaIndex = daysSinceEpoch % pizzas.length;
  const pizza = pizzas[pizzaIndex];

  const sizes = rawDb
    .prepare(
      `SELECT
      size, price
    FROM
      pizzas
    WHERE
      pizza_type_id = ?`
    )
    .all(pizza.id) as unknown as PizzaSizeRow[];

  const sizeObj = sizes.reduce<Record<string, number>>((acc, current) => {
    acc[current.size] = +current.price;
    return acc;
  }, {});

  const responsePizza = {
    id: pizza.id,
    name: pizza.name,
    category: pizza.category,
    description: pizza.description,
    image: `/pizzas/${pizza.id}.webp`,
    sizes: sizeObj,
  };

  res.send(responsePizza);
}

export async function getOrders(req: Request, res: Response) {
  const orders = rawDb
    .prepare("SELECT order_id, date, time FROM orders")
    .all() as unknown as OrderRow[];

  res.send(orders);
}

function fetchOrderItems(orderId: string) {
  const orderItemsRes = rawDb
    .prepare(
      `SELECT
      t.pizza_type_id as pizzaTypeId, t.name, t.category, t.ingredients as description, o.quantity, p.price, o.quantity * p.price as total, p.size
    FROM
      order_details o
    JOIN
      pizzas p
    ON
      o.pizza_id = p.pizza_id
    JOIN
      pizza_types t
    ON
      p.pizza_type_id = t.pizza_type_id
    WHERE
      order_id = ?`
    )
    .all(orderId) as unknown as OrderItemRow[];

  return orderItemsRes.map((item) =>
    Object.assign({}, item, {
      image: `/pizzas/${item.pizzaTypeId}.webp`,
      quantity: +item.quantity,
      price: +item.price,
    })
  );
}

export async function getOrder(req: Request, res: Response) {
  const id = req.query.id as string;
  const order = rawDb
    .prepare("SELECT order_id, date, time FROM orders WHERE order_id = ?")
    .get(id) as unknown as OrderRow | undefined;

  const orderItems = fetchOrderItems(id);
  const total = orderItems.reduce((acc, item) => acc + item.total, 0);

  res.send({
    order: Object.assign({ total }, order),
    orderItems,
  });
}

export async function createOrder(req: Request, res: Response) {
  const { cart } = req.body as { cart: CartItem[] };

  const now = new Date();
  // forgive me Date gods, for I have sinned
  const time = now.toLocaleTimeString("en-US", { hour12: false });
  const date = now.toISOString().split("T")[0];

  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    res.status(400).send({ error: "Invalid order data" });
    return;
  }

  try {
    rawDb.prepare("BEGIN TRANSACTION").run();

    const result = rawDb
      .prepare("INSERT INTO orders (date, time) VALUES (?, ?)")
      .run(date, time);
    const orderId = Number(result.lastInsertRowid);

    const mergedCart = cart.reduce<
      Record<string, { pizzaId: string; quantity: number }>
    >((acc, item) => {
      const id = item.pizza.id;
      const size = item.size.toLowerCase();
      if (!id || !size) {
        throw new Error("Invalid item data");
      }
      const pizzaId = `${id}_${size}`;

      if (!acc[pizzaId]) {
        acc[pizzaId] = { pizzaId, quantity: 1 };
      } else {
        acc[pizzaId].quantity += 1;
      }

      return acc;
    }, {});

    for (const item of Object.values(mergedCart)) {
      const { pizzaId, quantity } = item;
      rawDb
        .prepare(
          "INSERT INTO order_details (order_id, pizza_id, quantity) VALUES (?, ?, ?)"
        )
        .run(orderId, pizzaId, quantity);
    }

    rawDb.prepare("COMMIT").run();

    res.send({ orderId });
  } catch (error) {
    console.error(error);
    rawDb.prepare("ROLLBACK").run();
    res.status(500).send({ error: "Failed to create order" });
  }
}

export async function getPastOrders(req: Request, res: Response) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const pastOrders = rawDb
      .prepare(
        "SELECT order_id, date, time FROM orders ORDER BY order_id DESC LIMIT 10 OFFSET ?"
      )
      .all(offset) as unknown as OrderRow[];
    res.send(pastOrders);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to fetch past orders" });
  }
}

export async function getPastOrder(req: Request, res: Response) {
  const orderId = req.params.order_id as string;

  try {
    const order = rawDb
      .prepare("SELECT order_id, date, time FROM orders WHERE order_id = ?")
      .get(orderId) as unknown as OrderRow | undefined;

    if (!order) {
      res.status(404).send({ error: "Order not found" });
      return;
    }

    const orderItems = fetchOrderItems(orderId);
    const total = orderItems.reduce((acc, item) => acc + item.total, 0);

    res.send({
      order: Object.assign({ total }, order),
      orderItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to fetch order" });
  }
}

export async function contactForm(req: Request, res: Response) {
  const { name, email, message } = req.body as {
    name?: string;
    email?: string;
    message?: string;
  };

  if (!name || !email || !message) {
    res.status(400).send({ error: "All fields are required" });
    return;
  }

  console.info(`Contact Form Submission:
    Name: ${name}
    Email: ${email}
    Message: ${message}
  `);

  res.send({ success: "Message received" });
}
