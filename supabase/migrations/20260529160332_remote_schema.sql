drop extension if exists "pg_net";

drop policy "categories_select" on "public"."categories";

drop policy "Anyone can select order_status" on "public"."order_status";

drop policy "Anyone can insert orders" on "public"."orders";

drop policy "Anyone can select orders" on "public"."orders";

drop policy "products_select" on "public"."products";

drop policy "restaurants_select" on "public"."restaurants";

drop policy "anon can delete cart items" on "public"."table_cart_items";

drop policy "anon can insert cart items" on "public"."table_cart_items";

drop policy "anon can read cart items" on "public"."table_cart_items";

drop policy "anon can update cart items" on "public"."table_cart_items";

drop policy "qr_codes_select" on "public"."table_qr_codes";

drop policy "tables_select" on "public"."tables";


  create policy "categories_select"
  on "public"."categories"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can select order_status"
  on "public"."order_status"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can insert orders"
  on "public"."orders"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Anyone can select orders"
  on "public"."orders"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "products_select"
  on "public"."products"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "restaurants_select"
  on "public"."restaurants"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "anon can delete cart items"
  on "public"."table_cart_items"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "anon can insert cart items"
  on "public"."table_cart_items"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "anon can read cart items"
  on "public"."table_cart_items"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "anon can update cart items"
  on "public"."table_cart_items"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "qr_codes_select"
  on "public"."table_qr_codes"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "tables_select"
  on "public"."tables"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


