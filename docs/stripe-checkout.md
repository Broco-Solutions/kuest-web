# KUEST Stripe Checkout — entrega al programador

Repositorio: https://github.com/Broco-Solutions/kuest-web

## Qué hace

- Compra de **una unidad de un modelo por operación**, desde la colección.
- Colores seleccionables para los tres Jasion que tienen variantes identificadas.
- Stripe Checkout alojado: los datos de tarjeta nunca pasan por la web.
- Usa los nueve precios existentes, en USD y con impuestos **exclusivos**: el cliente paga precio + impuesto.
- Valida importe, modelo, moneda, estado del precio, modo test/live y ubicación fiscal en el servidor antes de crear la sesión. El navegador no decide el precio.
- Retiro exclusivamente en 8330 Biscayne Blvd, Unit A, Miami, FL 33138. Los productos usan esa ubicación fiscal en Stripe; no se sustituye por la dirección de facturación del cliente.
- Métodos de pago dinámicos de la cuenta de Kuest: Stripe decide cuáles están habilitados y son elegibles para cada compra. Esto no integra PayPal por separado ni habilita Sunbit.
- La página de regreso consulta Stripe; una URL de éxito por sí sola no confirma un pago.

## Variables

`.env.example` enumera las variables. Los valores reales se entregan en **kuest-stripe-vercel.env**, por separado del código. La clave existente es restringida: Checkout Sessions escritura; Products y Prices lectura. El código no requiere permisos para reembolsar, modificar clientes ni leer Payment Intents.

`STRIPE_PUBLISHABLE_KEY` puede seguir cargada para compatibilidad, pero esta implementación con redirección no la utiliza. No se requieren `SUCCESS_URL` o `CANCEL_URL`: se construyen en el servidor desde `SITE_URL`.

`STRIPE_WEBHOOK_SECRET` debe corresponder al destino exacto de producción. Si ya está cargado en Vercel, conservarlo y confirmar en Stripe que pertenece a ese destino antes de habilitarlo. No usar la clave API, un secreto de Stripe CLI, un secreto de otro destino ni un valor inventado en su lugar.

## Publicación en orden

1. Aplicar el parche sobre el commit base indicado en `ENTREGA-CHECKOUT-KUEST.md`, o incorporar los archivos del ZIP preservando cambios posteriores del repositorio. Ejecutar `pnpm install --frozen-lockfile`, `pnpm test:commerce`, `pnpm lint`, `pnpm typecheck` y `pnpm build`.
2. En el proyecto **Kuest** de Vercel, cargar las variables reales solo en **Production**. Mantener `STRIPE_LIVE_CHECKOUT_ENABLED=false`. Usar `SITE_URL=https://kuest-electric.com`. El secreto del webhook puede quedar vacío durante esta primera publicación; las compras seguirán deshabilitadas.
3. Publicar esta versión. Confirmar que la ruta existe: `POST https://kuest-electric.com/api/stripe/webhook` responde JSON 503 mientras falta el secreto, o JSON 400 sin firma si el secreto ya está configurado; no debe responder 404 ni HTML. Con el flag en `false`, `POST /api/checkout` debe devolver JSON 503 y la colección debe ofrecer visitar el showroom.
4. En Stripe de **KUEST ELECTRICS LLC**, modo real, Workbench → Webhooks → Create destination: eventos de **Your account**, formato **Snapshot**, API version **2026-10-28.endive** (la versión del SDK stripe 23.1.0), URL exacta:

   `https://kuest-electric.com/api/stripe/webhook`

   Seleccionar solamente:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`

5. Copiar el secreto `whsec_...` de **ese destino** a `STRIPE_WEBHOOK_SECRET` en Vercel Production. Volver a publicar. Confirmar que un POST sin firma ahora devuelve 400 y que las entregas firmadas reciben 200.
6. Antes de habilitar cobros, probar en un sandbox de Kuest con su propia clave, sus propios nueve precios, ubicación fiscal, registro fiscal de Florida de prueba y secreto de webhook. En Preview poner `SITE_URL` igual al dominio de esa Preview; las claves reales están bloqueadas allí. Crear un pago de prueba aprobado, uno rechazado y uno pendiente si el método lo permite. Comprobar que se conserva el color, que el impuesto corresponde al retiro en Miami aunque el domicilio del cliente sea de otro estado, y que cancelar no muestra un pago confirmado.
7. Con la prueba aprobada, poner `STRIPE_LIVE_CHECKOUT_ENABLED=true` en Production y volver a publicar. Revisar un checkout real **sin pagar**: modelo, precio, color, impuesto y total correctos. Una compra real o un reembolso requieren una decisión del comerciante; no ejecutar un cobro de prueba real automáticamente.

## Pedidos y retiro

Stripe conserva las sesiones y pagos; el Dashboard de Stripe es el registro persistente de estas ventas. El modelo y color quedan en `metadata` de la sesión y del pago. Revisar la sesión en Stripe y comprobar `payment_status=paid` antes de entregar.

El webhook verifica la firma sobre el cuerpo original y vuelve a consultar la sesión actual para tolerar reintentos y eventos fuera de orden. Registra el estado en los logs de Vercel. **No crea una base de pedidos propia, no descuenta stock, no envía correos propios y no marca una compra como lista para retirar.** Las repeticiones no duplican esas acciones porque no existen en este alcance; pueden repetir una entrada de log. La creación de Checkout Sessions usa una clave de idempotencia que el navegador conserva al reintentar la misma compra. Los recibos configurados en Stripe siguen siendo administrados por Stripe.

La disponibilidad de colores y unidades se coordina manualmente con el showroom. Esta entrega no agrega reservas ni sincronización de inventario. Si se requiere entrega automática, correo de preparación o control de stock, hace falta almacenamiento duradero e idempotencia por sesión antes de sumar esos efectos.

Los eventos de los enlaces de pago anteriores se ignoran en este webhook porque no llevan la metadata de este checkout. Los enlaces siguen siendo independientes.

## Alcance de la verificación local

Las pruebas automatizadas usan respuestas simuladas de Stripe y firmas generadas con su SDK. Se leyeron los nueve productos reales para verificar los precios y la ubicación fiscal, sin modificar la cuenta ni crear cobros. La prueba integral en sandbox y la comprobación del destino público quedan pendientes de publicación/acceso.

Referencias oficiales:
- https://docs.stripe.com/payments/checkout
- https://docs.stripe.com/tax/optional-tax-location/integration-guide
- https://docs.stripe.com/webhooks
