# Stripe Checkout — KUEST Electric / PRIME RIDE

## Alcance y arquitectura

El repositorio original usa Next.js 16.3.5 (App Router), React 19, TypeScript y pnpm 11.9.0. Tiene nueve modelos en `src/data/products.ts` y una galería interactiva. No tiene carrito, variantes estructuradas, inventario, usuarios ni base de datos de pedidos.

La integración conserva el catálogo, precios, fotos y navegación. Agrega compra directa de **una unidad de un modelo** con Checkout alojado en Stripe. No crea productos ni modifica precios en Stripe. No guarda datos de tarjetas. La clave pública `pk_` no se utiliza: el navegador navega a la URL devuelta por el servidor, sin Stripe.js.

La única modalidad implementada es **retiro en showroom**, sujeta a confirmación de PRIME RIDE. No se ofrecen envíos ni se inventan tarifas. Los botones permanecen ocultos y el endpoint de creación devuelve 503 hasta habilitar la configuración. Si el cliente necesita entregas, selección de colores o reserva de stock, debe definirse ese flujo antes de activar pagos.

Stripe es el registro duradero de compras y pagos. El webhook marca las sesiones pagadas verificadas con `kuest_payment_verified=true`. El equipo entrega manualmente desde el Dashboard de Stripe; esta implementación no envía emails propios ni automatiza stock o logística. Es una opción para operación manual de bajo volumen, no un sistema de gestión de pedidos. El marcador verifica el pago; no significa que se haya entregado el producto. Nunca entregar sólo por ver la pantalla de éxito.

## Variables para Tomás en Vercel

Configurar en el proyecto **KUEST** y en la cuenta Stripe de **PRIME RIDE**. No reutilizar credenciales de otros clientes. `.env.example` sólo contiene nombres y valores no sensibles; no agregar secretos a Git ni al PR.

| Variable del servidor | Desarrollo / Preview | Producción |
| --- | --- | --- |
| `STRIPE_CHECKOUT_ENABLED` | `false` inicialmente; `true` para QA | `false` hasta completar la lista de salida |
| `STRIPE_MODE` | `test` | `live` |
| `STRIPE_SECRET_KEY` | Clave restringida de sandbox | Clave restringida live recibida |
| `STRIPE_WEBHOOK_SECRET` | Signing secret del endpoint de pruebas o Stripe CLI | Signing secret del endpoint live |
| `SITE_URL` | `http://localhost:3000` o URL HTTPS exacta de Preview | `https://kuest-electric.com` |
| `STRIPE_FULFILLMENT_MODE` | `showroom_pickup` al confirmar retiro | Igual, sólo si PRIME RIDE lo aprobó |
| `STRIPE_TAX_MODE` | `included` o `automatic`, según política aprobada | Igual, después de validar fiscalmente |

No usar prefijo `NEXT_PUBLIC_` para la clave restringida ni el signing secret. Los módulos que acceden a secretos importan `server-only`; un import desde el cliente falla al compilar. No hay inicialización de Stripe durante el build. La página principal lee sólo las banderas de presentación en el servidor, en cada petición.

Vercel define `VERCEL_ENV` automáticamente. El código bloquea claves live en localhost y en Preview aunque se configuren por error. La clave, precios y signing secret deben corresponder al mismo modo y cuenta. Cambiar variables en Vercel requiere un nuevo deployment; Tomás debe hacerlo después de revisar/fusionar el PR. Este trabajo no cambia producción.

### Impuestos y disponibilidad

- `included`: el precio del catálogo es el total final con impuestos incluidos. Requiere `tax_behavior=inclusive` en Stripe. No calcula ni desglosa impuestos automáticamente; usar sólo si la política fiscal y la contabilidad del cliente admiten este flujo.
- `automatic`: activa Stripe Tax. Requiere Stripe Tax configurado, registros fiscales y códigos de producto correctos, además de `tax_behavior` explícito (`inclusive` o `exclusive`). La dirección de facturación se solicita en Checkout. Validar en sandbox que la localización fiscal y los importes sean correctos para retiro en Miami; no asumir que la dirección de facturación resuelve la política fiscal de retiro. Si esa política necesita otro cálculo, no habilitar pagos hasta implementarlo.
- El comercio debe confirmar los precios actuales y la disponibilidad, incluyendo colores, antes de habilitar cada modelo. Archivar un Product o Price en Stripe bloquea **nuevas** sesiones para ese modelo. No hay reserva de inventario: sesiones ya abiertas siguen vigentes; si se agota un modelo, expirar esas sesiones desde Stripe y revisar pagos pendientes.
- Checkout acepta tarjetas, incluidas autenticación 3DS y wallets de tarjeta elegibles en Stripe. No se habilitan métodos bancarios diferidos. Los eventos asincrónicos quedan manejados defensivamente para cambios futuros; agregarlos requiere repetir QA y revisar la operación.

