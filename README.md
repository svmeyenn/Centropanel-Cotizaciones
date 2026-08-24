# Cotizador Centro Panel — web

Migración del cotizador Access a Supabase + Next.js, desplegado en Vercel.

- **Supabase**: proyecto `CentroPanel_Cotizaciones` (`vutefkwblynvkzidgcoi`)
- **Vercel**: equipo `Centropanel`, proyecto `centropanel-cotizador`
- **URL**: https://centropanel-cotizador.vercel.app

## Variables de entorno

El build las necesita (Next inlinea las `NEXT_PUBLIC_*` al compilar, así que
tienen que estar presentes **en el build**, no solo en runtime):

```
NEXT_PUBLIC_SUPABASE_URL=https://vutefkwblynvkzidgcoi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave publicable del proyecto>
```

En local van en `.env.local`. En Vercel deben cargarse en
**Project → Settings → Environment Variables** para los tres entornos
(Production, Preview, Development). Ambas son claves públicas por diseño: viajan
al navegador y quien protege los datos es el RLS de Postgres, no el secreto de
la clave.

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Esquema, funciones de costeo, triggers, RLS, datos migrados | listo |
| 2 | Esqueleto Next.js, login, menú por rol | listo |
| 3 | Cotizaciones (listado, alta, edición, descuentos), clientes, PDF | código listo, pendiente de desplegar |
| 4 | Configurador SIP, productos, materias primas, parámetros, vendedores | pendiente |

## Cómo desplegar

Hoy el despliegue se hace enviando el árbol de fuentes por la API de Vercel, lo
que **no escala**: son ~37 archivos y el envío se corta. La vía sostenible es
conectar un repositorio de GitHub al proyecto de Vercel, y así cada push
despliega solo.

```bash
git init
git add .
git commit -m "Cotizador web: fases 1-3"
git remote add origin https://github.com/<usuario>/<repo>.git
git push -u origin main
```

Después, en Vercel: **Project → Settings → Git → Connect Git Repository**.

## Decisiones de diseño que conviene no romper

- **La lógica de negocio vive en Postgres**, no en el cliente: costeo, folio
  correlativo y sincronización del descuento son funciones y triggers. El
  frontend recalcula lo mismo solo para previsualizar; la base manda.
- **El folio lo asigna un trigger** con una secuencia (`folio_cotizacion_seq`),
  nunca el cliente: así dos personas grabando a la vez no lo repiten.
- **El borrador vive en el navegador**: nada se escribe hasta pulsar GRABAR, que
  es la regla que se fijó en Access con las tablas locales.
- **El catálogo se lee por `v_catalogo_venta`**, que omite `costo_unitario`: un
  perfil Vendedor no puede ver costos, y el RLS lo impide también a nivel de tabla.
- **Los datos de empresa se leen por `v_parametros_publicos`**, lista blanca que
  deja fuera `MargenObjetivo`.
- **El logo va incrustado** como data URI en `src/lib/logo.ts` y no en `public/`:
  un binario suelto se pierde al enviar solo el árbol de fuentes.
