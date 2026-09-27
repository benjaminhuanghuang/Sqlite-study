import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * Mimics drizzle's chainable query builder: every chain method (from,
 * innerJoin, where, orderBy, limit, offset, values) returns the same
 * object, and awaiting the chain at any point resolves to `result`
 * (drizzle's real builder is thenable the same way).
 */
function createQuery(result: unknown) {
  const promise = Promise.resolve(result);
  const query: Record<string, unknown> = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    offset: vi.fn(() => query),
    values: vi.fn(() => query),
    returning: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return query;
}

function createDbMock() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  };
}

const dbMock = createDbMock();

vi.mock("./db.ts", () => ({
  db: dbMock,
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
    dbMock.select
      .mockReturnValueOnce(
        createQuery([
          {
            pizzaTypeId: "bbq_ckn",
            name: "The Barbecue Chicken Pizza",
            category: "Chicken",
            description: "BBQ, Chicken",
          },
        ])
      )
      .mockReturnValueOnce(
        createQuery([
          { id: "bbq_ckn", size: "S", price: "12.75" },
          { id: "bbq_ckn", size: "M", price: "16.75" },
        ])
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
    dbMock.select
      .mockReturnValueOnce(
        createQuery([
          {
            pizzaTypeId: "bbq_ckn",
            name: "The Barbecue Chicken Pizza",
            category: "Chicken",
            description: "BBQ, Chicken",
          },
        ])
      )
      .mockReturnValueOnce(createQuery([{ size: "L", price: "20.75" }]));

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
    const orderRows = [{ order_id: 1, date: "2015-01-01", time: "11:38:36" }];
    dbMock.select.mockReturnValueOnce(createQuery(orderRows));

    const req = createMockReq();
    const res = createMockRes();

    await getOrders(req, res);

    expect(res.send).toHaveBeenCalledWith(orderRows);
  });
});

describe("getOrder", () => {
  it("attaches the computed total to the order", async () => {
    dbMock.select
      .mockReturnValueOnce(
        createQuery([{ order_id: 1, date: "2015-01-01", time: "11:38:36" }])
      )
      .mockReturnValueOnce(
        createQuery([
          {
            pizzaTypeId: "hawaiian",
            name: "The Hawaiian Pizza",
            category: "Classic",
            description: "Ham, Pineapple",
            quantity: 1,
            price: "13.25",
            size: "M",
          },
        ])
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
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("merges duplicate cart items and commits the transaction", async () => {
    const insertOrderQuery = createQuery([{ orderId: 42 }]);
    const insertDetailsQuery = createQuery(undefined);
    const txInsert = vi
      .fn()
      .mockReturnValueOnce(insertOrderQuery)
      .mockReturnValue(insertDetailsQuery);
    const tx = { insert: txInsert };

    dbMock.transaction.mockImplementationOnce(async (cb) => cb(tx));

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

    expect(insertDetailsQuery.values).toHaveBeenCalledWith({
      orderId: 42,
      pizzaId: "bbq_ckn_m",
      quantity: 2,
    });
    expect(res.send).toHaveBeenCalledWith({ orderId: 42 });
  });

  it("returns 500 when the transaction fails", async () => {
    dbMock.transaction.mockImplementationOnce(async () => {
      throw new Error("insert failed");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const req = createMockReq({
      body: { cart: [{ pizza: { id: "bbq_ckn" }, size: "M" }] },
    });
    const res = createMockRes();

    await createOrder(req, res);

    expect(consoleError).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({ error: "Failed to create order" });
    consoleError.mockRestore();
  });
});

describe("getPastOrders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("paginates using the requested page", async () => {
    const query = createQuery([]);
    dbMock.select.mockReturnValueOnce(query);

    const req = createMockReq({ query: { page: "3" } });
    const res = createMockRes();

    const pending = getPastOrders(req, res);
    await vi.runAllTimersAsync();
    await pending;

    expect(query.offset).toHaveBeenCalledWith(40);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(res.send).toHaveBeenCalledWith([]);
  });

  it("returns 500 when the query fails", async () => {
    dbMock.select.mockImplementationOnce(() => {
      throw new Error("db down");
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
    dbMock.select.mockReturnValueOnce(createQuery([]));

    const req = createMockReq({ params: { order_id: "999" } });
    const res = createMockRes();

    await getPastOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ error: "Order not found" });
  });

  it("returns the order with its items and total", async () => {
    dbMock.select
      .mockReturnValueOnce(
        createQuery([{ order_id: 1, date: "2015-01-01", time: "11:38:36" }])
      )
      .mockReturnValueOnce(
        createQuery([
          {
            pizzaTypeId: "hawaiian",
            name: "The Hawaiian Pizza",
            category: "Classic",
            description: "Ham, Pineapple",
            quantity: 1,
            price: "13.25",
            size: "M",
          },
        ])
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
