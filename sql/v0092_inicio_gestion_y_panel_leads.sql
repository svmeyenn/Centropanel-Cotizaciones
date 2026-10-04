-- =============================================================================
-- MIGRACIÓN v0092-20261004: inicio_gestion y panel_leads
-- Copia y pega TODO este contenido en el SQL Editor de Supabase y pulsa RUN.
-- =============================================================================

-- =============================================================================
-- 1. ESQUEMA PUBLIC (Producción)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.inicio_gestion(
  p_pais integer DEFAULT NULL,
  p_quien integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mi_id integer;
  v_mi_rol text;
  v_mi_mercado text;
  v_mi_email text;
  v_es_jefe boolean;
  v_quien integer;
  v_emails text[];
  v_hoy_date date;
  v_hoy text;
  v_lunes_date date;
  v_lunes text;
  v_fin_semana_date date;
  v_fin_proxima_date date;
  
  v_agenda json;
  v_conteos json;
  v_sin_contactar json;
  v_sin_seguimiento json;
  v_sin_propietario integer;
  v_cotizaciones json;
  v_resultado json;
BEGIN
  -- 1. Identificar vendedor en sesión
  SELECT id, rol, mercado, email
  INTO v_mi_id, v_mi_rol, v_mi_mercado, v_mi_email
  FROM public.vendedores
  WHERE user_id = auth.uid() AND activo = true
  LIMIT 1;

  IF v_mi_id IS NULL THEN
    v_mi_id := COALESCE(p_quien, 1);
    v_mi_rol := 'Administrador';
  END IF;

  v_es_jefe := (v_mi_rol IN ('Administrador', 'Supervisor', 'Consulta'));

  -- Si es vendedor común, solo puede ver su propia gestión
  IF NOT v_es_jefe THEN
    v_quien := v_mi_id;
  ELSE
    v_quien := p_quien;
  END IF;

  -- Correos asociados a la persona elegida (para filtrar leads en clientify_contactos)
  IF v_quien IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT em)
    INTO v_emails
    FROM (
      SELECT email AS em FROM public.vendedores WHERE id = v_quien AND email IS NOT NULL
      UNION
      SELECT propietario_email AS em FROM public.clientify_contactos 
      WHERE propietario_email IS NOT NULL AND (
        propietario = (SELECT nombre FROM public.vendedores WHERE id = v_quien)
        OR propietario_email = (SELECT email FROM public.vendedores WHERE id = v_quien)
      )
    ) sub;
    
    IF v_emails IS NULL THEN
      v_emails := ARRAY[]::text[];
    END IF;
  ELSE
    v_emails := ARRAY[]::text[];
  END IF;

  -- 2. Fechas de referencia
  v_hoy_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date;
  v_hoy := to_char(v_hoy_date, 'YYYY-MM-DD');
  
  -- Lunes de la semana en curso (ISODOW: 1=Lunes .. 7=Domingo)
  v_lunes_date := (v_hoy_date - ((EXTRACT(ISODOW FROM v_hoy_date)::integer - 1) * INTERVAL '1 day'))::date;
  v_lunes := to_char(v_lunes_date, 'YYYY-MM-DD');
  v_fin_semana_date := (v_lunes_date + INTERVAL '6 days')::date;
  v_fin_proxima_date := (v_lunes_date + INTERVAL '13 days')::date;

  -- 3. Construir la Agenda (leads, cotizaciones y entregas)
  WITH agenda_combinada AS (
    -- Leads con compromisos pendientes
    SELECT 
      'lead'::text AS tipo,
      la.id,
      la.proxima_fecha::text AS fecha,
      la.proxima_accion AS accion,
      la.comentario,
      COALESCE(c.nombre_completo, '(sin nombre)') AS sujeto,
      NULLIF(TRIM(CONCAT_WS(' · ', c.empresa, c.cargo)), '') AS detalle,
      la.id_clientify AS id_ref,
      c.id_pais,
      la.id_responsable,
      v.nombre AS responsable
    FROM public.lead_actividad la
    JOIN public.clientify_contactos c ON c.id_clientify = la.id_clientify
    LEFT JOIN public.vendedores v ON v.id = la.id_responsable
    WHERE la.proxima_accion IS NOT NULL
      AND la.proxima_fecha IS NOT NULL
      AND la.ejecutada_en IS NULL
      AND la.revocada_en IS NULL
      AND la.caducada_en IS NULL
      AND la.proxima_fecha <= v_fin_proxima_date
      AND (p_pais IS NULL OR c.id_pais = p_pais)
      AND (
        v_quien IS NULL 
        OR la.id_responsable = v_quien 
        OR (la.id_responsable IS NULL AND (c.propietario_email = ANY(v_emails) OR v.id = v_quien))
      )

    UNION ALL

    -- Cotizaciones con acciones pendientes
    SELECT 
      'cotizacion'::text AS tipo,
      ca.id,
      ca.proxima_fecha::text AS fecha,
      ca.proxima_accion AS accion,
      ca.comentario,
      COALESCE(cot.num_cotizacion, 'Cotización #' || cot.id::text) AS sujeto,
      COALESCE(e.razon_social, e.contacto, '(sin cliente)') AS detalle,
      ca.id_cotizacion AS id_ref,
      cot.id_pais,
      ca.id_responsable,
      v.nombre AS responsable
    FROM public.cotizacion_actividad ca
    JOIN public.cotizaciones cot ON cot.id = ca.id_cotizacion
    LEFT JOIN public.entidades e ON e.id_entidad = cot.id_cliente
    LEFT JOIN public.vendedores v ON v.id = ca.id_responsable
    WHERE ca.proxima_accion IS NOT NULL
      AND ca.proxima_fecha IS NOT NULL
      AND ca.ejecutada_en IS NULL
      AND ca.caducada_en IS NULL
      AND cot.estado IN ('Borrador', 'Emitida', 'Enviada')
      AND ca.proxima_fecha <= v_fin_proxima_date
      AND (p_pais IS NULL OR cot.id_pais = p_pais)
      AND (
        v_quien IS NULL 
        OR ca.id_responsable = v_quien 
        OR (ca.id_responsable IS NULL AND (cot.id_vendedor = v_quien OR v.id = v_quien))
      )

    UNION ALL

    -- Entregas esperadas de pedidos
    SELECT 
      'entrega'::text AS tipo,
      ped.id,
      ped.fecha_entrega_esperada::text AS fecha,
      'Entrega pedido ' || COALESCE(ped.num_pedido, '#' || ped.id::text) AS accion,
      ped.direccion_despacho AS comentario,
      COALESCE(e.razon_social, 'Pedido ' || COALESCE(ped.num_pedido, ped.id::text)) AS sujeto,
      COALESCE(ped.direccion_despacho, e.contacto) AS detalle,
      ped.id AS id_ref,
      ped.id_pais,
      ped.id_vendedor AS id_responsable,
      v.nombre AS responsable
    FROM public.pedidos ped
    LEFT JOIN public.entidades e ON e.id_entidad = ped.id_cliente
    LEFT JOIN public.vendedores v ON v.id = ped.id_vendedor
    WHERE ped.fecha_entrega_esperada IS NOT NULL
      AND ped.fecha_entrega_efectiva IS NULL
      AND (ped.estado IS NULL OR ped.estado NOT IN ('Anulado', 'Cancelado'))
      AND ped.fecha_entrega_esperada::date <= v_fin_proxima_date
      AND (p_pais IS NULL OR ped.id_pais = p_pais)
      AND (v_quien IS NULL OR ped.id_vendedor = v_quien)
  )
  SELECT 
    COALESCE(json_agg(
      json_build_object(
        'tipo', tipo,
        'id', id,
        'fecha', fecha,
        'accion', accion,
        'comentario', comentario,
        'sujeto', sujeto,
        'detalle', detalle,
        'id_ref', id_ref,
        'id_pais', id_pais,
        'id_responsable', id_responsable,
        'responsable', responsable
      ) ORDER BY fecha ASC, id ASC
    ), '[]'::json),
    json_build_object(
      'atrasado', COUNT(*) FILTER (WHERE fecha < v_hoy),
      'hoy', COUNT(*) FILTER (WHERE fecha = v_hoy),
      'semana', COUNT(*) FILTER (WHERE fecha > v_hoy AND fecha <= to_char(v_fin_semana_date, 'YYYY-MM-DD')),
      'proxima', COUNT(*) FILTER (WHERE fecha > to_char(v_fin_semana_date, 'YYYY-MM-DD') AND fecha <= to_char(v_fin_proxima_date, 'YYYY-MM-DD'))
    )
  INTO v_agenda, v_conteos
  FROM agenda_combinada;

  -- 4. Leads por contactar (cold-lead)
  WITH leads_cold AS (
    SELECT 
      vl.id_clientify,
      vl.nombre_completo,
      vl.creado_clientify::text AS creado_clientify,
      vl.origen,
      vl.campana,
      vl.linea,
      vl.propietario,
      vl.id_pais,
      vl.estado_efectivo,
      vl.ultimo_contacto::text AS ultimo_toque,
      vl.creado_clientify AS fecha_creacion
    FROM public.v_leads vl
    WHERE vl.estado_efectivo = 'cold-lead'
      AND (p_pais IS NULL OR vl.id_pais = p_pais)
      AND (v_quien IS NULL OR vl.propietario_email = ANY(v_emails))
  )
  SELECT json_build_object(
    'n', COUNT(*),
    'n7', COUNT(*) FILTER (WHERE fecha_creacion < (v_hoy_date - INTERVAL '7 days')),
    'lista', COALESCE((
      SELECT json_agg(json_build_object(
        'id_clientify', id_clientify,
        'nombre_completo', nombre_completo,
        'creado_clientify', creado_clientify,
        'origen', origen,
        'campana', campana,
        'linea', linea,
        'propietario', propietario,
        'id_pais', id_pais,
        'estado_efectivo', estado_efectivo,
        'ultimo_toque', ultimo_toque
      ))
      FROM (
        SELECT * FROM leads_cold
        ORDER BY fecha_creacion DESC NULLS LAST
        LIMIT 15
      ) top_cold
    ), '[]'::json)
  )
  INTO v_sin_contactar
  FROM leads_cold;

  -- 5. Leads sin seguimiento (warm-lead, hot-lead, in-deal sin compromiso pendiente)
  WITH leads_sin_seg AS (
    SELECT 
      vl.id_clientify,
      vl.nombre_completo,
      vl.creado_clientify::text AS creado_clientify,
      vl.origen,
      vl.campana,
      vl.linea,
      vl.propietario,
      vl.id_pais,
      vl.estado_efectivo,
      vl.ultimo_contacto::text AS ultimo_toque,
      COALESCE(vl.ultimo_contacto, vl.creado_clientify) AS fecha_orden
    FROM public.v_leads vl
    WHERE vl.estado_efectivo IN ('warm-lead', 'hot-lead', 'in-deal')
      AND (p_pais IS NULL OR vl.id_pais = p_pais)
      AND (v_quien IS NULL OR vl.propietario_email = ANY(v_emails))
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_actividad la
        WHERE la.id_clientify = vl.id_clientify
          AND la.proxima_accion IS NOT NULL
          AND la.ejecutada_en IS NULL
          AND la.revocada_en IS NULL
          AND la.caducada_en IS NULL
      )
  )
  SELECT json_build_object(
    'n', COUNT(*),
    'lista', COALESCE((
      SELECT json_agg(json_build_object(
        'id_clientify', id_clientify,
        'nombre_completo', nombre_completo,
        'creado_clientify', creado_clientify,
        'origen', origen,
        'campana', campana,
        'linea', linea,
        'propietario', propietario,
        'id_pais', id_pais,
        'estado_efectivo', estado_efectivo,
        'ultimo_toque', ultimo_toque
      ))
      FROM (
        SELECT * FROM leads_sin_seg
        ORDER BY fecha_orden ASC NULLS FIRST
        LIMIT 15
      ) top_seg
    ), '[]'::json)
  )
  INTO v_sin_seguimiento
  FROM leads_sin_seg;

  -- 6. Leads sin propietario (solo visible si se mira todo el equipo)
  IF v_quien IS NULL THEN
    SELECT COUNT(*)
    INTO v_sin_propietario
    FROM public.v_leads
    WHERE (propietario_email IS NULL OR TRIM(propietario_email) = '')
      AND estado_efectivo NOT IN ('lost-lead', 'not-qualified-lead', 'lost-client')
      AND (p_pais IS NULL OR id_pais = p_pais);
  ELSE
    v_sin_propietario := NULL;
  END IF;

  -- 7. Cotizaciones en juego (Borrador, Emitida, Enviada)
  WITH cot_en_juego AS (
    SELECT 
      cot.id,
      cot.num_cotizacion,
      cot.estado,
      cot.fecha::date AS fecha,
      cot.fecha::text AS fecha_txt,
      (v_hoy_date - cot.fecha::date)::int AS dias,
      COALESCE(tot.total, 0) AS total,
      COALESCE(p.moneda_base, 'CLP') AS moneda,
      COALESCE(e.razon_social, e.contacto, '(sin cliente)') AS cliente,
      v.nombre AS vendedor,
      cot.id_pais,
      EXISTS (
        SELECT 1 FROM public.cotizacion_actividad ca 
        WHERE ca.id_cotizacion = cot.id 
          AND ca.proxima_accion IS NOT NULL 
          AND ca.ejecutada_en IS NULL 
          AND ca.caducada_en IS NULL
      ) AS tiene_accion
    FROM public.cotizaciones cot
    LEFT JOIN public.v_cotizacion_totales tot ON tot.id = cot.id
    LEFT JOIN public.paises p ON p.id = cot.id_pais
    LEFT JOIN public.entidades e ON e.id_entidad = cot.id_cliente
    LEFT JOIN public.vendedores v ON v.id = cot.id_vendedor
    WHERE cot.estado IN ('Borrador', 'Emitida', 'Enviada')
      AND (p_pais IS NULL OR cot.id_pais = p_pais)
      AND (v_quien IS NULL OR cot.id_vendedor = v_quien)
  ),
  embudo_calc AS (
    SELECT 
      estados.estado,
      COUNT(c.id)::int AS n,
      COALESCE(
        (SELECT jsonb_object_agg(moneda, suma) FROM (
           SELECT moneda, SUM(total) AS suma 
           FROM cot_en_juego 
           WHERE estado = estados.estado 
           GROUP BY moneda
         ) m),
        '{}'::jsonb
      ) AS montos,
      COALESCE(ROUND(AVG(c.dias)), 0)::int AS dias_promedio,
      COALESCE(MAX(c.dias), 0)::int AS dias_maximo
    FROM (VALUES ('Borrador'), ('Emitida'), ('Enviada')) AS estados(estado)
    LEFT JOIN cot_en_juego c ON c.estado = estados.estado
    GROUP BY estados.estado
  ),
  sin_accion_calc AS (
    SELECT 
      COUNT(*)::int AS sin_accion_n,
      COALESCE(
        (SELECT jsonb_object_agg(moneda, suma) FROM (
           SELECT moneda, SUM(total) AS suma 
           FROM cot_en_juego 
           WHERE NOT tiene_accion 
           GROUP BY moneda
         ) m),
        '{}'::jsonb
      ) AS sin_accion_montos,
      COALESCE(
        (SELECT json_agg(json_build_object(
           'id', id,
           'num_cotizacion', num_cotizacion,
           'estado', estado,
           'fecha', fecha_txt,
           'dias', dias,
           'total', total,
           'moneda', moneda,
           'cliente', cliente,
           'vendedor', vendedor,
           'id_pais', id_pais
         ) ORDER BY fecha ASC, id ASC)
         FROM (
           SELECT * FROM cot_en_juego
           WHERE NOT tiene_accion
           ORDER BY fecha ASC, id ASC
           LIMIT 15
         ) top_sin_accion
        ),
        '[]'::json
      ) AS sin_accion
    FROM cot_en_juego
    WHERE NOT tiene_accion
  )
  SELECT json_build_object(
    'embudo', (SELECT json_agg(json_build_object(
      'estado', estado,
      'n', n,
      'montos', montos,
      'dias_promedio', dias_promedio,
      'dias_maximo', dias_maximo
    )) FROM embudo_calc),
    'sin_accion_n', (SELECT sin_accion_n FROM sin_accion_calc),
    'sin_accion_montos', (SELECT sin_accion_montos FROM sin_accion_calc),
    'sin_accion', (SELECT sin_accion FROM sin_accion_calc)
  )
  INTO v_cotizaciones;

  -- 8. Ensamblar JSON de respuesta
  v_resultado := json_build_object(
    'hoy', v_hoy,
    'lunes', v_lunes,
    'quien', v_quien,
    'jefe', v_es_jefe,
    'mis_emails', COALESCE(v_emails, ARRAY[]::text[]),
    'agenda', v_agenda,
    'conteos', v_conteos,
    'sin_contactar', v_sin_contactar,
    'sin_seguimiento', v_sin_seguimiento,
    'sin_propietario', v_sin_propietario,
    'cotizaciones', v_cotizaciones
  );

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inicio_gestion(integer, integer) TO anon, authenticated, service_role;


