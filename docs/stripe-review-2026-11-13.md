# KUEST: revisión y entrega para Tomás — 13 de noviembre de 2026

## Atención: el estado anterior cambió

`origin/main` ya contiene otra implementación de Stripe y tiene conflictos con la rama original. El sitio público `https://kuest-electric.com` muestra **Buy now**; un POST inválido a `/api/checkout` devuelve **400**, en lugar del **503** de checkout deshabilitado. Esto indica que el flujo está disponible; **no confirma si utiliza sandbox o live**.

La comprobación pública usó GET de portada y POST `{}` sin producto ni clave de idempotencia, inválido en ambas implementaciones e incapaz de crear una Checkout Session. No se inició una compra válida, no se consultó Stripe ni se hicieron pagos. No se cambiaron variables ni deployments.

**Primera acción de Tomás:** verificar privadamente el deployment activo, su commit y su modo de Stripe. Si las compras deben seguir cerradas, confirmar `STRIPE_LIVE_CHECKOUT_ENABLED=false` en Production para la implementación de main y tramitar la publicación mediante el proceso autorizado. Este trabajo no lo ejecutó. Ese flag solo bloquea claves live: si el sitio usa test y también debe cerrar sandbox al público, dejar sin configurar una variable obligatoria de checkout, como `STRIPE_PICKUP_TAX_LOCATION`, y publicar únicamente con autorización. No borrar la clave API ni el signing secret: permiten verificar pagos existentes.

## Git y acceso al PR

| Elemento | Estado comprobado |
| --- | --- |
| Repositorio | `Broco-Solutions/kuest-web`, remoto HTTPS correcto |
| Rama de trabajo | `feature/stripe-checkout` |
| HEAD local/remoto al iniciar | `baa1002856da0564c111d7dc4d302087af5045c8` |
| Commits originales | `f72f998` y `baa1002`, presentes |
| Árbol al iniciar | Limpio |
| main local | `94bbc6a`, desactualizado; su puntero no se modificó |
| origin/main tras fetch | `2675bcd0a2b9ea5663cc0af8264cf7ab928375de` |
| Nuevos commits de main | `59a0d28` (otra integración), `2675bcd` (dependencias) |
| Divergencia inicial | Dos commits exclusivos por lado |
| PR hacia main | **No confirmado; no creado en esta revisión** |

Git autenticado permitió consultar ramas y hacer fetch. `gh` no está instalado. El control de permisos rechazó la consulta autenticada a la API de GitHub; no se recuperó ni imprimió el token. La consulta web sin autenticación tampoco permitió leer los PR. El acceso Git no prueba permisos de creación de PR. No se puede afirmar que no exista uno.

La comparación sin fusionar confirmó conflictos en doce archivos:

```text
.env.example
README.md
docs/stripe-checkout.md
package.json
pnpm-lock.yaml
src/app/api/checkout/route.ts
src/app/api/stripe/webhook/route.ts
src/app/checkout/cancel/page.tsx
src/app/checkout/success/page.tsx
src/app/page.tsx
src/components/buy-button.tsx
src/components/product-gallery.tsx
```

El cuerpo preparado está en [stripe-checkout-pr.md](stripe-checkout-pr.md), como **Draft** de comparación histórica. No integrar tomando todos los archivos originales: se perderían cambios recientes. El parche descrito abajo permite proponer correcciones acotadas sobre main, en otro PR.

## Dos implementaciones incompatibles

| Área | Feature original | Main actual |
| --- | --- | --- |
| Next.js / eslint-config-next | 16.4.1 | 16.4.6 |
| Modo | `STRIPE_MODE` | Prefijo de la clave API |
| Activación | `STRIPE_CHECKOUT_ENABLED` | `STRIPE_LIVE_CHECKOUT_ENABLED`, solo para live |
| Precios | Lookup key `kuest_<slug>` | Nueve variables `STRIPE_PRICE_<SLUG>` |
| Impuestos | `included` o `automatic` | Stripe Tax, Price exclusivo, `STRIPE_PICKUP_TAX_LOCATION` |
| Colores | Sin selector | Selección/validación en tres Jasion |
| Métodos | Tarjetas | Métodos dinámicos según cuenta/elegibilidad |
| Metadata | `kuest_store=kuest-electric-v1` | `website=kuest-electric`, `checkout_mode=test/live` |
| Webhook | Valida line items y marca `kuest_payment_verified` | Consulta Session y registra estado; sin ese marcador |

No mezclar requests, flags ni metadata. Si se reemplaza un webhook, revisar sesiones pendientes de ambas versiones: cada handler ignora metadata ajena. No esperar `kuest_payment_verified=true` en main. La entrega es manual: revisar Session, pago, importe, modelo/color y disponibilidad en Stripe; el retorno del navegador o un log no autorizan entregar.

## Correcciones comprobadas y entregables

[stripe-main-review.patch](stripe-main-review.patch) se preparó sobre `2675bcd` en una copia aislada. Conserva colores, impuestos, métodos de pago y Next.js 16.4.6; no cambia flags ni credenciales.

