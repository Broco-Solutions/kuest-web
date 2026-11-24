# KUEST · Bolsa y Stripe Checkout

## Comportamiento

- Los nueve modelos existentes usan **Agregar a la bolsa**. Las variantes por color se guardan por separado. La bolsa `/cart` permite cantidades de 1 a 10 por variante y eliminar productos.
- Persistencia en `localStorage` (`kuest_cart_v1`), sincronización entre pestañas y recuperación segura de datos inválidos. Si el almacenamiento está bloqueado, funciona en memoria en esa pestaña.
- Un solo checkout alojado de Stripe contiene todos los productos y cantidades. Los precios se resuelven en el servidor mediante las variables existentes; el cliente no manda importes.
- `automatic_tax.enabled=false`; no se envían tasas manuales ni recargos. Los precios base del catálogo no se modifican. No se requiere `STRIPE_PICKUP_TAX_LOCATION`; una variable antigua con ese nombre puede permanecer sin efecto.
- Se mantienen USD, retiro en el showroom, teléfono del cliente y métodos de pago elegibles de la cuenta. La disponibilidad de Sunbit u otro método la decide Stripe.
- El color y cantidad de cada renglón quedan guardados en `metadata.item_N` de la sesión y del pago. Los colores también se muestran en el mensaje del checkout. La sesión de Stripe es el registro persistente del pedido.
- Al cancelar se vuelve a `/cart` sin vaciar la bolsa. Solo una página de éxito cuyo pago fue verificado en el servidor puede vaciar la bolsa original, si no se modificó entretanto. Pagos pendientes o rechazados no la vacían.

## Publicación sobre la instalación existente

1. Incorporar estos cambios en el proyecto de Vercel de **kuest-electric.com**, sin reemplazar secretos ni credenciales de la instalación.
2. Mantener las variables `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `STRIPE_LIVE_CHECKOUT_ENABLED` y los nueve `STRIPE_PRICE_*` de `.env.example`. Los precios existentes deben seguir siendo activos, de un solo pago, USD, exclusivos y del importe/modelo correspondiente. El endpoint rechaza inconsistencias antes de crear una sesión.
3. Ejecutar `pnpm install --frozen-lockfile`, `pnpm test:commerce`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
4. Probar primero en sandbox/Preview con sus propias claves y precios. Los cobros reales siguen bloqueados fuera de producción. No usar una clave real en una Preview.
5. Publicar en Production, conservando `SITE_URL=https://kuest-electric.com` y la habilitación real existente. Esta implementación también admite el payload anterior `{slug,color}` para no romper pestañas antiguas durante el despliegue; esas compras tampoco agregan impuestos.
6. Verificar un checkout nuevo de US$1.700 para NAVEE UT5 y uno con dos Thunder PRO (US$6.800) más otro modelo: el total debe coincidir con la suma del catálogo y no tener un recargo del 7%. No reutilizar una sesión creada antes del cambio, ya que conserva sus parámetros originales.

## API y seguridad

`POST /api/checkout` recibe:

```json
{"items":[{"slug":"jasion-thunder-pro","color":"Blue","quantity":2},{"slug":"navee-gt3","quantity":1}]}
```

Requiere mismo Origin que `SITE_URL`, `Content-Type: application/json` e `Idempotency-Key` UUID v4. Responde `{url,sessionId}`. Las claves se reutilizan al reintentar la misma bolsa y cambian al modificarla. Límite de cuerpo de 4 KB, 20 renglones y 50 unidades, combinando variantes repetidas antes de validar el límite por variante.

La clave secreta permanece solo en el servidor. El webhook existente `/api/stripe/webhook` sigue verificando firma y reconsultando el pago para los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `checkout.session.expired`. No cambiar el secreto de ese destino.

No se agregó inventario automático, correo propio ni base de pedidos: se conserva el retiro y la preparación manual con el Dashboard de Stripe. El webhook registra estados, sin despachar productos. Antes de entregar verificar pago aprobado y disponibilidad. Desactivar el cálculo de impuestos en el checkout no determina las obligaciones fiscales del negocio.

## Pruebas

Las pruebas automatizadas usan respuestas simuladas de Stripe y firmas de su SDK; no cobran dinero real. Cubren totales, variantes, manipulación del payload, límites, precios desactualizados, múltiples productos, impuestos desactivados, idempotencia, URLs seguras y eventos de pago. La prueba integral de pagos sandbox requiere los secretos y precios de prueba del propietario.