-- =============================================================================
-- PANEL DE LEADS (Desempeño)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.panel_leads(
  p_pais integer DEFAULT NULL,
  p_mes date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy_date date;
  v_mes_inicio date;
  v_mes_fin date;
  v_mes_ant_inicio date;
  v_mes_ant_fin date;
  v_semanas_desde date;
  v_origenes_top text[];
  
  v_kpi json;
  v_embudo jsonb;
  v_linea jsonb;
  v_semanas json;
  v_equipo json;
  v_origenes json;
  v_cumplimiento json;
  v_resultado json;
BEGIN
  v_hoy_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date;

  IF p_mes IS NULL THEN
    v_mes_inicio := date_trunc('month', v_hoy_date)::date;
  ELSE
    v_mes_inicio := date_trunc('month', p_mes)::date;
  END IF;

  v_mes_fin := (v_mes_inicio + INTERVAL '1 month')::date;
  v_mes_ant_inicio := (v_mes_inicio - INTERVAL '1 month')::date;
  v_mes_ant_fin := v_mes_inicio;

  -- 8 semanas hacia atrás desde el lunes de la semana actual
  v_semanas_desde := (
    v_hoy_date 
    - ((EXTRACT(ISODOW FROM v_hoy_date)::int - 1) * INTERVAL '1 day') 
    - INTERVAL '7 weeks'
  )::date;

  -- 1. Top 4 orígenes por volumen total en el mercado
  SELECT ARRAY_AGG(origen)
  INTO v_origenes_top
  FROM (
    SELECT COALESCE(NULLIF(TRIM(origen), ''), 'Otros') AS origen, COUNT(*) AS n
    FROM public.v_leads
    WHERE (p_pais IS NULL OR id_pais = p_pais)
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 4
  ) sub;

  IF v_origenes_top IS NULL THEN
    v_origenes_top := ARRAY[]::text[];
  END IF;

  -- 2. KPIs del mes
  WITH leads_mercado AS (
    SELECT 
      vl.id_clientify,
      vl.estado_efectivo,
      vl.linea,
      vl.origen,
      vl.propietario,
      vl.propietario_email,
      vl.creado_clientify,
      vl.con_cotizacion_enviada
    FROM public.v_leads vl
    WHERE (p_pais IS NULL OR vl.id_pais = p_pais)
  ),
  calc_kpi AS (
    SELECT 
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE creado_clientify >= v_mes_inicio AND creado_clientify < v_mes_fin)::int AS nuevos_mes,
      COUNT(*) FILTER (WHERE creado_clientify >= v_mes_ant_inicio AND creado_clientify < v_mes_ant_fin)::int AS nuevos_ant,
      COUNT(*) FILTER (
        WHERE creado_clientify >= v_mes_inicio 
          AND creado_clientify < v_mes_fin 
          AND (estado_efectivo IN ('in-deal', 'client') OR con_cotizacion_enviada = true)
      )::int AS cohorte_oportunidad,
      COUNT(*) FILTER (WHERE estado_efectivo = 'cold-lead')::int AS sin_contactar,
      COUNT(*) FILTER (
        WHERE estado_efectivo = 'cold-lead' 
          AND creado_clientify < (v_hoy_date - INTERVAL '7 days')
      )::int AS sin_contactar_7d,
      COUNT(*) FILTER (
        WHERE estado_efectivo IN ('warm-lead', 'hot-lead', 'in-deal')
          AND NOT EXISTS (
            SELECT 1 FROM public.lead_actividad la 
            WHERE la.id_clientify = leads_mercado.id_clientify 
              AND la.proxima_accion IS NOT NULL 
              AND la.ejecutada_en IS NULL 
              AND la.revocada_en IS NULL 
              AND la.caducada_en IS NULL
          )
      )::int AS sin_seguimiento
    FROM leads_mercado
  )
  SELECT json_build_object(
    'total', k.total,
    'nuevos_mes', k.nuevos_mes,
    'nuevos_ant', k.nuevos_ant,
    'cohorte_oportunidad', k.cohorte_oportunidad,
    'sin_contactar', k.sin_contactar,
    'sin_contactar_7d', k.sin_contactar_7d,
    'sin_seguimiento', k.sin_seguimiento,
    'compromisos_vencidos', (
      SELECT COUNT(*)::int 
      FROM public.lead_actividad la
      JOIN public.clientify_contactos cc ON cc.id_clientify = la.id_clientify
      WHERE (p_pais IS NULL OR cc.id_pais = p_pais)
        AND la.proxima_accion IS NOT NULL
        AND la.proxima_fecha < v_hoy_date
        AND la.ejecutada_en IS NULL
        AND la.revocada_en IS NULL
        AND la.caducada_en IS NULL
    )
  )
  INTO v_kpi
  FROM calc_kpi k;

  -- 3. Embudo por estado
  SELECT COALESCE(
    jsonb_object_agg(COALESCE(estado_efectivo, 'other'), n),
    '{}'::jsonb
  )
  INTO v_embudo
  FROM (
    SELECT estado_efectivo, COUNT(*)::int AS n
    FROM public.v_leads
    WHERE (p_pais IS NULL OR id_pais = p_pais)
    GROUP BY estado_efectivo
  ) emb;

  -- 4. Líneas (paneles / casas)
  SELECT COALESCE(
    jsonb_object_agg(COALESCE(linea, 'paneles'), n),
    '{}'::jsonb
  )
  INTO v_linea
  FROM (
    SELECT linea, COUNT(*)::int AS n
    FROM public.v_leads
    WHERE (p_pais IS NULL OR id_pais = p_pais)
    GROUP BY linea
  ) lin;

  -- 5. Semanas (últimas 8 semanas)
  WITH sem_series AS (
    SELECT (v_semanas_desde + (i * INTERVAL '7 days'))::date AS sem_lunes
    FROM generate_series(0, 7) AS i
  ),
  leads_sem AS (
    SELECT 
      (date_trunc('week', creado_clientify AT TIME ZONE 'America/Santiago'))::date AS sem_lunes,
      CASE 
        WHEN origen = ANY(v_origenes_top) THEN origen 
        ELSE 'Otros' 
      END AS origen_cat,
      COUNT(*)::int AS n
    FROM public.v_leads
    WHERE (p_pais IS NULL OR id_pais = p_pais)
      AND creado_clientify >= v_semanas_desde
    GROUP BY 1, 2
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'semana', to_char(s.sem_lunes, 'YYYY-MM-DD'),
        'total', COALESCE((SELECT SUM(n)::int FROM leads_sem WHERE sem_lunes = s.sem_lunes), 0),
        'por_origen', COALESCE(
          (SELECT jsonb_object_agg(origen_cat, n) FROM leads_sem WHERE sem_lunes = s.sem_lunes),
          '{}'::jsonb
        )
      ) ORDER BY s.sem_lunes ASC
    ),
    '[]'::json
  )
  INTO v_semanas
  FROM sem_series s;

  -- 6. Equipo de leads
  WITH equipo_leads AS (
    SELECT 
      COALESCE(vl.propietario, 'Sin propietario') AS propietario,
      COUNT(*)::int AS asignados,
      COUNT(*) FILTER (WHERE vl.creado_clientify >= v_mes_inicio AND vl.creado_clientify < v_mes_fin)::int AS nuevos_mes,
      COUNT(*) FILTER (WHERE vl.estado_efectivo = 'cold-lead')::int AS sin_contactar,
      COUNT(*) FILTER (WHERE vl.estado_efectivo = 'warm-lead')::int AS contactados,
      COUNT(*) FILTER (WHERE vl.estado_efectivo IN ('hot-lead', 'in-deal', 'client') OR vl.con_cotizacion_enviada = true)::int AS oportunidades,
      COUNT(*) FILTER (WHERE vl.estado_efectivo IN ('lost-lead', 'not-qualified-lead', 'lost-client'))::int AS perdidos,
      COUNT(*) FILTER (
        WHERE vl.estado_efectivo IN ('warm-lead', 'hot-lead', 'in-deal')
          AND NOT EXISTS (
            SELECT 1 FROM public.lead_actividad la 
            WHERE la.id_clientify = vl.id_clientify 
              AND la.proxima_accion IS NOT NULL 
              AND la.ejecutada_en IS NULL 
              AND la.revocada_en IS NULL 
              AND la.caducada_en IS NULL
          )
      )::int AS sin_seguimiento,
      (
        SELECT COUNT(*)::int 
        FROM public.lead_actividad la
        JOIN public.clientify_contactos cc ON cc.id_clientify = la.id_clientify
        WHERE (p_pais IS NULL OR cc.id_pais = p_pais)
          AND (cc.propietario = vl.propietario OR (cc.propietario IS NULL AND vl.propietario IS NULL))
          AND la.proxima_accion IS NOT NULL
          AND la.proxima_fecha < v_hoy_date
          AND la.ejecutada_en IS NULL
          AND la.revocada_en IS NULL
          AND la.caducada_en IS NULL
      ) AS compromisos_vencidos
    FROM public.v_leads vl
    WHERE (p_pais IS NULL OR vl.id_pais = p_pais)
    GROUP BY COALESCE(vl.propietario, 'Sin propietario'), vl.propietario
    ORDER BY asignados DESC
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'propietario', propietario,
        'asignados', asignados,
        'nuevos_mes', nuevos_mes,
        'sin_contactar', sin_contactar,
        'contactados', contactados,
        'oportunidades', oportunidades,
        'perdidos', perdidos,
        'sin_seguimiento', sin_seguimiento,
        'compromisos_vencidos', compromisos_vencidos
      )
    ),
    '[]'::json
  )
  INTO v_equipo
  FROM equipo_leads;

  -- 7. Rendimiento por origen
  WITH origenes_calc AS (
    SELECT 
      COALESCE(NULLIF(TRIM(origen), ''), 'Sin origen') AS origen,
      COUNT(*)::int AS n,
      COUNT(*) FILTER (WHERE estado_efectivo IN ('in-deal', 'client') OR con_cotizacion_enviada = true)::int AS oportunidades
    FROM public.v_leads
    WHERE (p_pais IS NULL OR id_pais = p_pais)
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 20
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'origen', origen,
        'n', n,
        'oportunidades', oportunidades
      )
    ),
    '[]'::json
  )
  INTO v_origenes
  FROM origenes_calc;

  -- 8. Cumplimiento de compromisos con leads para el mes
  WITH cumpl_calc AS (
    SELECT 
      v.id AS id_vendedor,
      v.nombre AS vendedor,
      COUNT(la.id)::int AS comprometidas,
      COUNT(*) FILTER (WHERE la.ejecutada_en IS NOT NULL AND la.ejecutada_en::date <= la.proxima_fecha)::int AS a_tiempo,
      COUNT(*) FILTER (WHERE la.ejecutada_en IS NOT NULL AND la.ejecutada_en::date > la.proxima_fecha)::int AS tarde,
      COUNT(*) FILTER (WHERE la.caducada_en IS NOT NULL)::int AS caducadas,
      COUNT(*) FILTER (WHERE la.ejecutada_en IS NULL AND la.revocada_en IS NULL AND la.caducada_en IS NULL)::int AS pendientes
    FROM public.lead_actividad la
    JOIN public.clientify_contactos cc ON cc.id_clientify = la.id_clientify
    JOIN public.vendedores v ON v.id = COALESCE(la.id_responsable, la.id_vendedor)
    WHERE (p_pais IS NULL OR cc.id_pais = p_pais)
      AND la.proxima_accion IS NOT NULL
      AND la.proxima_fecha >= v_mes_inicio
      AND la.proxima_fecha < v_mes_fin
    GROUP BY v.id, v.nombre
    ORDER BY comprometidas DESC
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id_vendedor', id_vendedor,
        'vendedor', vendedor,
        'comprometidas', comprometidas,
        'a_tiempo', a_tiempo,
        'tarde', tarde,
        'caducadas', caducadas,
        'pendientes', pendientes
      )
    ),
    '[]'::json
  )
  INTO v_cumplimiento
  FROM cumpl_calc;

  -- 9. Ensamblar JSON de respuesta
  v_resultado := json_build_object(
    'mes', to_char(v_mes_inicio, 'YYYY-MM'),
    'kpi', v_kpi,
    'embudo', v_embudo,
    'linea', v_linea,
    'semanas', v_semanas,
    'semanas_desde', to_char(v_semanas_desde, 'YYYY-MM-DD'),
    'origenes_top', v_origenes_top,
    'equipo', v_equipo,
    'origenes', v_origenes,
    'cumplimiento', v_cumplimiento
  );

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.panel_leads(integer, date) TO anon, authenticated, service_role;


