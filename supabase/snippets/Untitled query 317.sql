-- Dos restaurantes
insert into restaurants (id, restaurant_name) values
  (1, 'Restaurante A'),
  (2, 'Restaurante B');

-- Una mesa en cada uno
insert into tables (id, table_number, restaurant_id) values
  (1, 1, 1),   -- mesa 1 del restaurante A
  (2, 1, 2);   -- mesa 1 del restaurante B

-- Una orden en cada mesa
insert into orders (id, table_id, restaurant_id, total, status_id, created_at) values
  (1, 1, 1, 5000, 1, now()),   -- orden de la mesa del rest. A
  (2, 2, 2, 9000, 1, now());   -- orden de la mesa del rest. B

-- Items en cada orden
insert into order_items (order_id, product_id, product_name, product_price, product_quantity) values
  (1, 1, 'Cafe A', 5000, 1),
  (2, 2, 'Pizza B', 9000, 1);