# Proyectos relacionados y distribución de la companion skill

Consultado el 14 de octubre de 2026. Investigación de documentación, sitios y repositorios públicos. No se han creado cuentas, instalado clientes ni probado las APIs; las capacidades descritas por los proyectos requieren una prueba antes de elegirlos como dependencia.

## Coincidencias más relevantes

### AgentDex

La coincidencia de producto más cercana encontrada y solapamiento directo con el núcleo de la idea: directorio de agentes sobre Nostr, acceso para humanos y agentes, claves generadas desde CLI, registro de un evento firmado, perfiles, capacidades, búsqueda e instrucciones `SKILL.md`. La tarjeta `kind:31339` documenta `owner_type` (human, agent, org), capacidades, experiencia, portfolio, website, pagos y un campo `parent`. Por tanto, registro autónomo básico, identidad con clave, ficha pública con enlaces/capacidades y companion skill no serían diferenciadores por sí solos.

Su página indica «Soy un humano»/«Soy un agente» y ofrece sign-in para gestionar el perfil. No queda claro si el producto está orientado a que la tarjeta sea el alter ego/contact card personal de un humano y espacio flexible de negocio. La documentación no describe inbox directo NIP-17 ni resolución de `agent://` o subíndices. Un tipo de evento para peticiones de tareas A2A aparece señalado como planificado para fase 7, lo que sugiere que la colaboración transaccional aún no está disponible según los docs consultados. Esto no demuestra la ausencia absoluta de funciones fuera de la documentación.

Una firma del perfil prueba autoría/control de la clave, no la veracidad de toda la experiencia declarada. La documentación del CLI es inconsistente sobre su publicación en npm: ofrece `npx agentdex-cli register`, pero también dice que aún no está en npm y que debe instalarse desde GitHub. Comprobar el flujo real antes de depender de él. Que haya repositorios públicos de CLI y skill no demuestra que todo el servicio sea autoalojable o reutilizable bajo una licencia compatible.

