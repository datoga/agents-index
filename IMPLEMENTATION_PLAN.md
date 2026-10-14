# agents.index — plan de implementación de principio a fin

Estado: plan de producto y tecnología, revisado el 14 de octubre de 2026. Hay una implementación local inicial de la API, CLI, SDK, skill, directorio bilingüe y consola admin; requiere configuración de PostgreSQL y email para ejecutar flujos reales. Dominio, organización GitHub y paquetes npm son provisionales; comprobar disponibilidad antes de publicar.

## 1. Visión y resultado buscado

Un índice público donde personas y organizaciones publiquen una tarjeta de contacto utilizable tanto por humanos como por agentes. La tarjeta puede describir a una persona, una empresa, actividades personales y comerciales, capacidades y formas de contacto. No fuerza a elegir una sola categoría.

La primera versión debe demostrar este recorrido: una persona verifica su correo, crea o reclama una tarjeta, autoriza a su agente a usar un buzón dedicado, un segundo agente encuentra la tarjeta y manda un correo, y el agente destinatario lee y responde. La tarjeta y el directorio son públicos; el contenido del correo no se publica en el índice.

El directorio no necesita ser el único almacén de mensajes ni custodiar las credenciales del buzón. El correo del usuario proporciona entrega y almacenamiento. La firma OpenPGP puede verificar opcionalmente la autoría criptográfica; no es requisito para registrarse ni comunicarse.

## 2. Principios de diseño

1. **Facilitar el alta.** Correo verificado como mecanismo inicial de registro y recuperación. El registro no concede al directorio acceso al buzón.
2. **Separar identidad, perfil, mensajería y transporte.** Una tarjeta no se ata para siempre a un proveedor de email ni a una sola clave.
3. **Privacidad por defecto.** La dirección personal permanece privada. El usuario publica una dirección dedicada de agente o habilita un alias cuando quiera recibir mensajes.
4. **Control local de credenciales.** Los tokens OAuth, contraseñas de correo y claves privadas no se envían al modelo, no se suben al perfil y no se registran en logs.
5. **Interoperabilidad antes que acoplamiento.** Esquemas, API, sintaxis URI, convenciones de correo y ejemplos son públicos. El servidor de referencia no es autoridad para formatos no documentados.
6. **Degradación clara.** Los clientes distinguen correo sin firma, firma verificada, firma inválida, entrega aceptada y mensaje procesado. No confunden estado SMTP con lectura o comprensión.
7. **No construir federación antes de tener uso.** Subíndices quedan fuera de la fase 0 y no se necesitan para lanzar la primera versión.
8. **API-first.** El usuario final no tendrá sesión web ni contraseña. El agente registra y administra la ficha por API/CLI; una consola separada es solo para administradores.
9. **OTP para bootstrap, API tokens para uso continuo.** Códigos de un solo uso enviados al email prueban control del buzón. El agente canjea el código por un token aleatorio revocable; el OTP nunca es una credencial permanente.
10. **Bilingüe y desplegable.** Las pantallas humanas y correos iniciales estarán en castellano e inglés. Persistencia fuera del filesystem local para funcionar en Vercel u otro hosting serverless.

## 3. Decisiones base

### 3.1 Identidad y nombres

- URL HTTPS canónica para cada tarjeta, por ejemplo `https://agents.index/datoga`.
- `agent://datoga` se especifica inicialmente como alias experimental resuelto por la companion skill, CLI o un resolver configurado. No se promete que cualquier navegador lo abra automáticamente: eso requiere que el sistema operativo o una aplicación registre el esquema.
- La identidad estable es un ID opaco del índice. El nombre visible puede cambiar y no es una clave criptográfica.
- `agent://carrefour/investors` y la delegación de subíndices se definirán para una fase posterior. La fase 0 no crea subíndices.

### 3.2 Registro por email

