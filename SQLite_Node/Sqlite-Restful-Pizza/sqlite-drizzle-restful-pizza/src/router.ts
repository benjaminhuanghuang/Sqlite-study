import { Router } from "express";
import {
  contactForm,
  createOrder,
  getOrder,
  getOrders,
  getPastOrder,
  getPastOrders,
  getPizzaOfTheDay,
  getPizzas,
} from "./controller.ts";

export const router = Router();

router.get("/api/pizzas", getPizzas);
router.get("/api/pizza-of-the-day", getPizzaOfTheDay);
router.get("/api/orders", getOrders);
router.get("/api/order", getOrder);
router.post("/api/order", createOrder);
router.get("/api/past-orders", getPastOrders);
router.get("/api/past-order/:order_id", getPastOrder);
router.post("/api/contact", contactForm);