Fuentes: [web](https://agentdex.id/), [API y metadatos](https://agentdex.id/docs), [spec del perfil kind:31339](https://agentdex.id/kind31339), [CLI/SDK](https://github.com/Koda-Builds/agentdex-cli), [skill para OpenClaw](https://github.com/Koda-Builds/openclaw-agentdex).

### Patrones que merece la pena tomar como referencia

1. **Dos capas de perfil.** La spec reserva el perfil Nostr estándar kind:0 para nombre, avatar, bio, web y NIP-05, y usa kind:31339 para extensiones propias de agentes: capacidades repetibles, nivel de skills, portfolio, experiencia, framework y estado. Mantiene la compatibilidad con perfiles Nostr normales y evita meter toda la ficha en un campo opaco. Evaluar este diseño para interoperar; kind:31339 sigue siendo una convención documentada por AgentDex, y hay que confirmar su adopción fuera del proyecto antes de tratarla como formato común.
2. **Perfil declarativo firmado.** La tarjeta es un evento reemplazable firmado con la clave del agente, que el propietario puede actualizar. La web puede indexar y enriquecer la visualización sin ser la única copia autoritativa. Distinguir claramente evento firmado de afirmaciones verificadas por terceros.
3. **Tres vías de incorporación.** Ofrece CLI, navegador con firma del cliente Nostr NIP-07 y publicación raw para otros clientes. No todos los usuarios tienen experiencia con claves; ofrecer un recorrido de navegador/owner claim puede bajar esa barrera.
4. **Estados de verificación separados.** Sus docs describen progresión desde descubierto y registrado hasta reclamado por un humano y verificado. Es buena idea mostrar exactamente qué prueba cada estado: existencia, control de clave, vínculo con operador, control del dominio o revisión humana. Evitar una insignia única que parezca certificar todas las afirmaciones.
5. **Portfolio verificable.** Permite probar control de una URL alojando una etiqueta meta o `/.well-known/agentdex.json`. Es una prueba automatizable del dominio/enlace y da evidencia externa a una ficha autocontenida.
6. **Skill + superficie legible para personas.** La portada muestra instrucciones específicas para entregar al agente y ofrece un sitio para buscar/gestionar. Una skill debe ser corta, instalable y respaldada por un cliente con contratos de API; las instrucciones solas no administran de forma segura las claves.

### Reutilización de código y cosas por confirmar

El repo `agentdex-cli` declara MIT, así que puede ser un punto de partida de código con atribución y cumplimiento de la licencia. Es una herramienta de CLI/SDK, no la implementación completa del sitio, directorio ni relay. Antes de incorporarla, revisar el contenido actual, licencias de dependencias, mantenimiento, gestión de claves y llamadas a la API. Su README usa el paquete/comando `agentdex`, mientras que la documentación del sitio aún presenta `agentdex-cli`; no he comprobado la instalación npm y el repositorio no muestra releases publicados. Fijar un commit o versión probada antes de adoptar.

La spec de `kind:31339` se presenta como abierta, pero es el formato propio de perfiles AgentDex, no debe asumirse como NIP formal/interoperable sin verificar estatus y adopción independiente. Tampoco copiaría directamente su decisión de usar la clave Nostr de identidad como secreto operativo sin estudiar custodia, recuperación y separación de permisos.

### AgentDM

Servicio de comunicación entre agentes con alias, integración MCP/A2A, tarjetas A2A y acceso de autorregistro anunciado desde su portada. Describe herramientas para enviar, leer y consultar el estado de mensajes. También publica un runner/CLI que puede mantener un agente conectado.

Se presenta como plataforma alojada. No se ha establecido en esta investigación que ofrezca cifrado de extremo a extremo compatible con la propuesta ni federación de índices independientes. Es una referencia para la experiencia de incorporación y mensajería, no una equivalencia de todas las garantías.

Fuente: [sitio y flujo de incorporación](https://agentdm.ai/).

### Agent Network Protocol (ANP)

Suite abierta con identidad DID, documentos de descripción, descubrimiento entre dominios y perfiles de mensajería. Su guía describe descubrimiento activo mediante `/.well-known/agent-descriptions` y registro de URLs de descripción en servicios de búsqueda. Sus perfiles incluyen mensajería directa, recibos, cifrado y federación.

Es especialmente relevante para evaluar una opción de endpoints HTTPS y servicio propio de mensajes. La existencia de especificaciones y SDKs no acredita por sí sola interoperabilidad operativa completa ni una comunidad activa de destinatarios.

Fuentes: [repositorio](https://github.com/agent-network-protocol/AgentNetworkProtocol), [guía oficial](https://github.com/agent-network-protocol/AgentNetworkProtocol/blob/main/docs/anp-getting-started-guide.md).

### AGNTCY / Agent Directory Service

Infraestructura abierta de descubrimiento federado: registros OASF, publicación de capacidades y enrutamiento distribuido. AGNTCY incluye otros componentes de identidad y mensajería. ADS tiene documentación, implementación, herramientas y una red de prueba de federación.

Es una referencia técnica para las fases posteriores; su enfoque de registros y despliegues requiere evaluar cuánto encaja con una card sencilla para personas y pequeños negocios. La federación de ADS no debe confundirse con la delegación de rutas jerárquicas propuesta para agents.index.

Fuentes: [panorama de AGNTCY](https://docs.agntcy.org/), [ADS](https://dir.agntcy.org/latest/dir/dir-overview/), [implementación](https://github.com/agntcy/dir).

### Agent Name Service (ANS) / GoDaddy

GoDaddy ofrece un registro y búsqueda de agentes con identidad anclada a dominios, DNS y certificados. Su documentación describe nombres `ans://`, versiones y registros de transparencia. Es relevante para nombres y vinculación con organizaciones, y no constituye por sí solo una solución de inbox privado o de perfil personal.

Fuentes: [registro de agentes](https://www.godaddy.com/es/ANS), [explicación técnica](https://www.godaddy.com/resources/news/dont-trust-verify-offline-sub-millisecond-agent-verification-with-ans).

### Global Registry Master

Este repositorio describe un registro que contiene entradas directas de agentes y entradas de namespaces con `sub_index_url`. La idea se parece mucho al subíndice anunciado por el raíz. Sin embargo, sus ejemplos diferencian los tipos `direct` y `federated`, mientras que nuestra propuesta permite que la misma entrada tenga ambas funciones.

No se ha probado el servidor ni establecido madurez o relación organizativa con los proyectos NANDA mencionados en los ejemplos. El README deja un marcador pendiente en la sección de licencia: no asumir permiso de reutilización por ser un repositorio público.

Fuente: [repositorio y modelo de datos](https://github.com/aidecentralized/registry-master).

## Qué cambia en el plan actual

La exploración de AgentDex sigue siendo necesaria antes de construir perfiles e identidad desde cero, pero el planteamiento actual ya no toma Nostr como mensajería inicial. La hipótesis a validar es que el correo dedicado del usuario es el canal de contacto y almacenamiento de la primera versión, con OpenPGP opcional para firmas. No se asume que AgentDex proporcione ese flujo de email o firmas OpenPGP; se debe verificar en sus APIs y clientes durante el spike.

La diferenciación hipotética de agents.index sigue siendo el alter ego/contact card de la persona (LinkedIn y otros perfiles), sus actividades personales y comerciales flexibles, contacto que aprovecha el buzón ya autorizado al agente y, más adelante, resolución federada de subíndices. Antes de implementarla hay que comprobar si AgentDex ya cubre algunos de esos casos, si su API permite interoperar y qué licencias/gobernanza tendría una integración.

El siguiente spike recomendado es instalar y ejecutar el CLI/skill de AgentDex en un entorno de prueba, registrar una identidad ficticia, consultar su perfil/API, comprobar lectura y actualización desde un cliente independiente, y revisar qué datos son públicos. En paralelo, probar dos agentes por email dedicado, filtros y firmas OpenPGP/MIME con proveedores distintos. No reutilizar una clave personal ni publicar datos reales durante estos experimentos.

No iniciar subíndices, federación ni relay Nostr propio en fase 0. Estudiar ANP si el correo no cubre el contacto recuperable o si se necesita un inbox API interoperable; revisar ADS/ANS al abordar federación e identidad de empresas. Los subíndices quedan reservados a una fase posterior del plan.

## Publicación e instalación de la companion skill

### Fuente y formato

Mantener un único origen en un repositorio público de GitHub, con una carpeta `skills/agents-index/` que contenga `SKILL.md` y referencias. Usar el formato abierto Agent Skills: metadatos YAML y cuerpo Markdown. Definir versión, licencia, compatibilidad y dependencias. El identificador `agents-index` es provisional.

Fuente: [especificación Agent Skills](https://agentskills.io/specification).

### Instalación

El CLI abierto `skills` instala skills desde GitHub y anuncia compatibilidad con múltiples clientes. Comando propuesto, aún no ejecutable porque el repositorio público y la skill no se han publicado:

```sh
npx skills add <owner>/<repo> --skill agents-index
```

Publicar instrucciones para elegir instalación por proyecto o global. Documentar también descarga/copia manual para clientes que no tengan Node.js o no soporten el instalador. Validar instalación y carga real en los clientes elegidos para el piloto; instalar archivos no garantiza que el runtime los active o disponga de todas las dependencias.

Fuente: [CLI y formatos de fuente](https://github.com/vercel-labs/skills).

### Descubrimiento

La portada propia debería ofrecer un botón de instalación, referencia al repositorio y un enlace estable a `/skill.md`. La versión web debe generarse desde la misma fuente y conservar referencias accesibles; leerla permite incorporación en una sesión, mientras que persistir la skill depende del runtime.

Skills.sh es un canal adicional de descubrimiento. Su FAQ explica que las skills aparecen mediante telemetría de instalaciones del CLI; no exige una solicitud manual de alta para ese leaderboard. Publicar el repositorio ya permite instalar por URL aunque la skill todavía no tenga visibilidad en el catálogo. No prometer posición, fecha de aparición ni compatibilidad universal.

Fuentes: [docs](https://skills.sh/docs), [FAQ de publicación](https://skills.sh/docs/faq).

### Versiones y momento de entrega

Publicar versiones y un changelog; documentar actualizaciones explícitas y cómo volver a una versión conocida. Mantener separado el alcance de las instrucciones y el del cliente ejecutable que administra claves y mensajes.

En fase 0 se define el empaquetado. En fase 1 se entrega la skill mínima instalable de registro y tarjetas. En fases 2–3 se amplía con mensajes y validación entre runtimes. Los plugins específicos de cada cliente quedan como canales complementarios si el piloto demuestra que simplifican la incorporación.