- Verificación inicial mediante código de un solo uso de corta duración enviado por email (sin contraseña).
- El correo verificado prueba control de esa dirección y facilita recuperación; no certifica identidad legal, empleo, experiencia ni que cada mensaje futuro haya sido escrito personalmente por el propietario.
- El alta autónoma tendrá un flujo CLI/API: el agente solicita un código, lo lee del buzón que el usuario ya autorizó, lo canjea por un token y registra/gestiona la ficha. Si no tiene acceso al buzón, pide al humano que entregue el código; no se omite la verificación.
- Vincular un buzón para lectura/envío es una autorización aparte y opcional. Utilizar permisos OAuth mínimos si el proveedor los permite. Para el MVP se puede conectar un buzón dedicado que el agente ya tenga autorizado.
- El directorio no solicita la contraseña de Gmail/Outlook ni almacena tokens de buzón que no necesita.

### 3.3 Autenticación API y consola

- El OTP es de un solo uso, corto plazo y asociado a email y propósito; persiste solo su HMAC/hash, se invalida al canjear y tiene límites por IP/email. La API nunca devuelve el código en producción.
- El CLI crea una API key aleatoria al canjear el primer código. Se muestra una sola vez y se guarda localmente con permisos restrictivos; en DB solo se conserva un HMAC, prefijo, scopes, expiración, último uso y revocación.
- Tokens bearer opacos permiten revocación inmediata, con scopes mínimos (`profile:read`, `profile:write`, `profile:delete`, `tokens:manage`). No se conceden permisos administrativos a agentes.
- Recuperar acceso requiere otro OTP por email y emite un token nuevo; permitir revocar credenciales anteriores. El acceso al buzón equivale a poder recuperar la cuenta.
- El agente puede borrar su ficha y, separadamente, borrar cuenta/credenciales por API/CLI con confirmación explícita. La consola `/admin` usa OTP y allowlist distinta; auditar cada acción y hacer bootstrap seguro del primer admin.

### 3.3 Mensajería por correo

- El MVP usa correo electrónico normal como transporte pull/push: el proveedor recibe y conserva el mensaje; el agente sincroniza el buzón por IMAP/API o usa notificaciones push del proveedor con sincronización de respaldo.
- Primer modo de contacto: una dirección dedicada para el agente, publicada solo con consentimiento. El directorio no procesa ni almacena el cuerpo de los mensajes.
- El usuario podrá mostrar un enlace social, dirección de contacto, web, endpoint MCP/A2A u otros enlaces públicos. Los secretos y URLs con tokens nunca son datos de tarjeta.
- Una dirección proxy `handle@inbox.<dominio>` puede añadirse después si la prueba muestra que ocultar direcciones y reducir spam lo exige. Eso convierte al servicio en gateway: hay que diseñar recepción SMTP, filtrado, cuotas, rebotes, privacidad, retención y reputación de envío.
- El correo no es cifrado de extremo a extremo por defecto. TLS de transporte y almacenamiento en el proveedor no equivalen a que solo los dos agentes puedan leer el contenido.
- Definir en la spec una envoltura legible por humanos y reconocible por máquinas: versión, `agent_id` emisor/destinatario, intención opcional, `in_reply_to`, caducidad opcional y contenido. La parte principal seguirá siendo texto simple. Evitar ejecutar acciones solo porque el correo las pide.

### 3.4 Firma OpenPGP opcional

- OpenPGP es una capacidad opcional de tarjeta y mensaje. Publicar clave pública, huella, propósito (firmar), versión, estado y referencia de revocación; nunca publicar la clave privada.
- Vincular clave a identidad mediante reto firmado y verificación del correo; registrar el método y la fecha. La UI expresa exactamente esa prueba: “controla este correo y esta clave”, no “persona verificada”.
- Usar PGP/MIME donde los clientes implicados lo soporten; definir alternativa de firma del payload estructurado para agentes. Si un gateway modifica el MIME y rompe la firma, etiquetar como no verificable, no como mensaje verificado.
- La firma permite comprobar autoría de la clave e integridad del contenido firmado; no cifra el correo ni protege asuntos o metadatos. El cifrado OpenPGP queda como capacidad futura separada.
- Diseñar desde el inicio actualización de clave, expiración, revocación, pérdida y recuperación. La clave de firma no sustituye el acceso de email.

## 4. Organización pública en GitHub y npm

Publicar el desarrollo desde el inicio en una organización GitHub pública (nombre provisional `agents-index`). Ser público no basta para que el trabajo sea reutilizable: cada repositorio tendrá licencia, contribución, seguridad y política de versiones.

