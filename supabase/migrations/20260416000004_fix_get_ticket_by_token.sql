-- =============================================================================
-- Correction get_ticket_by_token pour le schéma réel en base :
-- - Table des tickets  : tickets  (et non repair_tickets)
-- - Table des clients  : clients  (avec full_name, et non contacts)
-- - Statuts réels      : pending | in_repair | ready | delivered
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_ticket_by_token(text);

CREATE OR REPLACE FUNCTION public.get_ticket_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id',                 t.id,
    'tracking_token',     t.tracking_token,
    'status',             t.status,
    'device_type',        t.device_type,
    'device_brand',       t.device_brand,
    'device_model',       t.device_model,
    'issue_description',  COALESCE(t.issue_description, t.issue_desc),
    'received_at',        t.received_at,
    'estimated_ready_at', t.estimated_ready_at,
    'intake_channel',     t.intake_channel,
    'shop', jsonb_build_object(
      'name',     s.name,
      'phone',    s.phone,
      'address',  s.address,
      'hours',    s.hours,
      'logo_url', s.logo_url
    )
  )
  INTO v_result
  FROM public.tickets t
  LEFT JOIN public.shops s ON s.id = t.shop_id
  WHERE t.tracking_token = p_token
  LIMIT 1;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ticket_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(text) TO service_role;