-- =============================================================================
-- 2. ESQUEMA SANDBOX (Ambiente de pruebas)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS sandbox;

CREATE OR REPLACE FUNCTION sandbox.inicio_gestion(
  p_pais integer DEFAULT NULL,
  p_quien integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, pg_temp
AS $$
DECLARE
  v_mi_id integer;
  v_mi_rol text;
  v_mi_mercado text;
  v_mi_email text;
  v_es_jefe boolean;
  v_quien integer;
  v_emails text[];
  v_hoy_date date;
  v_hoy text;
  v_lunes_date date;
  v_lunes text;
  v_fin_semana_date date;
  v_fin_proxima_date date;
  
  v_agenda json;
  v_conteos json;
  v_sin_contactar json;
  v_sin_seguimiento json;
  v_sin_propietario integer;
  v_cotizaciones json;
  v_resultado json;
BEGIN
  SELECT id, rol, mercado, email
  INTO v_mi_id, v_mi_rol, v_mi_mercado, v_mi_email
  FROM sandbox.vendedores
  WHERE user_id = auth.uid() AND activo = true
  LIMIT 1;

  IF v_mi_id IS NULL THEN
    v_mi_id := COALESCE(p_quien, 1);
    v_mi_rol := 'Administrador';
  END IF;

  v_es_jefe := (v_mi_rol IN ('Administrador', 'Supervisor', 'Consulta'));

  IF NOT v_es_jefe THEN
    v_quien := v_mi_id;
  ELSE
    v_quien := p_quien;
  END IF;

  IF v_quien IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT em)
    INTO v_emails
    FROM (
      SELECT email AS em FROM sandbox.vendedores WHERE id = v_quien AND email IS NOT NULL
      UNION
      SELECT propietario_email AS em FROM sandbox.clientify_contactos 
      WHERE propietario_email IS NOT NULL AND (
        propietario = (SELECT nombre FROM sandbox.vendedores WHERE id = v_quien)
        OR propietario_email = (SELECT email FROM sandbox.vendedores WHERE id = v_quien)
      )
    ) sub;
    
    IF v_emails IS NULL THEN
      v_emails := ARRAY[]::text[];
    END IF;
  ELSE
    v_emails := ARRAY[]::text[];
  END IF;

  v_hoy_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date;
  v_hoy := to_char(v_hoy_date, 'YYYY-MM-DD');
  
  v_lunes_date := (v_hoy_date - ((EXTRACT(ISODOW FROM v_hoy_date)::integer - 1) * INTERVAL '1 day'))::date;
  v_lunes := to_char(v_lunes_date, 'YYYY-MM-DD');
  v_fin_semana_date := (v_lunes_date + INTERVAL '6 days')::date;
  v_fin_proxima_date := (v_lunes_date + INTERVAL '13 days')::date;

  WITH agenda_combinada AS (
    SELECT 
      'lead'::text AS tipo,
      la.id,
      la.proxima_fecha::text AS fecha,
      la.proxima_accion AS accion,
      la.comentario,
      COALESCE(c.nombre_completo, '(sin nombre)') AS sujeto,
      NULLIF(TRIM(CONCAT_WS(' · ', c.empresa, c.cargo)), '') AS detalle,
      la.id_clientify AS id_ref,
      c.id_pais,
      la.id_responsable,
      v.nombre AS responsable
    FROM sandbox.lead_actividad la
    JOIN sandbox.clientify_contactos c ON c.id_clientify = la.id_clientify
    LEFT JOIN sandbox.vendedores v ON v.id = la.id_responsable
    WHERE la.proxima_accion IS NOT NULL
      AND la.proxima_fecha IS NOT NULL
      AND la.ejecutada_en IS NULL
      AND la.revocada_en IS NULL
      AND la.caducada_en IS NULL
      AND la.proxima_fecha <= v_fin_proxima_date
      AND (p_pais IS NULL OR c.id_pais = p_pais)
      AND (
        v_quien IS NULL 
        OR la.id_responsable = v_quien 
        OR (la.id_responsable IS NULL AND (c.propietario_email = ANY(v_emails) OR v.id = v_quien))
      )

    UNION ALL

    SELECT 
      'cotizacion'::text AS tipo,
      ca.id,
      ca.proxima_fecha::text AS fecha,
      ca.proxima_accion AS accion,
      ca.comentario,
      COALESCE(cot.num_cotizacion, 'Cotización #' || cot.id::text) AS sujeto,
      COALESCE(e.razon_social, e.contacto, '(sin cliente)') AS detalle,
      ca.id_cotizacion AS id_ref,
      cot.id_pais,
      ca.id_responsable,
      v.nombre AS responsable
    FROM sandbox.cotizacion_actividad ca
    JOIN sandbox.cotizaciones cot ON cot.id = ca.id_cotizacion
    LEFT JOIN sandbox.entidades e ON e.id_entidad = cot.id_cliente
    LEFT JOIN sandbox.vendedores v ON v.id = ca.id_responsable
    WHERE ca.proxima_accion IS NOT NULL
      AND ca.proxima_fecha IS NOT NULL
      AND ca.ejecutada_en IS NULL
      AND ca.caducada_en IS NULL
      AND cot.estado IN ('Borrador', 'Emitida', 'Enviada')
      AND ca.proxima_fecha <= v_fin_proxima_date
      AND (p_pais IS NULL OR cot.id_pais = p_pais)
      AND (
        v_quien IS NULL 
        OR ca.id_responsable = v_quien 
        OR (ca.id_responsable IS NULL AND (cot.id_vendedor = v_quien OR v.id = v_quien))
      )

    UNION ALL

    SELECT 
      'entrega'::text AS tipo,
      ped.id,
      ped.fecha_entrega_esperada::text AS fecha,
      'Entrega pedido ' || COALESCE(ped.num_pedido, '#' || ped.id::text) AS accion,
      ped.direccion_despacho AS comentario,
      COALESCE(e.razon_social, 'Pedido ' || COALESCE(ped.num_pedido, ped.id::text)) AS sujeto,
      COALESCE(ped.direccion_despacho, e.contacto) AS detalle,
      ped.id AS id_ref,
      ped.id_pais,
      ped.id_vendedor AS id_responsable,
      v.nombre AS responsable
    FROM sandbox.pedidos ped
    LEFT JOIN sandbox.entidades e ON e.id_entidad = ped.id_cliente
    LEFT JOIN sandbox.vendedores v ON v.id = ped.id_vendedor
    WHERE ped.fecha_entrega_esperada IS NOT NULL
      AND ped.fecha_entrega_efectiva IS NULL
      AND (ped.estado IS NULL OR ped.estado NOT IN ('Anulado', 'Cancelado'))
      AND ped.fecha_entrega_esperada::date <= v_fin_proxima_date
      AND (p_pais IS NULL OR ped.id_pais = p_pais)
      AND (v_quien IS NULL OR ped.id_vendedor = v_quien)
  )
  SELECT 
    COALESCE(json_agg(
      json_build_object(
        'tipo', tipo,
        'id', id,
        'fecha', fecha,
        'accion', accion,
        'comentario', comentario,
        'sujeto', sujeto,
        'detalle', detalle,
        'id_ref', id_ref,
        'id_pais', id_pais,
        'id_responsable', id_responsable,
        'responsable', responsable
      ) ORDER BY fecha ASC, id ASC
    ), '[]'::json),
    json_build_object(
      'atrasado', COUNT(*) FILTER (WHERE fecha < v_hoy),
      'hoy', COUNT(*) FILTER (WHERE fecha = v_hoy),
      'semana', COUNT(*) FILTER (WHERE fecha > v_hoy AND fecha <= to_char(v_fin_semana_date, 'YYYY-MM-DD')),
      'proxima', COUNT(*) FILTER (WHERE fecha > to_char(v_fin_semana_date, 'YYYY-MM-DD') AND fecha <= to_char(v_fin_proxima_date, 'YYYY-MM-DD'))
    )
  INTO v_agenda, v_conteos
  FROM agenda_combinada;

  WITH leads_cold AS (
    SELECT 
      vl.id_clientify,
      vl.nombre_completo,
      vl.creado_clientify::text AS creado_clientify,
      vl.origen,
      vl.campana,
      vl.linea,
      vl.propietario,
      vl.id_pais,
      vl.estado_efectivo,
      vl.ultimo_contacto::text AS ultimo_toque,
      vl.creado_clientify AS fecha_creacion
    FROM sandbox.v_leads vl
    WHERE vl.estado_efectivo = 'cold-lead'
      AND (p_pais IS NULL OR vl.id_pais = p_pais)
      AND (v_quien IS NULL OR vl.propietario_email = ANY(v_emails))
  )
  SELECT json_build_object(
    'n', COUNT(*),
    'n7', COUNT(*) FILTER (WHERE fecha_creacion < (v_hoy_date - INTERVAL '7 days')),
    'lista', COALESCE((
      SELECT json_agg(json_build_object(
        'id_clientify', id_clientify,
        'nombre_completo', nombre_completo,
        'creado_clientify', creado_clientify,
        'origen', origen,
        'campana', campana,
        'linea', linea,
        'propietario', propietario,
        'id_pais', id_pais,
        'estado_efectivo', estado_efectivo,
        'ultimo_toque', ultimo_toque
      ))
      FROM (
        SELECT * FROM leads_cold
        ORDER BY fecha_creacion DESC NULLS LAST
        LIMIT 15
      ) top_cold
    ), '[]'::json)
  )
  INTO v_sin_contactar
  FROM leads_cold;

  WITH leads_sin_seg AS (
    SELECT 
      vl.id_clientify,
      vl.nombre_completo,
      vl.creado_clientify::text AS creado_clientify,
      vl.origen,
      vl.campana,
      vl.linea,
      vl.propietario,
      vl.id_pais,
      vl.estado_efectivo,
      vl.ultimo_contacto::text AS ultimo_toque,
      COALESCE(vl.ultimo_contacto, vl.creado_clientify) AS fecha_orden
    FROM sandbox.v_leads vl
    WHERE vl.estado_efectivo IN ('warm-lead', 'hot-lead', 'in-deal')
      AND (p_pais IS NULL OR vl.id_pais = p_pais)
      AND (v_quien IS NULL OR vl.propietario_email = ANY(v_emails))
      AND NOT EXISTS (
        SELECT 1 FROM sandbox.lead_actividad la
        WHERE la.id_clientify = vl.id_clientify
          AND la.proxima_accion IS NOT NULL
          AND la.ejecutada_en IS NULL
          AND la.revocada_en IS NULL
          AND la.caducada_en IS NULL
      )
  )
  SELECT json_build_object(
    'n', COUNT(*),
    'lista', COALESCE((
      SELECT json_agg(json_build_object(
        'id_clientify', id_clientify,
        'nombre_completo', nombre_completo,
        'creado_clientify', creado_clientify,
        'origen', origen,
        'campana', campana,
        'linea', linea,
        'propietario', propietario,
        'id_pais', id_pais,
        'estado_efectivo', estado_efectivo,
        'ultimo_toque', ultimo_toque
      ))
      FROM (
        SELECT * FROM leads_sin_seg
        ORDER BY fecha_orden ASC NULLS FIRST
        LIMIT 15
      ) top_seg
    ), '[]'::json)
  )
  INTO v_sin_seguimiento
  FROM leads_sin_seg;

  IF v_quien IS NULL THEN
    SELECT COUNT(*)
    INTO v_sin_propietario
    FROM sandbox.v_leads
    WHERE (propietario_email IS NULL OR TRIM(propietario_email) = '')
      AND estado_efectivo NOT IN ('lost-lead', 'not-qualified-lead', 'lost-client')
      AND (p_pais IS NULL OR id_pais = p_pais);
  ELSE
    v_sin_propietario := NULL;
  END IF;

  WITH cot_en_juego AS (
    SELECT 
      cot.id,
      cot.num_cotizacion,
      cot.estado,
      cot.fecha::date AS fecha,
      cot.fecha::text AS fecha_txt,
      (v_hoy_date - cot.fecha::date)::int AS dias,
      COALESCE(tot.total, 0) AS total,
      COALESCE(p.moneda_base, 'CLP') AS moneda,
      COALESCE(e.razon_social, e.contacto, '(sin cliente)') AS cliente,
      v.nombre AS vendedor,
      cot.id_pais,
      EXISTS (
        SELECT 1 FROM sandbox.cotizacion_actividad ca 
        WHERE ca.id_cotizacion = cot.id 
          AND ca.proxima_accion IS NOT NULL 
          AND ca.ejecutada_en IS NULL 
          AND ca.caducada_en IS NULL
      ) AS tiene_accion
    FROM sandbox.cotizaciones cot
    LEFT JOIN sandbox.v_cotizacion_totales tot ON tot.id = cot.id
    LEFT JOIN sandbox.paises p ON p.id = cot.id_pais
    LEFT JOIN sandbox.entidades e ON e.id_entidad = cot.id_cliente
    LEFT JOIN sandbox.vendedores v ON v.id = cot.id_vendedor
    WHERE cot.estado IN ('Borrador', 'Emitida', 'Enviada')
      AND (p_pais IS NULL OR cot.id_pais = p_pais)
      AND (v_quien IS NULL OR cot.id_vendedor = v_quien)
  ),
  embudo_calc AS (
    SELECT 
      estados.estado,
      COUNT(c.id)::int AS n,
      COALESCE(
        (SELECT jsonb_object_agg(moneda, suma) FROM (
           SELECT moneda, SUM(total) AS suma 
           FROM cot_en_juego 
           WHERE estado = estados.estado 
           GROUP BY moneda
         ) m),
        '{}'::jsonb
      ) AS montos,
      COALESCE(ROUND(AVG(c.dias)), 0)::int AS dias_promedio,
      COALESCE(MAX(c.dias), 0)::int AS dias_maximo
    FROM (VALUES ('Borrador'), ('Emitida'), ('Enviada')) AS estados(estado)
    LEFT JOIN cot_en_juego c ON c.estado = estados.estado
    GROUP BY estados.estado
  ),
  sin_accion_calc AS (
    SELECT 
      COUNT(*)::int AS sin_accion_n,
      COALESCE(
        (SELECT jsonb_object_agg(moneda, suma) FROM (
           SELECT moneda, SUM(total) AS suma 
           FROM cot_en_juego 
           WHERE NOT tiene_accion 
           GROUP BY moneda
         ) m),
        '{}'::jsonb
      ) AS sin_accion_montos,
      COALESCE(
        (SELECT json_agg(json_build_object(
           'id', id,
           'num_cotizacion', num_cotizacion,
           'estado', estado,
           'fecha', fecha_txt,
           'dias', dias,
           'total', total,
           'moneda', moneda,
           'cliente', cliente,
           'vendedor', vendedor,
           'id_pais', id_pais
         ) ORDER BY fecha ASC, id ASC)
         FROM (
           SELECT * FROM cot_en_juego
           WHERE NOT tiene_accion
           ORDER BY fecha ASC, id ASC
           LIMIT 15
         ) top_sin_accion
        ),
        '[]'::json
      ) AS sin_accion
    FROM cot_en_juego
    WHERE NOT tiene_accion
  )
  SELECT json_build_object(
    'embudo', (SELECT json_agg(json_build_object(
      'estado', estado,
      'n', n,
      'montos', montos,
      'dias_promedio', dias_promedio,
      'dias_maximo', dias_maximo
    )) FROM embudo_calc),
    'sin_accion_n', (SELECT sin_accion_n FROM sin_accion_calc),
    'sin_accion_montos', (SELECT sin_accion_montos FROM sin_accion_calc),
    'sin_accion', (SELECT sin_accion FROM sin_accion_calc)
  )
  INTO v_cotizaciones;

  v_resultado := json_build_object(
    'hoy', v_hoy,
    'lunes', v_lunes,
    'quien', v_quien,
    'jefe', v_es_jefe,
    'mis_emails', COALESCE(v_emails, ARRAY[]::text[]),
    'agenda', v_agenda,
    'conteos', v_conteos,
    'sin_contactar', v_sin_contactar,
    'sin_seguimiento', v_sin_seguimiento,
    'sin_propietario', v_sin_propietario,
    'cotizaciones', v_cotizaciones
  );

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION sandbox.inicio_gestion(integer, integer) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION sandbox.panel_leads(
  p_pais integer DEFAULT NULL,
  p_mes date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sandbox, pg_temp
AS $$
DECLARE
  v_hoy_date date;
  v_mes_inicio date;
  v_mes_fin date;
  v_mes_ant_inicio date;
  v_mes_ant_fin date;
  v_semanas_desde date;
  v_origenes_top text[];
  
  v_kpi json;
  v_embudo jsonb;
  v_linea jsonb;
  v_semanas json;
  v_equipo json;
  v_origenes json;
  v_cumplimiento json;
  v_resultado json;
BEGIN
  v_hoy_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date;

  IF p_mes IS NULL THEN
    v_mes_inicio := date_trunc('month', v_hoy_date)::date;
  ELSE
    v_mes_inicio := date_trunc('month', p_mes)::date;
  END IF;

  v_mes_fin := (v_mes_inicio + INTERVAL '1 month')::date;
  v_mes_ant_inicio := (v_mes_inicio - INTERVAL '1 month')::date;
  v_mes_ant_fin := v_mes_inicio;

  v_semanas_desde := (
    v_hoy_date 
    - ((EXTRACT(ISODOW FROM v_hoy_date)::int - 1) * INTERVAL '1 day') 
    - INTERVAL '7 weeks'
  )::date;

  SELECT ARRAY_AGG(origen)
  INTO v_origenes_top
  FROM (
    SELECT COALESCE(NULLIF(TRIM(origen), ''), 'Otros') AS origen, COUNT(*) AS n
    FROM sandbox.v_leads
    WHERE (p_pais IS NULL OR id_pais = p_pais)
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 4
  ) sub;

  IF v_origenes_top IS NULL THEN
    v_origenes_top := ARRAY[]::text[];
  END IF;

  WITH leads_mercado AS (
    SELECT 
      vl.id_clientify,
      vl.estado_efectivo,
      vl.linea,
      vl.origen,
      vl.propietario,
      vl.propietario_email,
      vl.creado_clientify,
      vl.con_cotizacion_enviada
    FROM sandbox.v_leads vl
    WHERE (p_pais IS NULL OR vl.id_pais = p_pais)
  ),
  calc_kpi AS (
    SELECT 
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE creado_clientify >= v_mes_inicio AND creado_clientify < v_mes_fin)::int AS nuevos_mes,
      COUNT(*) FILTER (WHERE creado_clientify >= v_mes_ant_inicio AND creado_clientify < v_mes_ant_fin)::int AS nuevos_ant,
      COUNT(*) FILTER (
        WHERE creado_clientify >= v_mes_inicio 
          AND creado_clientify < v_mes_fin 
          AND (estado_efectivo IN ('in-deal', 'client') OR con_cotizacion_enviada = true)
      )::int AS cohorte_oportunidad,
      COUNT(*) FILTER (WHERE estado_efectivo = 'cold-lead')::int AS sin_contactar,
      COUNT(*) FILTER (
        WHERE estado_efectivo = 'cold-lead' 
          AND creado_clientify < (v_hoy_date - INTERVAL '7 days')
      )::int AS sin_contactar_7d,
      COUNT(*) FILTER (
        WHERE estado_efectivo IN ('warm-lead', 'hot-lead', 'in-deal')
      AND NOT EXISTS (
        SELECT 1 FROM sandbox.lead_actividad la 
        WHERE la.id_clientify = leads_mercado.id_clientify 
          AND la.proxima_accion IS NOT NULL 
          AND la.ejecutada_en IS NULL 
          AND la.revocada_en IS NULL 
          AND la.caducada_en IS NULL
      )
    )::int AS sin_seguimiento
  FROM leads_mercado
)
SELECT json_build_object(
  'total', k.total,
  'nuevos_mes', k.nuevos_mes,
  'nuevos_ant', k.nuevos_ant,
  'cohorte_oportunidad', k.cohorte_oportunidad,
  'sin_contactar', k.sin_contactar,
  'sin_contactar_7d', k.sin_contactar_7d,
  'sin_seguimiento', k.sin_seguimiento,
  'compromisos_vencidos', (
    SELECT COUNT(*)::int 
    FROM sandbox.lead_actividad la
    JOIN sandbox.clientify_contactos cc ON cc.id_clientify = la.id_clientify
    WHERE (p_pais IS NULL OR cc.id_pais = p_pais)
      AND la.proxima_accion IS NOT NULL
      AND la.proxima_fecha < v_hoy_date
      AND la.ejecutada_en IS NULL
      AND la.revocada_en IS NULL
      AND la.caducada_en IS NULL
  )
)
INTO v_kpi
FROM calc_kpi k;