### Repositorios iniciales

1. **`agents-index/spec`** — fuente normativa: RFCs, gramática de `agent://`, JSON Schema, OpenAPI, formato de mensaje por email, modelo de claves y fixtures. Versionado semántico independiente. Propuesta de licencia: Apache-2.0.
2. **`agents-index/agents-index`** — monorepo de implementación de referencia y producto. Incluye web pública, API, base de datos/migraciones, SDK, CLI, companion skill, despliegue local, documentación, ejemplos y pruebas de conformidad. Propuesta de licencia: Apache-2.0 para permitir implementaciones alternativas.

Mantener skill, CLI y SDK en el monorepo para no duplicar contratos; la skill será instalable desde GitHub con el CLI `skills`, usando la carpeta `skills/agents-index`. Separarlos en otro repositorio solo si aparecen mantenedores/versionado independientes. Integraciones comunitarias futuras pueden vivir en repos públicos por separado.

### Estructura inicial del monorepo

```text
apps/
  web/                 # páginas públicas, búsqueda, registro y gestión
  api/                 # API HTTP pública y endpoints de control
packages/
  schema/              # validación TypeScript generada desde la spec
  sdk/                 # cliente TypeScript para agentes y aplicaciones
  cli/                 # init, register, profile, resolve, email check, keys
  email/               # parsing/normalización; conectores solo cuando hagan falta
skills/
  agents-index/        # SKILL.md e instrucciones del agente
infra/
  docker/              # despliegue reproducible de referencia
  migrations/          # SQL/migraciones de PostgreSQL
docs/
examples/
```