## Clave restringida: permisos

Sí, `rk_live_` puede utilizarse en el servidor. [Stripe admite claves restringidas para sus APIs](https://docs.stripe.com/keys/restricted-api-keys). Permisos derivados de las llamadas concretas de esta integración:

| Recurso en Stripe | Permiso | Uso |
| --- | --- | --- |
| Checkout Sessions | **Write** (incluye Read) | Crear, consultar, listar line items y actualizar metadata de Sessions |
| Prices | **Read** | Buscar el precio por `lookup_key` y comprobar importe/moneda |
| Products | **Read** | Expandir el Product del Price y comprobar actividad y `kuest_slug` |
| Los demás recursos | **None** | No hay llamadas directas a otros recursos |

No se necesitan permisos para crear webhooks: Tomás registra el endpoint manualmente en Workbench. La firma se valida localmente con `STRIPE_WEBHOOK_SECRET`, que es distinto de la clave API. Tampoco hay llamadas directas a Payment Intents, Customers, Charges, Refunds, Payouts o Transfers; Checkout administra el pago internamente. La metadata de PaymentIntent se define como parte de la creación de la Session para facilitar conciliación en el Dashboard.

**No se inspeccionaron ni probaron los permisos de la clave live recibida.** Primero probar una `rk_test_` equivalente en sandbox, revisar los request logs de esa clave y confirmar que ninguna llamada devuelve `permission_error`. Stripe recomienda derivar y verificar los permisos con esos logs. Si se usan restricciones por IP, confirmar egreso fijo en el plan/configuración de Vercel antes de habilitarlas.

## Productos y precios en Stripe

En sandbox, y luego separadamente en live, Tomás debe vincular cada modelo existente a un Product activo y un Price activo de pago único:

1. Metadata del **Product**: `kuest_slug=<slug>`.
2. **Price**: USD, cobro por unidad, importe exacto, sin cantidad transformada ni importe libre, `tax_behavior` explícito y `lookup_key=kuest_<slug>`.
3. Un único Price activo por lookup key. Usar el Dashboard o herramientas de Stripe administradas por Tomás. Los IDs de sandbox y live son distintos; el código resuelve el lookup key, sin hardcodear IDs ni usar IDs enviados por el navegador.

Valores tomados del catálogo existente, que el cliente debe confirmar:

| Modelo | Metadata `kuest_slug` | Lookup key del Price | USD | Centavos |
| --- | --- | --- | ---: | ---: |
| Jasion Thunder PRO | `jasion-thunder-pro` | `kuest_jasion-thunder-pro` | 3400 | 340000 |
| Jasion EB5 Ultra E | `jasion-eb5-ultra-e` | `kuest_jasion-eb5-ultra-e` | 2900 | 290000 |
| Jasion EB6 Foldable E | `jasion-eb6-foldable-e` | `kuest_jasion-eb6-foldable-e` | 900 | 90000 |
| Jaison RetroVolt | `jaison-retrovolt` | `kuest_jaison-retrovolt` | 2400 | 240000 |
| TST E-BIKE | `tst-e-bike` | `kuest_tst-e-bike` | 1800 | 180000 |
| Hiboy S2 Pro | `hiboy-s2-pro` | `kuest_hiboy-s2-pro` | 700 | 70000 |
| Hiboy S2 MAX | `hiboy-s2-max` | `kuest_hiboy-s2-max` | 550 | 55000 |
| NAVEE UT5 Ultra XUT5 | `navee-ut5-ultra-xut5` | `kuest_navee-ut5-ultra-xut5` | 1700 | 170000 |
| NAVEE GT3 | `navee-gt3` | `kuest_navee-gt3` | 800 | 80000 |

El servidor rechaza modelos desconocidos, precios enviados por el navegador, cantidades, monedas o redirecciones arbitrarias. Busca el modelo en el catálogo del servidor y cruza su importe con Stripe antes de crear una Session. Para cambiar un precio comercial, actualizar catálogo y Price coordinadamente. Los pagos anteriores se verifican contra la metadata de compra original y sus line items, para no invalidarlos cuando cambie el catálogo.

## Endpoints y retorno

- `POST /api/checkout`: JSON `{ "productSlug": "<slug existente>", "requestId": "<UUID v4>" }`. Requiere Origin idéntico a `SITE_URL`, JSON y máximo 1 KiB. El cliente deshabilita el botón mientras espera y el servidor usa idempotencia de Stripe para reintentos de la misma compra. Devuelve sólo la URL alojada en `checkout.stripe.com`, nunca claves ni el objeto Session completo.
- `/checkout/success?session_id=...`: consulta Stripe desde el servidor y verifica pertenencia a KUEST, modo, estado e importes/line items. Sólo muestra éxito para Session completa y pagada. Maneja pendiente, incompleta, vencida, fallida e imposibilidad temporal de verificar. No expone email, dirección ni datos de pago. No dispara entregas. Excluida de indexación y con `Referrer-Policy` mediante metadata `no-referrer`.
- `/checkout/cancel`: retorno sin afirmar que el pago falló o que no hubo un pago en otra pestaña. Permite regresar a la colección. Volver desde Checkout no expira una Session abierta ni revierte pagos.
- Los rechazos de tarjeta/3DS se muestran dentro de Stripe Checkout y permiten reintentar. Los fallos al crear una Session se muestran junto al botón en KUEST.
- `POST /api/stripe/webhook`: valida `Stripe-Signature` contra el body crudo, con tolerancia temporal del SDK y máximo 256 KiB. Nunca llama `request.json()` antes de verificar. Devuelve 400 para firma inválida, 200 para eventos ajenos/irrelevantes y 500 ante fallas de procesamiento para que Stripe reintente.

El SDK está fijado a Stripe 23.1.0 y API `2026-10-28.endive`; el webhook debe usar esa versión para snapshot events.

## Webhook: configuración y operación

En la cuenta Stripe de PRIME RIDE, abrir Workbench → Webhooks/Event destinations y crear un endpoint de eventos de la **propia cuenta**, payload completo (snapshot), no eventos thin ni Connect. URL live:

```text
https://kuest-electric.com/api/stripe/webhook
```

Suscribir exactamente:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
```

Guardar el signing secret del endpoint en `STRIPE_WEBHOOK_SECRET` del entorno correspondiente. El secret de Stripe CLI y el de Workbench son distintos. El endpoint debe ser HTTPS, accesible sin autenticación de Vercel y responder sin redirigir (usar dominio canónico, no `www`). No aplicar desafíos CAPTCHA, autenticación propia ni validación Origin al webhook; la autenticidad depende de su firma.

El handler ignora sesiones ajenas a `kuest-electric-v1` y del otro modo. Recupera el estado actual de Stripe para manejar entregas duplicadas o fuera de orden. Antes de marcar un pago, valida importe, moneda, producto, cantidad y Price contra el snapshot creado por el servidor. Las actualizaciones son idempotentes y sólo agregan marcadores; no cambian importes ni entregan productos. Un fallo antiguo no revierte un pago exitoso. No se usa memoria ni archivos efímeros de Vercel como registro de pedidos.

Operación manual: habilitar notificaciones al comercio y recibos de pagos exitosos en el Dashboard de Stripe. Revisar pagos, importe, modelo (`kuest_product_slug`), `kuest_store`, estado y stock antes de coordinar retiro. Registrar la entrega una sola vez en el proceso operativo del comercio usando Session/PaymentIntent como referencia única. El webhook no reemplaza esa operación. Para automatizarla posteriormente, agregar almacenamiento transaccional de pedidos con referencia única por Session y un outbox/cola antes de implementar efectos externos.

Supervisar los delivery logs del endpoint y alertas de Stripe. Ante un 5xx, reparar la configuración/servicio y reenviar eventos desde Workbench; Stripe también reintenta automáticamente. No borrar ni rotar secretos mientras existan eventos pendientes sin coordinar el cambio.

## QA sin cobros reales

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:client-secrets
```

Con `pnpm start --port 3100` en otra terminal y pagos deshabilitados, `node scripts/smoke-checkout.mjs http://localhost:3100` comprueba por HTTP el catálogo, retornos, noindex/no-referrer y el bloqueo del endpoint. El script sólo permite hosts locales.

Las pruebas unitarias y HTTP usan un cliente simulado, claves sintéticas y firmas generadas localmente. No leen `.env.local` ni llaman a Stripe. Cubren manipulación de precios/cantidades, configuración segura, modo live bloqueado en Preview, idempotencia, firmas alteradas/vencidas, eventos repetidos/desordenados, pagos pendientes/fallidos y fallas de persistencia.

Tomás debe completar una prueba real del flujo **exclusivamente en sandbox**, con una clave restringida de pruebas y el catálogo de pruebas configurado:

1. En local: copiar `.env.example` a `.env.local`, completar sólo con valores de test y ejecutar `pnpm dev`.
2. Con la CLI autenticada en el sandbox correcto, reenviar los cuatro eventos al endpoint:

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook
```

3. Usar el signing secret emitido por esa CLI sólo en `.env.local`. Reiniciar el servidor si se cambian variables.
4. Comprar desde un botón real con una [tarjeta de prueba de Stripe](https://docs.stripe.com/testing). Probar éxito, rechazo, autenticación 3DS, retorno/cancelación, errores de conexión y doble clic. No usar datos de tarjeta ni claves live.
5. Verificar monto/moneda/impuestos, metadata en Session y PaymentIntent, marker `kuest_payment_verified=true`, recibos, logs 2xx del webhook y requests autorizados de la clave restringida.
6. Reenviar el mismo evento, abrir retorno con Session inexistente/ajena, modificar el precio en el request, archivar un Price, simular un error de webhook y recuperarlo. No debe haber entregas duplicadas ni falsos pagos exitosos.
7. Repetir en una URL Preview estable con credenciales test. Configurar endpoint test accesible: la protección de deployments de Vercel no debe bloquear a Stripe. Nunca poner un bypass secret en Git.

## Lista de salida para Tomás

- [ ] Revisar PR hacia `main`, los checks y el diseño desktop/móvil. Fusionar sólo cuando corresponda; este trabajo no hace merge ni deployment de producción.
- [ ] Confirmar cuenta PRIME RIDE, onboarding, branding KUEST, datos de soporte, recibos y notificaciones de Stripe.
- [ ] Confirmar modalidad de retiro, variantes/colores, precios, disponibilidad, política fiscal, devoluciones y condiciones de venta del cliente antes de aceptar pagos. La web actual no incluye esas políticas; deben publicarse y configurarse en Checkout si corresponde.
- [ ] Preparar Products y Prices del catálogo en sandbox/live y permisos mínimos de sus respectivas claves.
- [ ] Completar QA de sandbox con clave restringida, incluyendo impuestos para retiro en Miami y entrega manual.
- [ ] Configurar variables en los entornos correctos de Vercel, webhook live y signing secret propios, API snapshot `2026-10-28.endive`.
- [ ] Configurar en Vercel Firewall límites de solicitudes a `POST /api/checkout` y protección contra automatización, según tráfico esperado. No se implementa un contador en memoria que dejaría de funcionar entre instancias. Excluir el webhook de desafíos interactivos y reglas que bloqueen las entregas legítimas de Stripe.
- [ ] Verificar que la integración Git de Vercel use `main` como rama de producción; el push de la feature sólo puede generar Preview, sin secretos live.
- [ ] Tras aprobar la integración, habilitar `STRIPE_CHECKOUT_ENABLED=true` y desplegar con la configuración revisada. Validar configuración/entregas de webhook sin ejecutar cobros reales como parte de este trabajo.

Para detener nuevas compras, poner `STRIPE_CHECKOUT_ENABLED=false` y volver a desplegar. El webhook y la página de estado siguen funcionando para pagos existentes mientras se mantengan la clave y el signing secret. Sesiones abiertas en Stripe no se cancelan con esa bandera; expirarlas manualmente si también deben detenerse.

Referencias oficiales: [claves restringidas](https://docs.stripe.com/keys/restricted-api-keys), [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create), [fulfillment y webhooks](https://docs.stripe.com/checkout/fulfillment?ui=full-page), [firmas y reintentos](https://docs.stripe.com/events/manage-webhook-endpoints), [Stripe Tax con Checkout](https://docs.stripe.com/tax/checkout).