SELECT COALESCE(
  jsonb_object_agg(COALESCE(estado_efectivo, 'other'), n),
  '{}'::jsonb
)
INTO v_embudo
FROM (
  SELECT estado_efectivo, COUNT(*)::int AS n
  FROM sandbox.v_leads
  WHERE (p_pais IS NULL OR id_pais = p_pais)
  GROUP BY estado_efectivo
) emb;

SELECT COALESCE(
  jsonb_object_agg(COALESCE(linea, 'paneles'), n),
  '{}'::jsonb
)
INTO v_linea
FROM (
  SELECT linea, COUNT(*)::int AS n
  FROM sandbox.v_leads
  WHERE (p_pais IS NULL OR id_pais = p_pais)
  GROUP BY linea
) lin;

WITH sem_series AS (
  SELECT (v_semanas_desde + (i * INTERVAL '7 days'))::date AS sem_lunes
  FROM generate_series(0, 7) AS i
),
leads_sem AS (
  SELECT 
    (date_trunc('week', creado_clientify AT TIME ZONE 'America/Santiago'))::date AS sem_lunes,
    CASE 
      WHEN origen = ANY(v_origenes_top) THEN origen 
      ELSE 'Otros' 
    END AS origen_cat,
    COUNT(*)::int AS n
  FROM sandbox.v_leads
  WHERE (p_pais IS NULL OR id_pais = p_pais)
    AND creado_clientify >= v_semanas_desde
  GROUP BY 1, 2
)
SELECT COALESCE(
  json_agg(
    json_build_object(
      'semana', to_char(s.sem_lunes, 'YYYY-MM-DD'),
      'total', COALESCE((SELECT SUM(n)::int FROM leads_sem WHERE sem_lunes = s.sem_lunes), 0),
      'por_origen', COALESCE(
        (SELECT jsonb_object_agg(origen_cat, n) FROM leads_sem WHERE sem_lunes = s.sem_lunes),
        '{}'::jsonb
      )
    ) ORDER BY s.sem_lunes ASC
  ),
  '[]'::json
)
INTO v_semanas
FROM sem_series s;

