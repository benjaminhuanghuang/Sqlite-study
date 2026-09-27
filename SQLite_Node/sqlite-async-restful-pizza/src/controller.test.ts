import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const dbMock = {
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
};

vi.mock("./db.ts", () => ({
  rawDb: dbMock,
}));

const {
  contactForm,
  createOrder,
  getOrder,
  getOrders,
  getPastOrder,
  getPastOrders,
  getPizzaOfTheDay,
  getPizzas,
} = await import("./controller.ts");

function createMockRes() {
  const res = {
    status: vi.fn(),
    send: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res as unknown as Response;
}

function createMockReq(overrides: Partial<Request> = {}) {
  return {
    query: {},
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getPizzas", () => {
  it("merges pizza types with their sizes", async () => {
    dbMock.all
      .mockResolvedValueOnce([
        {
          pizza_type_id: "bbq_ckn",
          name: "The Barbecue Chicken Pizza",
          category: "Chicken",
          description: "BBQ, Chicken",
        },
      ])
      .mockResolvedValueOnce([
        { id: "bbq_ckn", size: "S", price: "12.75" },
        { id: "bbq_ckn", size: "M", price: "16.75" },
      ]);

    const req = createMockReq();
    const res = createMockRes();

    await getPizzas(req, res);

    expect(res.send).toHaveBeenCalledWith([
      {
        id: "bbq_ckn",
        name: "The Barbecue Chicken Pizza",
        category: "Chicken",
        description: "BBQ, Chicken",
        image: "/pizzas/bbq_ckn.webp",
        sizes: { S: 12.75, M: 16.75 },
      },
    ]);
  });
});

describe("getPizzaOfTheDay", () => {
  it("picks the pizza for today and attaches its sizes", async () => {
    dbMock.all
      .mockResolvedValueOnce([
        {
          id: "bbq_ckn",
          name: "The Barbecue Chicken Pizza",
          category: "Chicken",
          description: "BBQ, Chicken",
        },
      ])
      .mockResolvedValueOnce([{ size: "L", price: "20.75" }]);

    const req = createMockReq();
    const res = createMockRes();

    await getPizzaOfTheDay(req, res);

    expect(res.send).toHaveBeenCalledWith({
      id: "bbq_ckn",
      name: "The Barbecue Chicken Pizza",
      category: "Chicken",
      description: "BBQ, Chicken",
      image: "/pizzas/bbq_ckn.webp",
      sizes: { L: 20.75 },
    });
  });
});

describe("getOrders", () => {
  it("returns all orders", async () => {
    const orders = [{ order_id: 1, date: "2015-01-01", time: "11:38:36" }];
    dbMock.all.mockResolvedValueOnce(orders);

    const req = createMockReq();
    const res = createMockRes();

    await getOrders(req, res);

    expect(res.send).toHaveBeenCalledWith(orders);
  });
});

describe("getOrder", () => {
  it("attaches the computed total to the order", async () => {
    dbMock.get.mockResolvedValueOnce({
      order_id: 1,
      date: "2015-01-01",
      time: "11:38:36",
    });
    dbMock.all.mockResolvedValueOnce([
      {
        pizzaTypeId: "hawaiian",
        name: "The Hawaiian Pizza",
        category: "Classic",
        description: "Ham, Pineapple",
        quantity: 1,
        price: 13.25,
        total: 13.25,
        size: "M",
      },
    ]);

    const req = createMockReq({ query: { id: "1" } });
    const res = createMockRes();

    await getOrder(req, res);

    expect(res.send).toHaveBeenCalledWith({
      order: {
        order_id: 1,
        date: "2015-01-01",
        time: "11:38:36",
        total: 13.25,
      },
      orderItems: [
        expect.objectContaining({
          pizzaTypeId: "hawaiian",
          image: "/pizzas/hawaiian.webp",
          total: 13.25,
        }),
      ],
    });
  });
});

describe("createOrder", () => {
  it("rejects an empty cart with 400", async () => {
    const req = createMockReq({ body: { cart: [] } });
    const res = createMockRes();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ error: "Invalid order data" });
    expect(dbMock.run).not.toHaveBeenCalled();
  });

  it("merges duplicate cart items and commits the transaction", async () => {
    dbMock.run
      .mockResolvedValueOnce(undefined) // BEGIN TRANSACTION
      .mockResolvedValueOnce({ lastID: 42, changes: 1 }) // INSERT INTO orders
      .mockResolvedValueOnce(undefined) // INSERT INTO order_details
      .mockResolvedValueOnce(undefined); // COMMIT

    const req = createMockReq({
      body: {
        cart: [
          { pizza: { id: "bbq_ckn" }, size: "M" },
          { pizza: { id: "bbq_ckn" }, size: "M" },
        ],
      },
    });
    const res = createMockRes();

    await createOrder(req, res);

    expect(dbMock.run).toHaveBeenNthCalledWith(
      3,
      "INSERT INTO order_details (order_id, pizza_id, quantity) VALUES (?, ?, ?)",
      42,
      "bbq_ckn_m",
      2
    );
    expect(res.send).toHaveBeenCalledWith({ orderId: 42 });
  });

  it("rolls back and returns 500 on failure", async () => {
    dbMock.run
      .mockResolvedValueOnce(undefined) // BEGIN TRANSACTION
      .mockRejectedValueOnce(new Error("insert failed")) // INSERT INTO orders
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const req = createMockReq({
      body: { cart: [{ pizza: { id: "bbq_ckn" }, size: "M" }] },
    });
    const res = createMockRes();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await createOrder(req, res);

    expect(consoleError).toHaveBeenCalled();
    expect(dbMock.run).toHaveBeenCalledWith("ROLLBACK");
    consoleError.mockRestore();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({ error: "Failed to create order" });
  });
});

