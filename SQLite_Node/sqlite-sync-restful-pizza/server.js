import { DatabaseSync } from "node:sqlite";
import express from "express";

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  req.log = console;
  next();
});

const PORT = process.env.PORT || 3000;

const rawDb = new DatabaseSync("./pizza.sqlite");

app.get("/api/pizzas", async function getPizzas(req, res) {
  const pizzas = rawDb
    .prepare(
      "SELECT pizza_type_id, name, category, ingredients as description FROM pizza_types"
    )
    .all();
  const pizzaSizes = rawDb
    .prepare(
      `SELECT
      pizza_type_id as id, size, price
    FROM
      pizzas
  `
    )
    .all();

  const responsePizzas = pizzas.map((pizza) => {
    const sizes = pizzaSizes.reduce((acc, current) => {
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
});

app.get("/api/pizza-of-the-day", async function getPizzaOfTheDay(req, res) {
  const pizzas = rawDb
    .prepare(
      `SELECT
      pizza_type_id as id, name, category, ingredients as description
    FROM
      pizza_types`
    )
    .all();

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
    .all(pizza.id);

  const sizeObj = sizes.reduce((acc, current) => {
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
});

app.get("/api/orders", async function getOrders(req, res) {
  const id = req.query.id;
  const orders = rawDb.prepare("SELECT order_id, date, time FROM orders").all();

  res.send(orders);
});

app.get("/api/order", async function getOrders(req, res) {
  const id = req.query.id;
  const order = rawDb
    .prepare("SELECT order_id, date, time FROM orders WHERE order_id = ?")
    .get(id);
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
    .all(id);

  const orderItems = orderItemsRes.map((item) =>
    Object.assign({}, item, {
      image: `/pizzas/${item.pizzaTypeId}.webp`,
      quantity: +item.quantity,
      price: +item.price,
    })
  );

  const total = orderItems.reduce((acc, item) => acc + item.total, 0);

  res.send({
    order: Object.assign({ total }, order),
    orderItems,
  });
});

app.post("/api/order", async function createOrder(req, res) {
  const { cart } = req.body;

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

    const mergedCart = cart.reduce((acc, item) => {
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
    req.log.error(error);
    rawDb.prepare("ROLLBACK").run();
    res.status(500).send({ error: "Failed to create order" });
  }
});

app.get("/api/past-orders", async function getPastOrders(req, res) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const pastOrders = rawDb
      .prepare(
        "SELECT order_id, date, time FROM orders ORDER BY order_id DESC LIMIT 10 OFFSET ?"
      )
      .all(offset);
    res.send(pastOrders);
  } catch (error) {
    req.log.error(error);
    res.status(500).send({ error: "Failed to fetch past orders" });
  }
});

app.get("/api/past-order/:order_id", async function getPastOrder(req, res) {
  const orderId = req.params.order_id;

  try {
    const order = rawDb
      .prepare("SELECT order_id, date, time FROM orders WHERE order_id = ?")
      .get(orderId);

    if (!order) {
      res.status(404).send({ error: "Order not found" });
      return;
    }

    const orderItems = rawDb
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
      .all(orderId);

    const formattedOrderItems = orderItems.map((item) =>
      Object.assign({}, item, {
        image: `/pizzas/${item.pizzaTypeId}.webp`,
        quantity: +item.quantity,
        price: +item.price,
      })
    );

    const total = formattedOrderItems.reduce(
      (acc, item) => acc + item.total,
      0
    );

    res.send({
      order: Object.assign({ total }, order),
      orderItems: formattedOrderItems,
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).send({ error: "Failed to fetch order" });
  }
});

app.post("/api/contact", async function contactForm(req, res) {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    res.status(400).send({ error: "All fields are required" });
    return;
  }

  req.log.info(`Contact Form Submission:
    Name: ${name}
    Email: ${email}
    Message: ${message}
  `);

  res.send({ success: "Message received" });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