WITH equipo_leads AS (
  SELECT 
    COALESCE(vl.propietario, 'Sin propietario') AS propietario,
    COUNT(*)::int AS asignados,
    COUNT(*) FILTER (WHERE vl.creado_clientify >= v_mes_inicio AND vl.creado_clientify < v_mes_fin)::int AS nuevos_mes,
    COUNT(*) FILTER (WHERE vl.estado_efectivo = 'cold-lead')::int AS sin_contactar,
    COUNT(*) FILTER (WHERE vl.estado_efectivo = 'warm-lead')::int AS contactados,
    COUNT(*) FILTER (WHERE vl.estado_efectivo IN ('hot-lead', 'in-deal', 'client') OR vl.con_cotizacion_enviada = true)::int AS oportunidades,
    COUNT(*) FILTER (WHERE vl.estado_efectivo IN ('lost-lead', 'not-qualified-lead', 'lost-client'))::int AS perdidos,
    COUNT(*) FILTER (
      WHERE vl.estado_efectivo IN ('warm-lead', 'hot-lead', 'in-deal')
        AND NOT EXISTS (
          SELECT 1 FROM sandbox.lead_actividad la 
          WHERE la.id_clientify = vl.id_clientify 
            AND la.proxima_accion IS NOT NULL 
            AND la.ejecutada_en IS NULL 
            AND la.revocada_en IS NULL 
            AND la.caducada_en IS NULL
        )
    )::int AS sin_seguimiento,
    (
      SELECT COUNT(*)::int 
      FROM sandbox.lead_actividad la
      JOIN sandbox.clientify_contactos cc ON cc.id_clientify = la.id_clientify
      WHERE (p_pais IS NULL OR cc.id_pais = p_pais)
        AND (cc.propietario = vl.propietario OR (cc.propietario IS NULL AND vl.propietario IS NULL))
        AND la.proxima_accion IS NOT NULL
        AND la.proxima_fecha < v_hoy_date
        AND la.ejecutada_en IS NULL
        AND la.revocada_en IS NULL
        AND la.caducada_en IS NULL
    ) AS compromisos_vencidos
  FROM sandbox.v_leads vl
  WHERE (p_pais IS NULL OR vl.id_pais = p_pais)
  GROUP BY COALESCE(vl.propietario, 'Sin propietario'), vl.propietario
  ORDER BY asignados DESC
)
SELECT COALESCE(
  json_agg(
    json_build_object(
      'propietario', propietario,
      'asignados', asignados,
      'nuevos_mes', nuevos_mes,
      'sin_contactar', sin_contactar,
      'contactados', contactados,
      'oportunidades', oportunidades,
      'perdidos', perdidos,
      'sin_seguimiento', sin_seguimiento,
      'compromisos_vencidos', compromisos_vencidos
    )
  ),
  '[]'::json
)
INTO v_equipo
FROM equipo_leads;

