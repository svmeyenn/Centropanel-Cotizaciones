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
| 3 | Cotizaciones (listado, alta, edición, descuentos), clientes, PDF | listo |
| 4 | Configurador SIP, productos, materias primas, parámetros, vendedores | listo |

## Cómo desplegar

El repositorio está conectado al proyecto de Vercel: **cada push a `main`
despliega solo**. No hay que hacer nada más.

```bash
git add -A && git commit -m "..." && git push
```

Las variables de entorno ya están cargadas en Vercel para los tres entornos.
Para trabajar en local, `npx vercel env pull .env.local` las trae de vuelta.

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

## Reparto de permisos

| Pantalla | Administrador | Vendedor | Consulta |
|---|---|---|---|
| Cotizaciones, clientes | total | crear y editar | solo lectura |
| Configurador, catálogo | con costo y margen | solo precio | solo precio |
| Materias primas, parámetros, vendedores | total | sin acceso | sin acceso |

El corte no es solo de interfaz: el RLS de Postgres lo impone también a nivel de
datos, así que un Vendedor no obtiene costos ni aunque llame la API directo.
