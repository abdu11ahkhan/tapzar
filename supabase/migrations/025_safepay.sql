-- Card payment through Safepay.
--
-- Orders previously proved payment with an uploaded screenshot that an admin
-- read by hand. These columns hold what the gateway tells us instead: which
-- checkout session the order belongs to, and whether the money actually
-- arrived. payment_proof_url stays for the orders that already used it.
alter table public.orders
  add column if not exists payment_provider text,
  add column if not exists payment_tracker text,
  add column if not exists payment_state text not null default 'unpaid'
    check (payment_state in ('unpaid', 'pending', 'paid', 'failed')),
  add column if not exists paid_at timestamptz;

-- The webhook arrives knowing only the tracker, so it has to find the order
-- by it. Unique because one checkout session settles one order.
create unique index if not exists orders_payment_tracker_idx
  on public.orders (payment_tracker)
  where payment_tracker is not null;

comment on column public.orders.payment_state is
  'unpaid = never went to checkout. pending = sent to the gateway. paid = the gateway confirmed it. failed = the gateway rejected it.';