1. **Price con cantidad transformada:** main aceptaba `transform_quantity`, que puede cambiar la cantidad facturada. La regresión `divide_by=10`, `round=down` obtenía 200. El parche devuelve 503 antes de crear Session.
2. **Body de checkout:** el límite se comprobaba después de cargar todo el contenido. Ahora se limita la lectura a 2 KiB, también sin Content-Length, y se cancela el stream con 413.
3. **Body de webhook:** carecía de límite. Ahora se limita la lectura a 256 KiB, conservando los bytes originales para verificar la firma. Los eventos normales mantienen firma y reintentos.
4. **Dependencias dev:** main tenía esbuild 0.27.7 ([aviso bajo](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)) y minimatch 10.2.6 ([aviso moderado](https://github.com/advisories/GHSA-g3hv-75wg-m249)). El parche actualiza tsx a 4.23.15 (esbuild 0.28.2) y aplica un override acotado de minimatch 7–10 a 11.0.1, con tarball oficial e integridad en lockfile. Conserva minimatch 3. La auditoría posterior informa cero avisos conocidos; no demuestra exposición de esos paquetes en producción.

Las tres regresiones fallaron sobre main sin corregir: 19 pruebas existentes aprobadas y 3 nuevas fallidas. Con el parche pasan 22/22. El adjunto contiene siete archivos, incluidos tests y lockfile. **Sus cambios de runtime no están aplicados a la rama feature histórica.**

Para revisarlo, guardar el parche fuera del checkout o conservar su ruta absoluta:

```bash
git fetch origin
git switch -c review/stripe-main-hardening origin/main
git apply --check /ruta/al/stripe-main-review.patch
git apply /ruta/al/stripe-main-review.patch
pnpm install --frozen-lockfile
pnpm test:commerce
pnpm lint
pnpm typecheck
pnpm build
pnpm audit
```

Estas son instrucciones posteriores; no se ejecutó ese cambio de rama ni un merge. Si main avanzó otra vez, revisar el diff y repetir checks. Se verificó `git apply --check` contra los archivos originales de `2675bcd`.

## Pruebas realizadas

| Verificación | Feature original | Main original | Main con parche |
| --- | --- | --- | --- |
| Tests | 18/18 | 19/19 | 22/22 |
| TypeScript | Aprobado | Aprobado dentro del build | Aprobado, también por separado |
| ESLint y build | Aprobados, Next 16.4.1 | Aprobados, Next 16.4.6 | Aprobados, Next 16.4.6 |
| Audit | 0 avisos | 1 bajo, 1 moderado, dev | 0 avisos |
| Bundles del navegador | 12 artefactos sin claves/referencias privadas Stripe detectadas | No ejecutado por separado | 12 artefactos sin claves/referencias privadas Stripe detectadas |
| HTTP local | Nueve modelos, retornos, bloqueo, noindex/no-referrer | No ejecutado por separado | Nueve modelos, checkout/webhook bloqueados sin configurar, retornos, noindex |

La copia de main se instaló con lockfile congelado antes de verificarla. Los tests usan Stripe simulado y firmas sintéticas. tsx falló en el sandbox de Windows al consultar el usuario (`uv_os_get_passwd`); las pruebas se repitieron fuera de ese sandbox y aprobaron. No se cambió código para ocultar ese fallo del entorno.

Pendientes: permisos efectivos de claves, recursos reales de Stripe, configuración de Vercel, delivery logs, modo del sitio público, QA visual y compra integral de sandbox. No se leyeron secretos ni se crearon cargos o deployments.

## Configuración para Tomás: usar la de main

En Vercel, verificar proyecto, deployment y commit que sirven `kuest-electric.com`, y rama de producción. Guardar secretos privadamente en Environment Variables. Los cambios de variables se aplican a deployments posteriores ([Vercel](https://vercel.com/docs/environment-variables)).

| Variable | Local / Preview de sandbox | Production, pendiente de autorización |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `rk_test_` del sandbox correcto | Clave propia live, sin revelarla |
| `STRIPE_WEBHOOK_SECRET` | Secret del listener local o del destino sandbox correspondiente | Secret del destino exacto live |
| `SITE_URL` | `http://localhost:3000` o dominio HTTPS estable exacto de Preview | `https://kuest-electric.com` |
| `STRIPE_PICKUP_TAX_LOCATION` | Tax location del showroom en ese sandbox | Ubicación live correspondiente |
| `STRIPE_LIVE_CHECKOUT_ENABLED` | `false`; test puede funcionar igualmente | `false` hasta autorización |
| Nueve `STRIPE_PRICE_*` | IDs Price del sandbox | IDs Price live correspondientes |

Copiar los nombres de `.env.example` **de main**, incluidos `STRIPE_PRICE_JAISON_RETROVOLT` y `STRIPE_PRICE_NAVEE_UT5_ULTRA_XUT5`. Main no usa `STRIPE_MODE`, `STRIPE_CHECKOUT_ENABLED`, `STRIPE_TAX_MODE`, `STRIPE_FULFILLMENT_MODE` ni lookup keys como controles de compra.

Configurar nueve Products/Prices activos, pago único USD, cantidad sin transformar, `tax_behavior=exclusive` e importe exacto del catálogo. El Product expandido debe tener nombre exacto, `tax_details.tax_code=txcd_99999999` y `tax_details.performance_location` igual a `STRIPE_PICKUP_TAX_LOCATION`. Confirmar dirección (8330 Biscayne Blvd, Unit A, Miami, FL 33138), registros y tratamiento fiscal con el comercio; consultar la [guía de Stripe para ubicación de recepción](https://docs.stripe.com/tax/optional-tax-location/integration-guide). No reutilizar IDs entre sandbox y live.

Clave restringida: Checkout Sessions **Write**, Products/Prices **Read**; verificar requests y permisos efectivos en logs de sandbox ([Stripe](https://docs.stripe.com/keys/restricted-api-keys)). Confirmar titular de la cuenta: la guía histórica menciona PRIME RIDE y la de main KUEST ELECTRICS LLC; esta revisión no autenticó ninguna cuenta.

Destino de webhook: **Your account / Snapshot**, API **2026-10-28.endive**, consistente con SDK 23.1.0. Suscribir:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
```

Preview: `https://<dominio-preview>/api/stripe/webhook`. Destino live documentado: `https://kuest-electric.com/api/stripe/webhook`, sujeto a revisión/autorización. Debe admitir POST firmado sin redirección ni desafío interactivo. Si Preview está protegido, configurar acceso privado para entregas mediante las [opciones de Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection). No guardar bypass secrets en Git. Configurar protección contra abuso en checkout sin bloquear webhooks legítimos.

## Prueba integral exclusivamente en sandbox

1. Crear configuración local desde `.env.example` de main con recursos del sandbox, flag live `false` y SITE_URL consistente con el navegador. Iniciar `pnpm dev`.
2. Autenticar Stripe CLI en el sandbox correcto y ejecutar:

   ```bash
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook
   ```

3. Guardar el signing secret del listener solo en configuración local y reiniciar Next.js. No intercambiarlo con el secret de Workbench.
4. Comprar desde la colección con [tarjetas de prueba oficiales](https://docs.stripe.com/testing): éxito, rechazo y 3DS. Probar color en los tres Jasion, doble clic, reintento de conexión y cancelación. No usar tarjetas reales.
5. Verificar precio USD, una unidad, impuesto exclusivo y total. Comparar comprador con dirección de Florida y fuera del estado: el retiro debe usar la ubicación fiscal del showroom según la política aprobada; no inventar una tasa para aprobar QA.
6. Verificar en Stripe `website=kuest-electric`, `checkout_mode=test`, modelo/color, `fulfillment=showroom_pickup` y metadata del PaymentIntent. Verificar 2xx del webhook y estado en logs. Main no agrega `kuest_payment_verified`. Nunca entregar por el retorno del navegador ([Stripe: fulfillment](https://docs.stripe.com/checkout/fulfillment?ui=full-page)).
7. Reenviar eventos y simular fallas/reintentos; probar Session ajena/inexistente, precio/cantidad enviados por el cliente y Price archivado o transformado. No deben crearse sesiones inválidas ni confirmarse pagos pendientes.
8. Si los métodos dinámicos incluyen pagos diferidos, completar sus escenarios de pendiente/éxito/fallo en sandbox y acordar el criterio manual de retiro.
9. Repetir en Preview estable con clave test, webhook accesible y QA desktop/móvil. Registrar evidencia sin secretos ni datos personales.
10. Antes de activar live: confirmar cuenta, políticas, stock, fiscalidad, notificaciones/recibos, protección contra abuso y autorización de publicación. Esta entrega no autoriza pagos ni entrega automática.

## PR y próximos pasos

Con GitHub CLI instalado y autenticado, comprobar sin duplicar PR:

```bash
gh pr list --repo Broco-Solutions/kuest-web --state all --base main --head feature/stripe-checkout --json number,state,url,isDraft
```

Si no existe y se quiere conservar la comparación histórica, crear un Draft con el cuerpo preparado:

```bash
gh pr create --repo Broco-Solutions/kuest-web --base main --head feature/stripe-checkout --draft --title "review: compare original Stripe checkout with current main" --body-file docs/stripe-checkout-pr.md
```

Para el parche, usar una nueva rama desde main y proponer un PR separado tras revisar el diff. Mantener la feature como referencia hasta decidir la reconciliación. No hacer merge ni habilitar pagos como parte de esta entrega.

## Archivos de entrega y entorno local

La rama de trabajo solo cambia README, esta revisión, la advertencia en la guía histórica y el cuerpo preparado del PR, y agrega el parche adjunto. No se reemplazó el runtime de la feature ni se modificó main. Los servidores de pruebas locales se cerraron. Tras un fallo de rutas largas y el rechazo del segundo intento de limpieza, los restos de la copia aislada se conservaron en `node_modules/.cache/kuest-stripe-main-2675bcd-reviewed`, ignorados por Git; no forman parte de la entrega.
