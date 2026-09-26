export interface PizzaTypeRow {
  pizza_type_id: string;
  name: string;
  category: string;
  description: string;
}

export interface PizzaSizeRow {
  id: string;
  size: string;
  price: string;
}

export interface OrderRow {
  order_id: number;
  date: string;
  time: string;
}

export interface OrderItemRow {
  pizzaTypeId: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
  size: string;
}

export interface CartItem {
  pizza: { id: string };
  size: string;
}

declare global {
  namespace Express {
    interface Request {
      log: Console;
    }
  }
}