Publicar paquetes npm bajo un scope a confirmar, por ejemplo `@agents-index/sdk` y `@agents-index/cli`. Comprobar disponibilidad de nombres antes de usarlos. Compatibilidad declarada: Node.js 24 LTS, TypeScript estricto, npm workspaces y `package-lock.json` comprometido. CI usa Node 24; mantener CI de compatibilidad con el siguiente LTS antes de migrar. Node 24 figura como LTS y el proyecto Node publica sus fechas de soporte; volver a comprobarlas al iniciar el desarrollo y en cada ciclo anual. [Estado de versiones Node.js](https://nodejs.org/en/about/previous-releases)

### Reglas públicas de ingeniería

- `README`, arquitectura, roadmap, ADRs, licencia, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` y política de divulgación de vulnerabilidades.
- Issues y decisiones técnicas públicas salvo vulnerabilidades o datos personales. No publicar datos de usuarios en issues/fixtures.
- GitHub Actions para lint, typecheck, build, validación de schemas, pruebas unitarias/integración, pruebas de contrato y escaneo de dependencias. Pruebas de extremo a extremo con buzones de sandbox.
- Releases firmadas/anotadas y changelog; usar changesets o mecanismo equivalente para alinear paquetes npm. Publicación npm vía trusted publishing/OIDC si está disponible al implementar, nunca token npm de larga duración en repositorio.
- Secretos de producción en el gestor del hosting. `.env.example` contiene solo nombres de variables no sensibles.
- Añadir licencia explícita a todas las dependencias/código importado. No copiar código de AgentDex u otros proyectos hasta verificar licencia y revisar mantenimiento, seguridad y compatibilidad.

## 5. Arquitectura de referencia

- **Web**: páginas públicas indexables para humanos y JSON legible por agentes; gestión autenticada de tarjetas.
- **API**: API HTTP versionada, endpoints documentados en OpenAPI. Lectura de fichas pública con límites de frecuencia; mutaciones requieren API key de agente con scopes. Los propietarios no tienen sesión web.
- **Autenticación**: agentes usan bearer API keys aleatorias, guardadas como HMAC y revocables; OTP por email sirve para registro/recuperación. Administradores usan sesión web OTP separada.
- **Base de datos**: PostgreSQL para identidades, nombre reservado, emails verificados privados, fichas, historial de versiones, claves públicas, consentimiento, reportes y auditoría. La implementación de referencia usa `pg` para admitir PostgreSQL local y proveedores alojados; en Vercel debe usarse el endpoint pooled. Índice de búsqueda inicial PostgreSQL; evaluar servicio dedicado solo con evidencia de volumen.
- **Email**: no alojar buzones propios en v1. Guardar solo la dirección pública explícitamente autorizada y la dirección privada de cuenta con controles de acceso y cifrado en reposo. No persistir mensajes en el directorio. El agente mantiene su historial en el proveedor de correo.
- **SDK/CLI**: validación local del perfil y operaciones de registro/actualización/resolución; protección de secretos; mensajes de error comprensibles.
- **Companion skill**: instrucciones de descubrimiento y uso de la CLI/SDK, instalación y flujo humano de consentimiento. No implementa criptografía propia ni lee correo sin autorización.
- **Despliegue**: Next.js Node.js Functions sin estado y PostgreSQL gestionado desde Marketplace (por ejemplo Neon). No depender del disco local de la función. Configuración compatible con Vercel y despliegue propio; secretos en entorno seguro.

Decisión de implementación inicial: Next.js App Router sirve las páginas humanas y los endpoints API bajo el mismo runtime Node.js, con TypeScript y migraciones SQL versionadas. Esto reduce despliegue/operación para el MVP; no impide que otra implementación compatible consuma la spec pública. Si el API necesita escalar u operar de forma independiente, separar servicios se decidirá con datos de uso, no antes.

## 6. Plan por fases y puertas de salida

Cada fase entrega algo utilizable, tiene una demostración de aceptación y puede detenerse si la hipótesis de producto falla. Las estimaciones de calendario se fijarán cuando se conozca el equipo; el orden y las dependencias sí son parte del plan.

### Fase 0 — Validar el problema, correo y alcance (sin subíndices)

**Trabajo**

1. Entrevistar un pequeño grupo de personas con agentes existentes y dos o tres organizaciones; elegir un caso concreto, por ejemplo recibir solicitudes de colaboración o presupuestos.
2. Probar con dos buzones dedicados y agentes que ya tengan acceso autorizado: registro por correo, ficha, mensaje humano, mensaje agente, respuesta, filtros y tratamiento de spam.
3. Evaluar AgentDex como referencia y posible integración, no solo por sus páginas: repos/CLI/skill, licencia, estado de npm, APIs, esquema, exportación, capacidad de escribir metadatos, modelo de claves y flujo real. Registrar hallazgos reproducibles.
4. Escribir ADRs: identidad vs cuenta, email, dirección pública/privada, clave OpenPGP, nombre/URL, privacidad, política de abuso y licencia.
5. Crear `agents-index/spec` y monorepo públicos con solo documentos, `README`, licencia y roadmap; definir cómo contribuir antes de aceptar aportaciones.
6. Prototipar PGP/MIME entre los proveedores de email que usen los participantes y verificar qué ocurre con firma, respuestas y cambios de formato. No requiere construir criptografía.

**No incluye** subíndices, federación, relay ntfy/Nostr propio, cuentas corporativas de pago ni buzones alojados por agents.index.

**Salida**: al menos dos agentes completan ida/vuelta usando email normal; los participantes aceptan publicar una dirección dedicada o una forma de contacto; queda decidido si el directorio almacena únicamente fichas o necesita alias de correo; las diferencias de AgentDex quedan verificadas; decisiones publicadas como ADRs.

### Fase 1 — Spec pública y contratos interoperables

**Trabajo**

1. Definir JSON Schema de tarjeta v0: `id`, `handle`, `display_name`, `summary`, `links`, `facets`, `services`, `capabilities`, `contact_methods`, `keys`, `verification`, `visibility`, `created_at`, `updated_at`, `schema_version`.
2. Diseñar enlaces a redes sociales mediante URL y tipo; los datos de perfil externo no se scrapean ni copian sin permiso.
3. Definir API: listar/buscar, obtener JSON, solicitar handle, verificar email, crear/actualizar/borrar, exportar, reportar y revocar clave.
4. Definir vocabulario para humanos, agentes, organizaciones y roles sin jerarquía rígida. Una identidad puede tener varios facets; evitar `type: human|agent|company` excluyente.
5. Definir spec de mensajes por email (headers y parte JSON opcional), anti-replay, tamaño, idempotencia, threads, respuestas, expiración, etiquetas de confianza y contenido no confiable.
6. Especificar la asociación OpenPGP opcional: formatos aceptados, fingerprint, reto de vinculación, validación de firma, rotación/revocación, comportamiento de clientes sin PGP.
7. Definir la resolución del alias `agent://` con índice predeterminado configurable, resultado HTTPS canónico, errores, URI reservadas y límites. Declarar que el esquema de URL es experimental y no universal.
8. Publicar documentos, fixtures, casos de conformidad, decisiones abiertas y calendario de compatibilidad.

**Salida**: dos implementaciones independientes pueden leer y validar una tarjeta; spec cubre errores/seguridad y no solo ejemplos felices; revisión pública con al menos una ronda de feedback.

### Fase 2 — Identidad, registro y tarjetas

**Trabajo**

1. Crear web pública: portada, búsqueda sencilla, detalle de tarjeta y página de instalación de skill.
2. Crear OTP por email sin contraseña: solicitud, verificación/canje, caducidad, un solo uso, HMAC/hash, límites y respuestas anti-enumeración, con plantilla ES/EN.
3. Registrar cuenta privada y tarjeta pública como entidades separadas. Verificación de email da estado “correo controlado”; no verificado no puede reclamar handle público.
4. Implementar reserva de handle, reglas de caracteres, nombres sensibles, suplantación, reclaim/disputas, renombrado, borrado y apelación con auditoría.
5. Agregar editor humano de campos públicos con vista previa y consentimiento granular. Los valores privados no aparecen en JSON público, HTML, logs ni motores de búsqueda.
6. Exponer endpoints GET públicos y mutaciones autenticadas con API keys de scopes limitados; generar `ETag`/`updated_at`; soportar exportar JSON y borrar ficha/cuenta.
7. Agregar CLI autónomo para pedir/canjear OTP, recibir una API key y registrar/actualizar tarjetas. No hay login web para el dueño; publicar solo datos aprobados por su operador.
8. Crear páginas JSON deterministas y fixtures de ejemplo personal/comercial (por ejemplo, datoga y mantenimiento de piscinas) sin datos reales.

**Salida**: alta/edición/borrado completa por API/CLI; tarjeta consumible sin login; email privado; clave devuelta una sola vez y revocable; usuario normal no puede iniciar sesión en web; exportación/importación preserva datos; logs no filtran secretos.

### Fase 2.1 — Consola de administración y bilingüismo

1. Añadir páginas humanas `/es` y `/en`, selector de idioma y traducciones para landing, ayuda, estados, privacidad, errores y correos OTP. El idioma no cambia la API.
2. Añadir consola `/admin` separada: login admin con OTP, listado/búsqueda/paginación de cuentas y fichas, suspensión/reactivación, borrado, reportes y auditoría.
3. Solo direcciones configuradas como administradores pueden abrir la consola. No es un login de propietario; los dueños administran sus fichas mediante API/CLI.
4. Bootstrap del primer admin fuera del auto-registro público. Ocultar correos personales según rol y auditar quién hizo qué y cuándo.

**Salida**: pantallas principales en ES/EN; solo admins permitidos administran usuarios; cada cambio admin queda auditado.

### Fase 3 — Companion skill, SDK, npm y onboarding de agentes

**Trabajo**

1. Publicar `skills/agents-index/SKILL.md` en formato Agent Skills, corto y con referencias a la spec y CLI. Instalable desde GitHub con `npx skills add <owner>/agents-index --skill agents-index`.
2. Publicar `@agents-index/sdk` y `@agents-index/cli` en npm con Node 24, API versionada, provenance y changelog; verificar nombres npm antes.
3. Hacer que la skill pueda: leer el `SKILL.md` oficial, resolver una ficha, resumir campos/capacidades, preparar una tarjeta y pedir consentimiento, registrar o actualizar con CLI.
4. No incluir instrucciones para exfiltrar tokens; el CLI mantiene tokens en almacenamiento local del usuario y los enmascara en stdout/logs.
5. Publicar guías para instalar skill globalmente o por proyecto, actualizar, fijar versión, revocar la integración y descargar manualmente para clientes no compatibles.
6. Validar carga real en runtimes representativos (Codex, OpenClaw u otros elegidos en piloto); documentar funciones no soportadas por cliente. La skill instalada no garantiza que el agente corra continuamente.

**Salida**: usuario puede instalar con un comando, un agente puede descubrir y leer tarjetas, preparar alta, detenerse para consentimiento humano y completar registro de prueba usando el CLI; la clave privada nunca aparece en el prompt.

Referencia de formato/instalación: [Agent Skills](https://agentskills.io/specification), [CLI skills](https://github.com/vercel-labs/skills). Confirmar compatibilidad y versión al comenzar, pues el ecosistema evoluciona.

### Fase 4 — Contacto por email y sincronización de inbox

**Trabajo**

1. Definir política pública por tarjeta: no disponible, email dedicado, web/contact form, MCP/A2A, disponibilidad, idioma, categorías y consentimiento para contacto.
2. Permitir al usuario verificar un email dedicado a agente y decidir si se publica. Evitar requerir que revele su buzón personal.
3. Añadir al SDK herramientas para preparar correo con `To`, `Reply-To`, `Message-ID`, `In-Reply-To`, `References` y cuerpo texto simple; la salida se confirma al humano según permisos del runtime.
4. Documentar filtros que separen mensajes de agente, carpeta dedicada, alias y reglas de forwarding; soporte de proveedores diferentes. No conectar Gmail mediante acceso total si un label/alias es suficiente.
5. Conector de lectura en cliente: preferir API/IMAP que el usuario ya utiliza. OAuth solo con scopes mínimos; revocación y rotación documentadas. Para el MVP el cliente sincroniza por polling o mecanismo ya disponible en el runtime.
6. Definir deduplicación por `Message-ID`, recuperación con cursor, tratamiento de rebotes, lista permitida/bloqueada y límites para proteger al agente del spam.
7. Implementar “solicitud de contacto” con respuesta automática opcional, límites por emisor y acciones de bloquear/reportar. No ejecutar instrucciones incluidas en mensajes de desconocidos.
8. Añadir métricas locales/privadas: entrega, recogida, respuesta; evitar inspeccionar el contenido para analítica.

**Salida**: A encuentra la tarjeta de B, contacta al email dedicado, B puede leer/responder desconectado y no procesa duplicados tras reconexión; una persona puede revisar, bloquear o apagar el canal; el directorio no almacena el cuerpo del mensaje.

### Fase 5 — Firma opcional OpenPGP y confianza

**Trabajo**

1. Generar clave OpenPGP local desde CLI o importar clave existente; advertir sobre backup, pérdida, expiración y revocación.
2. Vincular clave a `agent_id` y dirección de correo con reto nonce de un solo uso firmado y validado en backend.
3. Guardar/publicar fingerprint y clave pública, no el secreto. La ficha indica quién controla la clave según la evidencia: usuario, agente autónomo o empresa.
4. Firmar correos PGP/MIME donde sea compatible; proveer firma sobre el payload canónico para mensajes procesados automáticamente.
5. SDK receptor verifica la firma contra la clave anunciada y estado/revocación; conserva el correo original y reporta firma no válida/ausente sin descartar por defecto.
6. Añadir rotación con firma de la clave anterior cuando siga disponible; para clave perdida, recuperación por correo y confirmación humana con período de espera/notificación a contactos.
7. Documentar que firma no cifra; no llamar “privado” a un mensaje por estar firmado.

**Salida**: mensajes firmados verifican tras distintos proveedores; mensajes editados o claves revocadas se señalan; el cliente muestra diferencia entre identidad de correo y clave firmante. El cifrado extremo a extremo puede evaluarse con una clave separada en versión futura.

### Fase 6 — Piloto de comunidad y organizaciones

**Trabajo**

1. Incorporar usuarios con un flujo guiado y tareas reales, no registros ficticios para inflar el índice.
2. Crear vistas de equipo y roles: propietario, editor de tarjeta, operador de mensajes. Mantener identidad raíz de persona/organización sin imponer una taxonomía rígida.
3. Permitir que una organización publique varias tarjetas de agentes; esta fase aún no requiere índice federado ni namespace delegable.
4. Añadir reporte de abuso, suplantación, spam, suspensión y apelación; transparencia de cambios significativos.
5. Revisar contenido que puede causar daño si se publica (teléfonos, direcciones, datos sensibles) con avisos y confirmación explícita.
6. Investigar demanda por búsqueda avanzada, disponibilidad, mensajes proxy, métricas, capacidad, soporte y administración multiusuario.

**Salida**: al menos un problema real se resuelve repetidamente, organizaciones gestionan perfiles sin hackear el modelo personal y hay señales de recurrencia/retención. Si no hay conversaciones útiles, detener expansión técnica y revisar propuesta de valor.

### Fase 7 — Alias `agent://` estable y subíndices federados

**Trabajo**

1. Estabilizar gramática, percent-encoding, colisiones, ámbito de índice y reglas de resolución para alias.
2. Permitir en el registro de organización declarar que administra un subíndice y seguir actuando como agente general/contacto.
3. Verificar delegación mediante control de ambos dominios/índices; documentar quién puede registrar y revocar rutas.
4. Resolver `agent://carrefour/investors`; el índice raíz mantiene el puntero y no copia toda la base remota.
5. Añadir caché/expiración, timeout, límite de profundidad, detección de ciclos, firma/versionado del documento de delegación y comportamiento cuando el índice delegado está caído.
6. Proteger el resolver contra SSRF, DNS rebinding, redirecciones a redes internas, tamaños desmesurados y cadenas recursivas.
7. Definir portabilidad: exportar, cambiar proveedor de hosting y mover datos sin perder el ID estable; resolución directa HTTPS puede sobrevivir a una caída del índice raíz.

**Salida**: dos índices operados independientemente interoperan con las fixtures de spec; el cambio/revocación de delegación se refleja; no se requieren consultas recursivas ilimitadas; el agente general puede coexistir con el subíndice.

### Fase 8 — Alojamiento maduro, ingresos y gobernanza

**Trabajo**

1. Automatizar backup/restauración de PostgreSQL, migraciones, despliegues, rollback, alertas, registro de auditoría y rotación de secretos.
2. Definir SLOs según uso real, página de estado, proceso de incidentes y política de retención de cuenta/telemetría.
3. Añadir límites por usuario/IP, challenge adaptativo, cuotas de registro, defensa contra scraping y protección ante email enumeration.
4. Crear planes de pago únicamente para coste/valor incremental demostrado: administración de organización, soporte, analítica agregada, alias gestionados, capacidad adicional o subíndices gestionados.
5. Mantener cuenta personal gratuita y exportación/API pública; cobrar por hosting/servicio, no por impedir interoperabilidad de tarjeta.
6. Abrir gobernanza de spec: propuestas públicas, compatibility policy, versiones, proceso de adopción y mecanismo de retiro de campos.

**Salida**: un operador nuevo puede desplegar la referencia desde documentación pública; hay backups restaurados en ensayo; un usuario puede exportar y migrar; costes y límites de planes se entienden.

## 7. Seguridad, privacidad y abuso: requisitos transversales

- Separar datos públicos, de cuenta y secretos. Aplicar control de acceso y minimización a cada campo.
- No aceptar HTML de perfil/mensaje sin sanitización; bloquear o aislar URLs peligrosas; los agentes tratan texto recibido como datos, no como instrucciones con autoridad.
- Limitar tamaño, frecuencia y destinatarios; challenge/allowlist al inicio; bloquear y reportar; aplicar políticas contra suplantación, spam y acoso.
- Minimizar recolección de perfiles sociales. Enlaces públicos se guardan como URL declarada, se muestran como no verificados salvo prueba de dominio independiente.
- Diseñar CORS, CSRF, XSS, SSRF en búsqueda/resolución, SQL injection, enumeración de correo/handles y abuso de registro.
- No registrar cuerpos, credenciales, tokens OAuth, claves privadas o links mágicos. Redactar logs y definir retención.
- PGP de email no sustituye TLS, protección del buzón, política anti-spam ni control de permisos del agente.
- La especificación distingue afirmaciones declaradas de pruebas observables (control de email, firma de clave, control de dominio y revisión humana).

## 8. Métricas y criterio de producto

Medir en piloto con consentimiento y agregación:

- tasa de registro completado sin ayuda y tiempo hasta publicar tarjeta;
- fichas con una forma de contacto utilizable y consentimiento explícito;
- contactos relevantes por tarjeta, respuestas y tiempo hasta respuesta;
- proporción de mensajes bloqueados/reportados y tiempo de moderación;
- repetición de uso a 30/60 días y organizaciones que renuevan/actualizan tarjetas;
- porcentaje de flujos completados usando CLI/skill sin copiar secretos en conversación.

No optimizar solo por número de perfiles. La señal central es que agentes/personas encuentren contactos y construyan algo juntos. Si no hay valor en el piloto, pausar federación, cobro e integraciones complejas.

## 9. Riesgos y decisiones que se deben revisar

| Riesgo/decisión | Cuándo resolverlo | Respuesta inicial |
|---|---|---|
| ¿Directorio publica el email? | Fase 0 | Solo email dedicado y con opt-in; proxy si la privacidad lo exige |
| ¿El agente puede leer buzón completo? | Antes de conectar proveedor | No; usar alias/label/scope mínimo o mailbox dedicado |
| ¿El correo basta para conversaciones útiles? | Fase 0–4 | Probar con usuarios; API de inbox futura si falla recuperación/control |
| ¿OpenPGP será usable por clientes? | Fase 0/5 | Opcional; medir interoperabilidad; no bloquear mensajes sin firma |
| ¿Construir sobre AgentDex? | Fase 0 | Evaluar código/APIs/licencia en entorno de prueba; decidir integración o diferenciación |
| ¿Alias `agent://` se abre en clientes comunes? | Fase 1/7 | HTTPS canónico; skill/CLI resuelve alias al inicio |
| ¿Hace falta alias de correo del directorio? | Fase 4 | Implementar solo si usuarios no quieren publicar dirección dedicada |
| ¿Cuándo federar? | Fase 7 | Después de directorio y contacto útiles en un único índice |
| ¿Qué cobrar? | Fase 6–8 | Organizaciones, soporte y capacidades gestionadas si existe demanda |

## 10. Orden de ejecución recomendado

1. Fase 0: validar flujo de email real y solapamiento con AgentDex.
2. Abrir repos públicos y publicar ADRs/spec iniciales.
3. Implementar registro, tarjeta pública, JSON y exportación.
4. Publicar SDK/CLI/skill instalable y probar con agentes de runtimes distintos.
5. Añadir envío/lectura de email con permisos explícitos, filtro anti-spam y manejo de respuestas.
6. Incorporar OpenPGP opcional cuando el recorrido base funcione.
7. Piloto de personas y equipos; decidir si hace falta un email proxy.
8. Estabilizar protocolo; después crear subíndices federados y monetización.

## 11. Referencias de partida

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases) — confirmar estado LTS al iniciar y actualizar periódicamente.
- [Vercel Functions](https://vercel.com/docs/functions) y [Postgres en Vercel](https://vercel.com/docs/postgres) — endpoints serverless y PostgreSQL de Marketplace; no usar filesystem local para persistencia.
- [Gmail filters](https://support.google.com/mail/answer/6579?hl=es) — filtros y reenvíos configurables por el usuario.
- [Gmail API push notifications](https://developers.google.com/workspace/gmail/api/guides/push) — notificación no sustituye sincronización/recuperación y requiere renovación.
- [OpenPGP RFC 9580](https://www.rfc-editor.org/rfc/rfc9580.html) — formato, firmas, claves y gestión.
- [PGP/MIME RFC 3156](https://www.rfc-editor.org/rfc/rfc3156.html) — firma/cifrado OpenPGP en correo MIME y riesgos de transformación por gateways.
- [Agent Skills](https://agentskills.io/specification) y [CLI de skills](https://github.com/vercel-labs/skills) — formato e instalación propuestos; validar versiones.
- [Investigación de proyectos existentes](EXISTING_PROJECTS.md) — AgentDex, AgentDM, ANP, AGNTCY/ADS, ANS y Global Registry Master.
