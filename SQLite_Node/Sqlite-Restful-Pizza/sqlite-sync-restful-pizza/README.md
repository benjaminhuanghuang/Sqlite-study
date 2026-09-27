# Pizza order RESTful API

## Data table

### pizza_types

| Column        | Type |
| ------------- | ---- |
| pizza_type_id | TEXT |
| name          | TEXT |
| category      | TEXT |
| ingredients   | TEXT |

### pizzas

| Column        | Type |
| ------------- | ---- |
| pizza_id      | TEXT |
| pizza_type_id | TEXT |
| size          | TEXT |
| price         | TEXT |

### orders

| Column   | Type                |
| -------- | ------------------- |
| order_id | INTEGER PRIMARY KEY |
| date     | TEXT                |
| time     | TEXT                |

### order_details

| Column           | Type                |
| ---------------- | ------------------- |
| order_details_id | INTEGER PRIMARY KEY |
| order_id         | INTEGER             |
| pizza_id         | TEXT                |
| quantity         | INTEGER             |
