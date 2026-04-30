-- Restrict SECURITY DEFINER functions
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;

-- Stripe events: deny all client access (service role bypasses RLS)
create policy "no client access" on public.stripe_events for all using (false) with check (false);
