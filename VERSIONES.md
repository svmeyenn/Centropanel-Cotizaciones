# Versiones del Cotizador

Formato: `vNNNN-AAAAMMDD`. El numero sube en uno con cada entrega a
produccion --un cambio de codigo o uno solo de base de datos-- y la fecha es
la de esa entrega, en hora de Chile. Los cambios que quedan en el ambiente de
pruebas no suben la version hasta que se aprueban.

Version vigente: **v0152-20261027**

| Version | Fecha | Cambio | Referencia |
|---|---|---|---|
| v0152-20261027 | 27-10-2026 | Compras: modulo "Necesidades de material", previo a la orden de compra --necesidad por obra o pedido, solicitudes de cotizacion que se abren en varias, proveedores invitados con sus precios por item, cuadro comparativo con el mejor precio, adjudicacion por solicitud y una orden de compra por cada solicitud adjudicada--; perfil Comprador; el pedido genera la necesidad en vez de solicitudes sueltas; la orden de compra muestra su origen | (pendiente) |
| v0151-20261027 | 27-10-2026 | Vendedores y accesos: campo "Genero (para los mensajes)" en la ficha --Segun el nombre, Femenino o Masculino--; las plantillas de mensajes lo usan para concordar lo que dice quien escribe ("Quedo atento/atenta") en vez de adivinarlo siempre por el nombre | 042740a |
| v0150-20261026 | 26-10-2026 | Configuracion: pantalla "Propietarios de leads" para agregar personas --nombre y correo-- a la lista de propietarios, cambiarles el nombre o quitarlas si no tienen leads; solo administradores y supervisores; la base valida un correo, una persona, y corrige los leads que ya traen ese correo o nombre | c406dbc |
| v0149-20261026 | 26-10-2026 | Crear una cotizacion desde un lead ya no falla con "viola la politica de seguridad" para quien no maneja finanzas (Alexa, vendedores): la ficha del cliente se crea en la base en un solo paso, con su tipo cliente y su enlace al lead | fddda02 |
| v0148-20261026 | 26-10-2026 | Propietarios: tabla de personas con un solo correo cada una --la base corrige el nombre segun el correo al cargar o cambiar un lead, las cargas de planilla toman el correo de esa tabla y reasignar compara tambien el nombre, de modo que ya no se mezclan Alexa y Gianfranco--. Tablas: las pantallas de listas y configuracion usan todo el ancho disponible --hasta 120 rem en vez de 80 o 96-- para ver mas columnas sin desplazarse | 1a93961 |
| v0147-20261026 | 26-10-2026 | Rendimiento fase 2 (solo base de datos): los totales de las cotizaciones vivas se calculan en bloque en Mi gestion y en el seguimiento de cotizaciones (inicio_gestion de 311 a unos 145 ms, panel_seguimiento de 150 a 10 ms) y la comparacion de un lead de Meta descarta de entrada los leads de otros dias (de 172 a 18 ms por llamada); resultados verificados identicos | 57d4ff9 |
| v0146-20261026 | 26-10-2026 | Rendimiento: el Desempeno muestra cada bloque (ventas, leads, seguimiento) apenas le llega su dato, la banda de divisas llega por separado sin retener la pagina, la sesion se verifica por su firma en vez de volver a Supabase Auth, y Mi gestion y la estructura piden sus consultas a la vez | 4ca3377..2d62e12 |
| v0145-20261026 | 26-10-2026 | Rendimiento fase 1: el calculo de totales de cotizacion se hace en una sola pasada --Mi gestion de 770 a 180 ms, seguimiento de cotizaciones de 640 a 40 ms, cotizaciones de un lead de 64 a 15 ms--, se quita un indice duplicado de movimientos y la aplicacion pasa a correr en Portland (pdx1), junto a la base de datos | 4ca3377..2d62e12 |
| v0144-20261024 | 24-10-2026 | Marca "trabajo previo" en el lead (icono de escuadra y regla, con nota de lo que hay que hacer; la pone o quita cualquiera que edite leads) y dos listas nuevas en Mi gestion: leads de los ultimos 15 dias sin seguimiento asignado --antes de la lista de siete dias-- y leads con trabajo previo | 99411f1..135603e |
| v0143-20261024 | 24-10-2026 | Al generar un pedido desde una cotizacion, el lead vinculado queda como Cliente y sus demas cotizaciones abiertas (borrador, emitida, enviada, stand by) quedan Rechazadas, con nota en su bitacora; lo hace la base de datos en la misma transaccion del pedido | 99411f1..135603e |
| v0142-20261022 | 22-10-2026 | Por aprobar: ordenado de lo mas reciente a lo mas antiguo, y los egresos llevan el enlace "Ver documento adjunto" | 6929e07 |
| v0141-20261022 | 22-10-2026 | Pedidos: si el pie no esta cubierto, un administrador puede autorizar --con motivo, en el mismo recuadro de compras del pedido-- que se generen las solicitudes de compra a proveedores; queda anotado quien, cuando y por que, y se puede revocar | cec5335..9fcacaa |
| v0140-20261022 | 22-10-2026 | Egresos: nueva distribucion de la lista (destino con su comentario, proyecto con categoria, cuenta con solicitante; anchos fijos para fecha, monto y respaldo; nada oculto por el ancho de pantalla; pagar como accion principal y Datos/Editar/Reversar debajo). Reversar el pago de un egreso: exclusivo del Administrador, con motivo, vuelve a Pendiente y sale de la cartola; no procede si esta conciliado con el banco ni si es un anticipo con rendiciones | cec5335..9fcacaa |
| v0139-20261020 | 20-10-2026 | Mensajes a leads concuerdan con el genero: marcadores {ESTIMADO}, {SR}, {EL}, {O} (contacto) y {ATENTO}, {O_VENDEDOR} (quien escribe); el genero sale del nombre o se fija en la ficha del lead; sin definir, formas dobles (Estimado/a). Plantillas actuales actualizadas ("Quedo {ATENTO}", "interesad{O}") | 477137e |
| v0138-20261020 | 20-10-2026 | WhatsApp con archivos: el ayudante abre el chat del contacto y pega los adjuntos solo; queda revisar y enviar (ayudante v3, hay que reinstalarlo) | abfb100..bb90d97 |
| v0137-20261019 | 19-10-2026 | Configuracion: letra mas chica, tablas y controles parejos en todas sus pantallas | abfb100..bb90d97 |
| v0136-20261019 | 19-10-2026 | Configuracion ya no despliega un panel en el menu: abre su pantalla y las opciones quedan como pestanas laterales | abfb100..bb90d97 |
| v0135-20261019 | 19-10-2026 | Los mensajes programados muestran el nombre y apellido del contacto, con su telefono o correo al lado | a9deaad |
| v0134-20261019 | 19-10-2026 | Los contactos que se guardan en Contactos de Google al mandar un WhatsApp llevan la etiqueta "Cliente" | 305a5f0 |
| v0133-20261019 | 19-10-2026 | Mensajes a leads: se pueden dejar programados --el correo queda en la bandeja de salida de Outlook de la cuenta de Centropanel con su hora de entrega, y el WhatsApp espera su hora en el sistema--, visibles en el inicio separando los que ya cumplieron su hora de los que aun no llegan; pausa de 20 segundos entre un WhatsApp y el siguiente, con advertencia y espera; ayudante local para Outlook y WhatsApp (clave de emparejamiento, direcciones exactas); guardado del contacto en Contactos de Google al mandar un WhatsApp, a la espera de la autorizacion del administrador de Workspace; aviso claro al crear un usuario cuyo correo ya tiene acceso | 2947b7f..fad25ec |
| v0132-20261019 | 19-10-2026 | Leads de Meta indexados por telefono o correo y fecha: un registro de Meta es el mismo lead que uno existente solo si coincide su telefono, correo o nombre y la fecha (mismo dia en Chile, o menos de 6 horas); el mismo telefono en otra fecha es un lead nuevo, que se crea solo al cargar el archivo de Meta. Se crearon 52 leads de los ultimos 30 dias que faltaban. Reemplaza los reingresos de v0129, cuya tabla se respaldo y se elimino | 94b1957 |
| v0131-20261019 | 19-10-2026 | Menu lateral: el panel de opciones de cada grupo siempre cabe entero en la pantalla --se sube si le falta alto y, si aun asi es mas alto que la pantalla, se desplaza con su propia barra--, de modo que ninguna opcion queda fuera de alcance | 91ea71c |
| v0130-20261018 | 18-10-2026 | Lista de leads: dos columnas nuevas, Leads previos (otros leads del mismo contacto, por correo o telefono, creados antes) y Pedidos (los que ha hecho ese contacto, con ese lead o con otros suyos). Se calculan por pagina en menos de 150 ms | e44b6ab |
| v0129-20261018 | 18-10-2026 | Reingresos de leads por Meta: cuando un contacto que ya era lead vuelve a escribir por Meta (mismo correo o telefono), queda anotado en su historial y aparece en la bandeja "Volvieron a contactar" del inicio, con "Visto" y "Reabrir" para los leads perdidos. Antes el reingreso pasaba inadvertido | 175d295 |
| v0128-20261018 | 18-10-2026 | Modulos de proyectos y de compras: presupuesto por partidas, cronograma Gantt, ordenes de compra con recepcion, factura y pago, y aprobacion obligatoria de todo egreso por el aprobador del proyecto (los paneles aprueban como un solo proyecto), con bandeja Por aprobar. Proveedores unificados en la ficha unica de clientes y proveedores. Cliente enlazado en el proyecto, pedido asociado a su proyecto. Agenda del inicio con retroceso de semanas, estados de carga y error en todas las pantallas, limpieza de codigo sin uso | e8c5d43..d3066e2 |
| v0127-20261017 | 17-10-2026 | Eficiencia y seguridad de la base de datos: funciones con privilegios elevados cerradas a quien no tiene sesion, reglas de acceso calculadas una vez por consulta en vez de fila por fila (listado de leads de 2-4 s a 50-140 ms, totales de cotizacion de 2,8 s a 15 ms), enlaces de adjuntos de finanzas firmados en una sola llamada, limpieza de funciones y reglas sin uso. Sin cambios de datos ni de visibilidad, verificado con usuarios simulados | 46fdd61 |
| v0126-20261016 | 16-10-2026 | Al asignar un item a un proveedor entra con costo cero (no el del insumo), inactivo y con alerta de costo pendiente en la maestra y en el listado de proveedores; proveedor preferente con check en la maestra y en la ficha del insumo y del producto. Base de datos: migracion item_proveedor_costo_cero_real | 0476f41, 10b61ec |
| v0125-20261016 | 16-10-2026 | Clientes y proveedores ya cargados se pueden modificar: al grabar solo frena lo que la modificacion deja mal; lo que ya les faltaba se avisa como pendiente. Solo codigo | a10ade8 |
| v0124-20261016 | 16-10-2026 | Items de proveedor sin costo quedan inactivos (solo esa relacion proveedor-item) hasta que se les asigna costo; corrige el error al asignar varios productos. Base de datos: migracion item_proveedor_sin_costo_inactivo; 38 items con costo 0 quedan inactivos | bedf601 |
| v0123-20261016 | 16-10-2026 | Proveedor preferente por insumo o producto: define el costo (una sola cifra, en moneda local; USD con tipo de cambio por mercado). Recosteo automatico de paneles y de cotizaciones vigentes sin pedido; recosteo individual de pedidos sin factura. Base de datos: migraciones proveedor_preferente_*; respaldo en tablas zz_respaldo_20261016_*; ETSA (item 81) marcado como preferente | 6158047 |
| v0122-20261013 | 13-10-2026 | Estado de pago del PDF del pedido en letra mas grande. Solo codigo | 60c7e13 |
| v0121-20261013 | 13-10-2026 | PDF del pedido con la estructura de la cotizacion (boton Ver PDF, impresion y archivo) y estado de pago bajo el lugar de despacho. Solo codigo | e809799 |
| v0120-20261013 | 13-10-2026 | Campos de comentario, fecha y compromiso de leads y cotizaciones alineados arriba. Solo codigo | 66b1d1f |
| v0119-20261013 | 13-10-2026 | Comentarios y compromisos manuales de leads y cotizaciones aceptan saltos de linea y se muestran respetados. Solo codigo | 09044da |
| v0118-20261013 | 13-10-2026 | Mantenedor de mensajes: el resultado de guardar se dice junto al boton y cada mensaje muestra los dias de seguimiento que tiene guardados. Solo codigo | d32db33 |
| v0117-20261013 | 13-10-2026 | Dias de la tarea de seguimiento tras enviar un mensaje parametrizables: parametro DiasSeguimientoEnvio por mercado y valor propio en cada mensaje; aviso cuando un lead vivo (Contactado, Lead caliente, Oportunidad) o una cotizacion que espera respuesta queda sin tarea de seguimiento | 8558c11 |
| v0116-20261009 | 09-10-2026 | Leads de proyecto con varias valorizaciones, cada una con su detalle; lista de leads sin Campana ni Origen y con la cantidad de cotizaciones vinculadas; lista de cotizaciones con la columna Lead y los registros en una sola linea; Mi gestion y Desempeno en el recuadro del logo; titulos de las listas siempre completos | e9a877c |
| v0115-20261008 | 08-10-2026 | Mensajes a leads: ademas de las cotizaciones, se adjuntan los archivos cargados en el lead (correo, Outlook y WhatsApp); en WhatsApp el boton Compartir con los archivos manda el texto y los archivos juntos por la hoja de compartir del equipo. Solo codigo | 5357041 |
| v0114-20261008 | 08-10-2026 | Pasan a produccion los cambios que estaban en pruebas: motivo y comentario al cambiar el estado de leads y cotizaciones, con su mantenedor (Motivos de estado); advertencia de la plancha EPS de 230x115 contra placas de 244x122; servicio prestado y fecha de pago acordada de la factura o boleta en ingresos y egresos; y correccion de la subida de archivos en leads creados a mano o desde Meta (id negativo) | 8968532 |
| v0113-20261008 | 08-10-2026 | Gestiones en fin de semana: al programar un compromiso o una proxima accion para sabado o domingo se consulta antes y se ofrece el viernes o el lunes; el seguimiento automatico a 3 dias de un correo o WhatsApp pasa al lunes si cae en fin de semana | 7e86025 |
| v0112-20261008 | 08-10-2026 | Agenda de Mi gestion: recuadros de cada dia mas bajos, con el desglose por tipo (leads, cotizaciones, entregas) a la derecha en vertical. Solo codigo | cf1895b |
| v0111-20261007 | 07-10-2026 | Sin seguimiento: solo leads y cotizaciones sin contacto hace mas de 7 dias, en el inicio, el panel de leads y el atajo de la lista de leads | 48fcebb |
| v0110-20261007 | 07-10-2026 | Crear un lead a mano desde el listado de leads: formulario con aviso de email o telefono repetido, fuente 'manual' que la sincronizacion con Clientify no quita, y registro de quien lo creo | 24712d5 |
| v0109-20261006 | 06-10-2026 | SKU en el Configurador de paneles SIP --el del panel que ya existe, o el asignado al guardarlo-- y busqueda por SKU en el Catalogo de productos, con la columna SKU visible para todos los perfiles. Solo codigo | d38233e |
| v0108-20261006 | 06-10-2026 | WhatsApp: siempre se abre la aplicacion de WhatsApp con el chat del contacto y el mensaje escrito, y se envia desde alli; se quita el menu de compartir del sistema. Solo codigo | d19f3f3 |
| v0107-20261006 | 06-10-2026 | Vinculo manual cotizacion-lead (desde la cotizacion y desde el lead, manda sobre lo deducido); archivos en todos los leads; los envios de correo y WhatsApp --desde el lead y desde la cotizacion-- dejan en Conversaciones y compromisos el mensaje enviado; atajos a Mi gestion y Desempeno desde el lead y la cotizacion | 77548b4 |
| v0106-20261006 | 06-10-2026 | Propietarios: un correo pertenece a una sola persona y cada persona tiene un solo correo --manda el del usuario del sistema--; elegir a Gianfranco ya no asigna a Alexa por un correo mezclado en Clientify, y la gestion de una persona ya no trae los leads de otra. Solo base de datos (migracion 200) | c9ebddc |
| v0105-20261006 | 06-10-2026 | Al enviar una cotizacion --desde el lead con el PDF adjunto o desde la cotizacion-- ella pasa a Enviada y el lead a Oportunidad, aunque tuviera un estado puesto a mano; las cerradas y los leads que ya son Oportunidad o Cliente no se tocan | a397b51 |
| v0104-20261006 | 06-10-2026 | Mensajes a leads por linea: cada linea --Paneles, Proyecto y las que vengan-- tiene su propio juego de correos y WhatsApp, se elige en el mantenedor y el lead ofrece los de su linea; se agrega el juego inicial de Proyecto | c0560c5 |
| v0103-20261006 | 06-10-2026 | Cada accion dice quien la anoto, distinto de quien la tiene a cargo: rotulo Anoto en las conversaciones, en la bitacora de la cotizacion y en la agenda del inicio, y en las anotaciones de cotizacion del lead quien genero la cotizacion; vale tambien para lo ya registrado | 4544c6e |
| v0102-20261006 | 06-10-2026 | Fusion de leads duplicados: desde la ficha, quien administra fusiona un duplicado en el lead que se conserva; pasan conversaciones, compromisos, oportunidades, cotizaciones, archivos y datos, y el duplicado queda oculto y registrado | 4649f39 |
| v0101-20261006 | 06-10-2026 | Mensajes a leads: el registro en Conversaciones y compromisos se crea apenas se genera el mensaje, se puede borrar --solo estos registros, con su seguimiento-- y un lead No contactado pasa a Contactado al escribirle | a853320 |
| v0100-20261005 | 05-10-2026 | Mensajes a leads: desde la ficha del lead se arma un correo o WhatsApp a partir de plantillas editables (Configuracion > Mensajes a leads), con el PDF de las cotizaciones elegidas --borrador .eml para Outlook de escritorio, Gmail o WhatsApp--, sin enviarse solo; queda anotado en Conversaciones y compromisos con seguimiento a 3 dias | 6457460 |
| v0099-20261005 | 05-10-2026 | En espera del cliente: un lead o una cotizacion que pidio no ser molestado se deja en espera, sale de los pendientes --agenda, por contactar, sin seguimiento y sus cuentas-- y queda en su propio cuadro del inicio con el motivo y los dias; se retoma con un boton o al agendar un compromiso nuevo | 746e112 |
| v0098-20261005 | 05-10-2026 | Estados de leads y de cotizaciones parametrizables: mantenedor en Configuracion > Estados (renombrar, reordenar, agregar, dejar de ofrecer, eliminar y restaurar), con los estados que el sistema necesita protegidos; cada estado dice que significa --en juego, en seguimiento, oportunidad, perdido...-- y asi entra solo a los tableros, filtros y listados | 5b14732 |
| v0097-20261005 | 05-10-2026 | Seguimiento unificado: leads y cotizaciones en un solo listado, con el lead y su cotizacion en una fila, y los compromisos vencidos de cotizaciones en el panel de leads; la cotizacion enlaza al lead que la gesto; las vistas v_cartola y v_cotizacion_lead dejan de ser legibles sin iniciar sesion | 9fc1b40 |
| v0096-20261005 | 05-10-2026 | Inicio: el desempeno de leads mira el mes elegido y los dos anteriores; las listas van del mas nuevo al mas antiguo; los cuadros se ordenan pinchando el titulo de la columna; Mi gestion se filtra por linea, origen, propietario, estado, ejecutivo y rangos de fecha y monto, y la agenda por responsable y texto | 6a09f24 |
| v0095-20261004 | 04-10-2026 | Depuracion de leads: pantalla con los grupos caducos y sus plazos por mercado, cambio masivo de estado en la lista y filtro por antiguedad del lead | ce9e00d |
| v0094-20261004 | 04-10-2026 | El icono del sistema pasa a ser el mismo del sistema de finanzas, y se agrega favicon.ico | a62bc30 |
| v0093-20261004 | 04-10-2026 | Oportunidades con etapa, proceso y razon de ganada o perdida, importables desde la misma planilla del CRM; ventas suma conversion mes a mes, cotizaciones en juego y barras de participacion; el tablero de leads dice por que se pierde y por que se gana | da47d12 |
| v0092-20261004 | 04-10-2026 | Inicio en dos vistas: Mi gestión (agenda de dos semanas, leads por contactar y sin seguimiento, cotizaciones en juego) y Desempeño (ventas, leads y cumplimiento); gráfico de ventas suma lo facturado a lo cotizado y vendido; línea Proyecto y píldora de Paneles | cadd9a3 |
| v0092-20261004 | 04-10-2026 | Inicio en dos vistas: Desempeno (entrada, con el mes en curso y lo facturado en el grafico) y Mi gestion (agenda de dos semanas, leads por contactar y sin seguimiento, cotizaciones en juego); desempeno de leads por mercado; la linea pasa a llamarse Proyecto; la vista de leads vuelve a filtrar por pais | cadd9a3 |
| v0091-20261004 | 04-10-2026 | Leads: estados No contactado y Contactado (antes frío y tibio), cambio masivo de propietario en la lista; valores sobre las barras del gráfico del tablero | d766873 |
| v0090-20261004 | 04-10-2026 | Leads: propietario editable (dato del lead); banderas de país en el tablero y en los listados | fbcbe2d |
| v0089-20261004 | 04-10-2026 | Perú con céntimos (cálculo en la base, editores, documentos, pedidos, facturas, finanzas y enlace público con su moneda); Leads sin referencias a Clientify salvo el botón de importar (ruta /leads); importación de la planilla .xlsx de contactos | d46dcb4 |
| v0088-20261004 | 04-10-2026 | Leads: contactos de Clientify y de Meta con su estado, linea (paneles o casas), compromisos y conversaciones, datos corregibles con historial y acceso por pais; tablero por mercado; correcciones de Peru (WhatsApp, moneda, RUC, fechas); vistas que estaban abiertas de mas quedan cerradas | 8390efc |
| v0087-20261003 | 03-10-2026 | El sistema pasa a llamarse Sistema de Gestion Centropanel: nombre del proyecto, direccion de la aplicacion y titulo de la pestaña | 37e0f2e |
| v0086-20261001 | 01-10-2026 | La ficha de un cliente o proveedor se puede ver, editar o eliminar por separado, y el recuadro de entregas del tablero trae el titulo de cada columna | 2dc5769 |
| v0085-20261001 | 01-10-2026 | Seguimiento de cotizaciones: una accion comprometida se puede dar por caduca con su motivo, y el tablero muestra la espera de cada cotizacion, el cumplimiento por persona y las que no tienen a nadie a cargo | 81e7812 |
| v0084-20261001 | 01-10-2026 | Las listas de cotizaciones, pedidos, facturas y cobranza vuelven a traer el nombre del cliente tras la union de las fichas | c328693 |
| v0083-20261001 | 01-10-2026 | Clientes e interlocutores pasan a ser una sola ficha, con una marca por cada cosa que es; cada cambio del sistema queda anotado con fecha, persona y valores de antes y despues | 2909136 |
| v0082-20261001 | 01-10-2026 | Menu desplegable al pasar el cursor, las cuatro listas de finanzas con su propia entrada, aviso de ficha repetida, recordatorio de Clientify y lo facturado del mes en el tablero | 94c3e7d |
| v0081-20261001 | 01-10-2026 | La obra de un pedido se nombra sin guiones y en 30 caracteres, abreviando el cliente por pasos | bdc4bb1 |
| v0080-20260930 | 30-09-2026 | La ventana del egreso trae todos sus campos para copiar, y el respaldo adjunto solo para verlo | 4d42fa7 |
| v0079-20260930 | 30-09-2026 | Los datos para transferir de cada egreso pendiente se copian campo por campo desde la misma lista | 67e487f |
| v0078-20260930 | 30-09-2026 | Fechas de entrega del pedido --comprometida y real-- con las entregas atrasadas y de las proximas dos semanas en el tablero; cabeceras agrupadas por tema y menu plegable por temas | 6db72df |
| v0077-20260930 | 30-09-2026 | El pedido se borra desde su propia ficha, y sus totales se leen como los de la cotizacion, con el impuesto y el bruto desglosados | 3febe97 |
| v0076-20260930 | 30-09-2026 | Un pedido admite varios documentos tributarios: parcialidades contra los depositos y notas de credito, con el monto a mano o calculado | bf4bca7 |
| v0075-20260929 | 29-09-2026 | En el PDF de la cotizacion cada producto ocupa una sola linea: las columnas numericas se fijan a lo que miden y la descripcion se queda con el resto | b5d7030 |
| v0074-20260929 | 29-09-2026 | La cotizacion con una tarea vigente sale de la lista de sin respuesta: se sigue desde la bandeja de tareas | 1b36475 |
| v0073-20260929 | 29-09-2026 | Cantidad editable en la linea de la cotizacion y total del item por agregar; el menu ya no sale en el PDF; filtro por telefono en cotizaciones y pedidos; los paneles dicen APA Protec | 10c2eae |
| v0072-20260929 | 29-09-2026 | Mercado asignable en Cuentas, Proyectos, Categorias e Interlocutores; el campo solo aparece a quien alcanza mas de un pais | 0819029 |
| v0071-20260929 | 29-09-2026 | El proyecto se nombra "Paneles - Cliente - Pedido" | 4cff76f |
| v0070-20260929 | 29-09-2026 | Corrige el error de servidor al crear un egreso con un respaldo de mas de 1 MB; el proyecto muestra el folio del pedido y se puede editar en el mantenedor junto con su mercado | c5c4ae9 |
| v0069-20260929 | 29-09-2026 | Cada pedido abre el proyecto "Paneles" de su cliente, para que los ingresos y gastos de esa obra tengan donde imputarse; si el cliente ya lo tiene se reutiliza, aunque este escrito con otras mayusculas o tildes | base de datos |
| v0068-20260929 | 29-09-2026 | Las tareas de la bitacora tienen responsable: el administrador se las asigna a quien corresponda, al anotarlas o despues, y cada uno ve en la portada lo que le toca | d8f6495 |
| v0067-20260928 | 28-09-2026 | Bandeja de tareas pendientes al final de la portada: lo comprometido en las bitacoras y no hecho, lo mas atrasado primero, con la cotizacion a un clic y el cierre desde ahi mismo | d289a89 |
| v0066-20260928 | 28-09-2026 | Bitacora en cada cotizacion: quien escribio, cuando, que paso y la proxima accion con su fecha; el estado (vigente, vencida, ejecutada) se calcula y no se guarda | e4feb09 |
| v0065-20260927 | 27-09-2026 | Conciliacion: pasar al sistema lo que solo esta en el banco, dos salidas para lo que el banco no muestra y proyeccion del saldo; formato de cartola configurable por cuenta; banda de paridades por mercado en la portada; detalle de la cotizacion mas compacto | 7b7d983 |
| v0064-20260926 | 26-09-2026 | Finanzas completa: cartola consolidada, resumen por proyecto, rendiciones de gastos, conciliacion bancaria y topes; el saldo y los informes se calculan en la base, iguales para todo perfil; categorias con su mercado y listas que no se mezclan entre paises | 168821d |
| v0063-20260925 | 25-09-2026 | Sistema de Gestion: la herramienta cambia de nombre y suma la seccion de Finanzas con Ingresos, Egresos y Mantenedores; calculos iguales para todo perfil y enlace publico con sus totales | bf6f228 |
| v0062-20260924 | 24-09-2026 | Tablero de desempeno en la portada: venta, conversion, margen, cobranza, equipo y clientes, con mes seleccionable y cada tasa con su magnitud | 49ef41d |
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
