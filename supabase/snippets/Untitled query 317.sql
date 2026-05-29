-- Limpiar todo
delete from order_items;
delete from orders;
delete from tables;
delete from products;
delete from categories;
delete from restaurants;
delete from order_status;
delete from product_status;

-- Estados de orden
insert into order_status (id, status_name) overriding system value values
  (1, 'Nuevo'), (2, 'Preparando'), (3, 'Listo'), (4, 'Pagado');

-- Estado de producto (status_id = 1 = activo, que usa tu código)
insert into product_status (id, status_name) overriding system value values
  (1, 'Activo'), (2, 'Inactivo');

do $$
declare
  rest_a bigint; rest_b bigint;
  cat_a bigint; cat_b bigint;
  prod_a bigint; prod_b bigint;
  mesa_a bigint; mesa_b bigint;
  orden_a bigint; orden_b bigint;
begin
  insert into restaurants (restaurant_name) values ('Restaurante A') returning id into rest_a;
  insert into restaurants (restaurant_name) values ('Restaurante B') returning id into rest_b;

  insert into categories (category_name, restaurant_id) values ('Bebidas A', rest_a) returning id into cat_a;
  insert into categories (category_name, restaurant_id) values ('Comida B', rest_b) returning id into cat_b;

  insert into products (product_name, product_price, category_id, restaurant_id, status_id)
    values ('Cafe A', 5000, cat_a, rest_a, 1) returning id into prod_a;
  insert into products (product_name, product_price, category_id, restaurant_id, status_id)
    values ('Pizza B', 9000, cat_b, rest_b, 1) returning id into prod_b;

  insert into tables (table_number, restaurant_id) values (1, rest_a) returning id into mesa_a;
  insert into tables (table_number, restaurant_id) values (1, rest_b) returning id into mesa_b;

  insert into orders (table_id, restaurant_id, total, status_id, created_at)
    values (mesa_a, rest_a, 5000, 1, now()) returning id into orden_a;
  insert into orders (table_id, restaurant_id, total, status_id, created_at)
    values (mesa_b, rest_b, 9000, 1, now()) returning id into orden_b;

  insert into order_items (order_id, product_id, product_name, product_price, product_quantity)
    values (orden_a, prod_a, 'Cafe A', 5000, 1);
  insert into order_items (order_id, product_id, product_name, product_price, product_quantity)
    values (orden_b, prod_b, 'Pizza B', 9000, 1);

  raise notice 'Mesa A=%, Orden A=% | Mesa B=%, Orden B=%', mesa_a, orden_a, mesa_b, orden_b;
end $$;