# Versiones del Cotizador

Formato: `vNNNN-AAAAMMDD`. El numero sube en uno con cada entrega a
produccion --un cambio de codigo o uno solo de base de datos-- y la fecha es
la de esa entrega, en hora de Chile. Los cambios que quedan en el ambiente de
pruebas no suben la version hasta que se aprueban.

Version vigente: **v0061-20260924**

| Version | Fecha | Cambio | Referencia |
|---|---|---|---|
| v0061-20260924 | 24-09-2026 | Codigo del producto (PLU) en los items de la cotizacion y busqueda por codigo al agregar productos | 7927c2a |
| v0060-20260924 | 24-09-2026 | Tres descuentos por base (productos, flete, instalaciones) configurables por familia y por producto; panel de familias y subfamilias; parametros de materias primas; filtros y descarga a Excel en los listados | 7109ab2 |
| v0059-20260921 | 21-09-2026 | "COTIZADOR SIP" en una linea; estado de la cotizacion solo dentro de la cotizacion y con confirmacion | 04543ff |
| v0058-20260921 | 21-09-2026 | Franja delgada y logo a la izquierda; pais como en Finanzas; margen para todos los perfiles; estado de cotizacion editable; ficha del cliente desde cotizacion y pedido; comuna en listados | a85b9f1 |
| v0057-20260920 | 20-09-2026 | Menu lateral permanente; filtros y borrado en los listados; fichas en ventana emergente; telefono con codigo de pais y recordatorio diario; margen de cotizacion y pedido | 46e1bb4 |
| v0056-20260915 | 15-09-2026 | Perfil Supervisor (todo lo del Administrador salvo usuarios y claves); correo con el PDF adjunto desde la casilla del usuario y PDF compartible por WhatsApp | 9523544 |
| v0055-20260915 | 15-09-2026 | IGV en las vistas de Perú; el vendedor ve el PVP con impuesto en el catálogo | 85b0d58 |
| v0054-20260915 | 15-09-2026 | Parámetros, formas y medios de pago por país; RUC e IGV en los documentos de Perú; número de versión visible | e830658 |
| v0053-20260914 | 14-09-2026 | Blanquear clave desde accesos y recuperar la propia desde el ingreso | a36e27d |
| v0052-20260914 | 14-09-2026 | Mercado activo visible en la cabecera y selector para quien trabaja los dos | ae5c065 |
| v0051-20260910 | 10-09-2026 | Un descuento en monto ya no se borra al volver a grabar la cotización | base de datos |
| v0050-20260910 | 10-09-2026 | Elegir el mercado al crear y editar productos, clientes y proveedores | 4b3ccf1 |
| v0049-20260910 | 10-09-2026 | Permiso para las secuencias nuevas: corrige el error al crear productos y materias primas | base de datos |
| v0048-20260903 | 03-09-2026 | El teléfono del vendedor también con código de área | bfbd203 |
| v0047-20260903 | 03-09-2026 | Alta de usuarios en Vendedores y accesos | 1cd64e5 |
| v0046-20260903 | 03-09-2026 | Cabecera del pedido: campos parejos y ordenados | 078f6d1 |
| v0045-20260903 | 03-09-2026 | Duplicar, editar composición, facturas emitidas y cabecera del pedido | 3ae4be5 |
| v0044-20260903 | 03-09-2026 | Datos obligatorios, formatos, SKU, tipos y eliminación | bd32bc5 |
| v0043-20260903 | 03-09-2026 | Razón social y RUT del cliente en la cotización, y cabecera más apretada | c879740 |
| v0042-20260903 | 03-09-2026 | El mercado de la cotización sale del cliente, no de una pregunta | 6e03e50 |
| v0041-20260903 | 03-09-2026 | Un solo campo para elegir el producto en la cotización | 13d8686 |
| v0040-20260903 | 03-09-2026 | La cotización abre con la forma de pago 50/50 propuesta | 833f284 |
| v0039-20260903 | 03-09-2026 | Todos los botones con fondo verde y letras blancas | c0cb91d |
| v0038-20260903 | 03-09-2026 | Menú agrupado por concepto y botones en verde | ecde3d3 |
| v0037-20260902 | 02-09-2026 | El espesor de la materia prima se edita con sus decimales | 5bbcc03 |
| v0036-20260902 | 02-09-2026 | Adjuntar el archivo de la factura al pedido | 565b8b7 |
| v0035-20260831 | 31-08-2026 | Botón para empezar otra cotización sin salir de la pantalla | 025089f |
| v0034-20260831 | 31-08-2026 | Logo de Centro Panel en la pestaña del navegador | 5aa5718 |
| v0033-20260831 | 31-08-2026 | Ambiente de pruebas: esquema sandbox en la misma base | e465717 |
| v0032-20260831 | 31-08-2026 | Guardar el panel se resuelve en la base | 0c6240e |
| v0031-20260831 | 31-08-2026 | Estado de pago: las seis cifras en una línea | 8a32d07 |
| v0030-20260830 | 30-08-2026 | Estado de pago: Facturado es lo que tiene factura | 1aab2cf |
| v0029-20260830 | 30-08-2026 | Facturar el pedido | df326b1 |
| v0028-20260830 | 30-08-2026 | Vista de estado de pago | d5c92b6 |
| v0027-20260830 | 30-08-2026 | Una solicitud por proveedor y medio de pago con comisión | 1f42d23 |
| v0026-20260830 | 30-08-2026 | El pie de cada forma de pago se edita en su pantalla | 2e60c6c |
| v0025-20260830 | 30-08-2026 | Cuenta corriente del pedido y pie exigido antes de comprar | 00e5840 |
| v0024-20260830 | 30-08-2026 | Asignar productos a un proveedor en lote | daeb102 |
| v0023-20260830 | 30-08-2026 | Pantallas de pedidos, proveedores y solicitudes | 969e6ea |
| v0022-20260830 | 30-08-2026 | Editar un producto muestra costo, neto, PVP y margen enlazados | db34e61 |
| v0021-20260830 | 30-08-2026 | Las cuatro cifras del panel en una sola línea | 8bd248c |
| v0020-20260830 | 30-08-2026 | Configurador: precio neto, PVP y margen enlazados | 38573f2 |
| v0019-20260830 | 30-08-2026 | Detalle de cotización sin PVP y descuento con separador de miles | 418ecbe |
| v0018-20260830 | 30-08-2026 | El alta de materia prima se queda en lo que es una materia prima | f84b4a8 |
| v0017-20260830 | 30-08-2026 | Alta de materias primas | fa1653c |
| v0016-20260830 | 30-08-2026 | No se graba una cotización con líneas sin precio | 075fe06 |
| v0015-20260830 | 30-08-2026 | Segundo nivel de agrupación: subfamilia | 1198126 |
| v0014-20260830 | 30-08-2026 | Catálogo agrupado por familia | 0d01295 |
| v0013-20260830 | 30-08-2026 | Los productos que no son paneles no nacen con precio manual | 1a565b2 |
| v0012-20260830 | 30-08-2026 | PVP con IVA en las vistas, botones más chicos y alta de producto en la barra | 8302e82 |
| v0011-20260830 | 30-08-2026 | Espesores con decimales, catálogo en una línea y alta de servicios | 77e6b8c |
| v0010-20260825 | 25-08-2026 | El PDF se guarda con el folio como nombre de archivo | e1c89e2 |
| v0009-20260825 | 25-08-2026 | Desglose del costeo para todos los perfiles y alta de cliente en ventana emergente | 176cef4 |
| v0008-20260824 | 24-08-2026 | PDF en papel tamaño carta | 5b71bc8 |
| v0007-20260824 | 24-08-2026 | Buscar cotizaciones por razón social y logo al doble en el documento | 8ab2eef |
| v0006-20260824 | 24-08-2026 | PDF sin encabezados del navegador, logo y letra menor; panel nuevo desde el cotizador; enlace público | fe6fa44 |
| v0005-20260824 | 24-08-2026 | PDF: conservar los colores al imprimir | 3e253c4 |
| v0004-20260824 | 24-08-2026 | Edición de productos, desglose de costeo, navegación y envío al cliente | 0793d96 |
| v0003-20260824 | 24-08-2026 | Impedir paneles duplicados con las caras invertidas | 38871cd |
| v0002-20260824 | 24-08-2026 | Fase 4: configurador SIP, catálogo, materias primas, parámetros y vendedores | c2564e4 |
| v0001-20260824 | 24-08-2026 | Cotizador web: fases 1-3 (base, auth, cotizaciones, clientes, PDF) | 68c99ed |