describe("getPastOrders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("paginates using the requested page", async () => {
    dbMock.all.mockResolvedValueOnce([]);

    const req = createMockReq({ query: { page: "3" } });
    const res = createMockRes();

    const pending = getPastOrders(req, res);
    await vi.runAllTimersAsync();
    await pending;

    expect(dbMock.all).toHaveBeenCalledWith(
      "SELECT order_id, date, time FROM orders ORDER BY order_id DESC LIMIT 10 OFFSET ?",
      40
    );
    expect(res.send).toHaveBeenCalledWith([]);
  });

  it("returns 500 when the query fails", async () => {
    dbMock.all.mockRejectedValueOnce(new Error("db down"));

    const req = createMockReq();
    const res = createMockRes();

    const pending = getPastOrders(req, res);
    await vi.runAllTimersAsync();
    await pending;

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("getPastOrder", () => {
  it("returns 404 when the order does not exist", async () => {
    dbMock.get.mockResolvedValueOnce(undefined);

    const req = createMockReq({ params: { order_id: "999" } });
    const res = createMockRes();

    await getPastOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ error: "Order not found" });
  });

  it("returns the order with its items and total", async () => {
    dbMock.get.mockResolvedValueOnce({
      order_id: 1,
      date: "2015-01-01",
      time: "11:38:36",
    });
    dbMock.all.mockResolvedValueOnce([
      {
        pizzaTypeId: "hawaiian",
        name: "The Hawaiian Pizza",
        category: "Classic",
        description: "Ham, Pineapple",
        quantity: 1,
        price: 13.25,
        total: 13.25,
        size: "M",
      },
    ]);

    const req = createMockReq({ params: { order_id: "1" } });
    const res = createMockRes();

    await getPastOrder(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ order_id: 1, total: 13.25 }),
      })
    );
  });
});

describe("contactForm", () => {
  it("requires name, email and message", async () => {
    const req = createMockReq({ body: { name: "a" } });
    const res = createMockRes();

    await contactForm(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("accepts a complete submission", async () => {
    const req = createMockReq({
      body: { name: "a", email: "a@example.com", message: "hi" },
    });
    const res = createMockRes();

    await contactForm(req, res);

    expect(res.send).toHaveBeenCalledWith({ success: "Message received" });
  });
});
