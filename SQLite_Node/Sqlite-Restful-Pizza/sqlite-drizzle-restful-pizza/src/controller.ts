import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "./db.ts";
import { orderDetails, orders, pizzaTypes, pizzas } from "./schema.ts";
import type { CartItem } from "./types.ts";

export async function getPizzas(req: Request, res: Response) {
  const pizzaRows = await db
    .select({
      pizzaTypeId: pizzaTypes.pizzaTypeId,
      name: pizzaTypes.name,
      category: pizzaTypes.category,
      description: pizzaTypes.ingredients,
    })
    .from(pizzaTypes);

  const pizzaSizeRows = await db
    .select({
      id: pizzas.pizzaTypeId,
      size: pizzas.size,
      price: pizzas.price,
    })
    .from(pizzas);

  const responsePizzas = pizzaRows.map((pizza) => {
    const sizes = pizzaSizeRows.reduce<Record<string, number>>((acc, current) => {
      if (current.id === pizza.pizzaTypeId) {
        acc[current.size] = +current.price;
      }
      return acc;
    }, {});
    return {
      id: pizza.pizzaTypeId,
      name: pizza.name,
      category: pizza.category,
      description: pizza.description,
      image: `/pizzas/${pizza.pizzaTypeId}.webp`,
      sizes,
    };
  });

  res.send(responsePizzas);
}

export async function getPizzaOfTheDay(req: Request, res: Response) {
  const pizzaRows = await db
    .select({
      pizzaTypeId: pizzaTypes.pizzaTypeId,
      name: pizzaTypes.name,
      category: pizzaTypes.category,
      description: pizzaTypes.ingredients,
    })
    .from(pizzaTypes);

  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const pizzaIndex = daysSinceEpoch % pizzaRows.length;
  const pizza = pizzaRows[pizzaIndex];

  const sizeRows = await db
    .select({
      size: pizzas.size,
      price: pizzas.price,
    })
    .from(pizzas)
    .where(eq(pizzas.pizzaTypeId, pizza.pizzaTypeId));

  const sizeObj = sizeRows.reduce<Record<string, number>>((acc, current) => {
    acc[current.size] = +current.price;
    return acc;
  }, {});

  const responsePizza = {
    id: pizza.pizzaTypeId,
    name: pizza.name,
    category: pizza.category,
    description: pizza.description,
    image: `/pizzas/${pizza.pizzaTypeId}.webp`,
    sizes: sizeObj,
  };

  res.send(responsePizza);
}

export async function getOrders(req: Request, res: Response) {
  const rows = await db
    .select({
      order_id: orders.orderId,
      date: orders.date,
      time: orders.time,
    })
    .from(orders);

  res.send(rows);
}

async function fetchOrderItems(orderId: number) {
  const rows = await db
    .select({
      pizzaTypeId: pizzaTypes.pizzaTypeId,
      name: pizzaTypes.name,
      category: pizzaTypes.category,
      description: pizzaTypes.ingredients,
      quantity: orderDetails.quantity,
      price: pizzas.price,
      size: pizzas.size,
    })
    .from(orderDetails)
    .innerJoin(pizzas, eq(orderDetails.pizzaId, pizzas.pizzaId))
    .innerJoin(pizzaTypes, eq(pizzas.pizzaTypeId, pizzaTypes.pizzaTypeId))
    .where(eq(orderDetails.orderId, orderId));

  return rows.map((item) => {
    const price = +item.price;
    return {
      ...item,
      image: `/pizzas/${item.pizzaTypeId}.webp`,
      price,
      total: item.quantity * price,
    };
  });
}

export async function getOrder(req: Request, res: Response) {
  const id = Number(req.query.id);
  const [order] = await db
    .select({
      order_id: orders.orderId,
      date: orders.date,
      time: orders.time,
    })
    .from(orders)
    .where(eq(orders.orderId, id));

  const orderItems = await fetchOrderItems(id);
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
    const orderId = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(orders)
        .values({ date, time })
        .returning({ orderId: orders.orderId });

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
        await tx.insert(orderDetails).values({
          orderId: inserted.orderId,
          pizzaId: item.pizzaId,
          quantity: item.quantity,
        });
      }

      return inserted.orderId;
    });

    res.send({ orderId });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to create order" });
  }
}

export async function getPastOrders(req: Request, res: Response) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const pastOrders = await db
      .select({
        order_id: orders.orderId,
        date: orders.date,
        time: orders.time,
      })
      .from(orders)
      .orderBy(desc(orders.orderId))
      .limit(10)
      .offset(offset);
    res.send(pastOrders);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to fetch past orders" });
  }
}

export async function getPastOrder(req: Request, res: Response) {
  const orderId = Number(req.params.order_id);

  try {
    const [order] = await db
      .select({
        order_id: orders.orderId,
        date: orders.date,
        time: orders.time,
      })
      .from(orders)
      .where(eq(orders.orderId, orderId));

    if (!order) {
      res.status(404).send({ error: "Order not found" });
      return;
    }

    const orderItems = await fetchOrderItems(orderId);
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