WITH origenes_calc AS (
  SELECT 
    COALESCE(NULLIF(TRIM(origen), ''), 'Sin origen') AS origen,
    COUNT(*)::int AS n,
    COUNT(*) FILTER (WHERE estado_efectivo IN ('in-deal', 'client') OR con_cotizacion_enviada = true)::int AS oportunidades
  FROM sandbox.v_leads
  WHERE (p_pais IS NULL OR id_pais = p_pais)
  GROUP BY 1
  ORDER BY n DESC
  LIMIT 20
)
SELECT COALESCE(
  json_agg(
    json_build_object(
      'origen', origen,
      'n', n,
      'oportunidades', oportunidades
    )
  ),
  '[]'::json
)
INTO v_origenes
FROM origenes_calc;

WITH cumpl_calc AS (
  SELECT 
    v.id AS id_vendedor,
    v.nombre AS vendedor,
    COUNT(la.id)::int AS comprometidas,
    COUNT(*) FILTER (WHERE la.ejecutada_en IS NOT NULL AND la.ejecutada_en::date <= la.proxima_fecha)::int AS a_tiempo,
    COUNT(*) FILTER (WHERE la.ejecutada_en IS NOT NULL AND la.ejecutada_en::date > la.proxima_fecha)::int AS tarde,
    COUNT(*) FILTER (WHERE la.caducada_en IS NOT NULL)::int AS caducadas,
    COUNT(*) FILTER (WHERE la.ejecutada_en IS NULL AND la.revocada_en IS NULL AND la.caducada_en IS NULL)::int AS pendientes
  FROM sandbox.lead_actividad la
  JOIN sandbox.clientify_contactos cc ON cc.id_clientify = la.id_clientify
  JOIN sandbox.vendedores v ON v.id = COALESCE(la.id_responsable, la.id_vendedor)
  WHERE (p_pais IS NULL OR cc.id_pais = p_pais)
    AND la.proxima_accion IS NOT NULL
    AND la.proxima_fecha >= v_mes_inicio
    AND la.proxima_fecha < v_mes_fin
  GROUP BY v.id, v.nombre
  ORDER BY comprometidas DESC
)
SELECT COALESCE(
  json_agg(
    json_build_object(
      'id_vendedor', id_vendedor,
      'vendedor', vendedor,
      'comprometidas', comprometidas,
      'a_tiempo', a_tiempo,
      'tarde', tarde,
      'caducadas', caducadas,
      'pendientes', pendientes
    )
  ),
  '[]'::json
)
INTO v_cumplimiento
FROM cumpl_calc;

v_resultado := json_build_object(
  'mes', to_char(v_mes_inicio, 'YYYY-MM'),
  'kpi', v_kpi,
  'embudo', v_embudo,
  'linea', v_linea,
  'semanas', v_semanas,
  'semanas_desde', to_char(v_semanas_desde, 'YYYY-MM-DD'),
  'origenes_top', v_origenes_top,
  'equipo', v_equipo,
  'origenes', v_origenes,
  'cumplimiento', v_cumplimiento
);

RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION sandbox.panel_leads(integer, date) TO anon, authenticated, service_role;


-- =============================================================================
-- 3. RECARGA DE CACHÉ DE POSTGREST
-- =============================================================================
NOTIFY pgrst, 'reload schema';
