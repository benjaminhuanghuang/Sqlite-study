import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const dbMock = {
  prepare: vi.fn(),
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

function statement(returnValue: unknown) {
  return {
    all: vi.fn(() => returnValue),
    get: vi.fn(() => returnValue),
    run: vi.fn(() => returnValue),
  };
}

function queueStatements(...returnValues: unknown[]) {
  for (const value of returnValues) {
    dbMock.prepare.mockReturnValueOnce(statement(value));
  }
}

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
    queueStatements(
      [
        {
          pizza_type_id: "bbq_ckn",
          name: "The Barbecue Chicken Pizza",
          category: "Chicken",
          description: "BBQ, Chicken",
        },
      ],
      [
        { id: "bbq_ckn", size: "S", price: "12.75" },
        { id: "bbq_ckn", size: "M", price: "16.75" },
      ]
    );

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
    queueStatements(
      [
        {
          id: "bbq_ckn",
          name: "The Barbecue Chicken Pizza",
          category: "Chicken",
          description: "BBQ, Chicken",
        },
      ],
      [{ size: "L", price: "20.75" }]
    );

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
    queueStatements(orders);

    const req = createMockReq();
    const res = createMockRes();

    await getOrders(req, res);

    expect(res.send).toHaveBeenCalledWith(orders);
  });
});

describe("getOrder", () => {
  it("attaches the computed total to the order", async () => {
    queueStatements(
      { order_id: 1, date: "2015-01-01", time: "11:38:36" },
      [
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
      ]
    );

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
    expect(dbMock.prepare).not.toHaveBeenCalled();
  });

  it("merges duplicate cart items and commits the transaction", async () => {
    queueStatements(
      undefined, // BEGIN TRANSACTION
      { lastInsertRowid: 42 }, // INSERT INTO orders
      undefined, // INSERT INTO order_details
      undefined // COMMIT
    );

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

    expect(dbMock.prepare).toHaveBeenNthCalledWith(
      3,
      "INSERT INTO order_details (order_id, pizza_id, quantity) VALUES (?, ?, ?)"
    );
    expect(res.send).toHaveBeenCalledWith({ orderId: 42 });
  });

  it("rolls back and returns 500 on failure", async () => {
    const beginStmt = statement(undefined);
    const insertStmt = {
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn(() => {
        throw new Error("insert failed");
      }),
    };
    const rollbackStmt = statement(undefined);

    dbMock.prepare
      .mockReturnValueOnce(beginStmt)
      .mockReturnValueOnce(insertStmt)
      .mockReturnValueOnce(rollbackStmt);

    const req = createMockReq({
      body: { cart: [{ pizza: { id: "bbq_ckn" }, size: "M" }] },
    });
    const res = createMockRes();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await createOrder(req, res);

    expect(consoleError).toHaveBeenCalled();
    expect(rollbackStmt.run).toHaveBeenCalled();
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
    queueStatements([]);

    const req = createMockReq({ query: { page: "3" } });
    const res = createMockRes();

    const pending = getPastOrders(req, res);
    await vi.runAllTimersAsync();
    await pending;

    expect(dbMock.prepare).toHaveBeenCalledWith(
      "SELECT order_id, date, time FROM orders ORDER BY order_id DESC LIMIT 10 OFFSET ?"
    );
    const stmt = dbMock.prepare.mock.results[0]?.value;
    expect(stmt.all).toHaveBeenCalledWith(40);
    expect(res.send).toHaveBeenCalledWith([]);
  });

  it("returns 500 when the query fails", async () => {
    dbMock.prepare.mockReturnValueOnce({
      all: vi.fn(() => {
        throw new Error("db down");
      }),
      get: vi.fn(),
      run: vi.fn(),
    });

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
    queueStatements(undefined);

    const req = createMockReq({ params: { order_id: "999" } });
    const res = createMockRes();

    await getPastOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ error: "Order not found" });
  });

  it("returns the order with its items and total", async () => {
    queueStatements(
      { order_id: 1, date: "2015-01-01", time: "11:38:36" },
      [
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
      ]
    );

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
