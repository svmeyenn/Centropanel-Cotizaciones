# Ambiente de pruebas

Esta rama (`sandbox`) es la copia de pruebas del cotizador. Se ve y funciona
igual que el sistema real, pero **trabaja sobre otros datos**: nada de lo que
se haga aquí llega a producción.

Se reconoce a simple vista: en la parte superior de cada pantalla aparece una
banda dorada que dice **AMBIENTE DE PRUEBAS**. Si esa banda no está, se está
en el sistema de verdad.

## Cómo está hecho

No es otro proyecto ni una base aparte: es un **esquema `sandbox`** dentro de
la misma base de datos, con sus propias tablas, funciones y reglas de acceso.
Sale gratis. Es la misma solución que usa `CentroPanel_Finanzas`.

Qué copia se usa lo decide la rama desde la que se despliega:

| Rama | Datos |
|---|---|
| `main` | producción (esquema `public`) |
| `sandbox` | copia de pruebas (esquema `sandbox`) |

No hay que configurar nada al desplegar: la rama manda. Se puede forzar con la
variable `NEXT_PUBLIC_DB_SCHEMA` si alguna vez hace falta.

## Con qué datos arrancó

Con una copia completa de producción del día que se creó, conservando los
mismos identificadores para poder comparar. Desde ese momento las dos siguen
caminos separados: lo que se cotiza, pide o factura en pruebas se queda en
pruebas, y lo que pasa en producción no se refleja aquí.

## Cómo se pasa un cambio a producción

Se trabaja normal en `main` y se despliega como siempre. Para probar antes de
publicar:

```bash
git checkout sandbox
git merge main
git push
```

Eso lleva **el programa** a la copia de pruebas. **Los datos no se tocan**: un
cambio de código nunca pisa lo que hay en producción, y las cotizaciones de
prueba tampoco se van a mezclar con las reales.

Si el cambio incluye tablas o funciones nuevas, hay que crearlas en los dos
esquemas: primero en `public` y después en `sandbox`.

## Volver a partir de cero

Cuando la copia de pruebas quede muy desordenada, se puede rehacer desde los
datos actuales de producción. Es un procedimiento sobre la base, no desde la
aplicación: pídelo y se hace.
