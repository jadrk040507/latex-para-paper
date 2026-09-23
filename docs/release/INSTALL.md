# Instalar permanentemente en Firefox

Firefox estable necesita una firma de Mozilla para una instalación permanente. La carga temporal en about:debugging se elimina al reiniciar Firefox.

1. Entra en https://addons.mozilla.org/developers/ con tu cuenta Mozilla.
2. Elige enviar un complemento nuevo y distribución **On this site / En este sitio** para publicarlo en Firefox Add-ons. La distribución **On your own** sirve para compartirlo fuera del catálogo; no es el objetivo del lanzamiento público.
3. Sube `latex-para-paper-VERSION-unsigned.zip` de `dist/releases`.
4. Cuando pregunte por el código fuente, sube `latex-para-paper-VERSION-source.zip`. Las instrucciones de compilación están incluidas.
5. Completa la ficha pública usando `AMO_LISTING.md`, añade capturas reales y los datos del autor y soporte. Revisa personalmente cualquier acuerdo de desarrollador que Mozilla solicite. Completa el envío y espera el resultado de Mozilla.
6. Cuando esté disponible la ficha pública, instala desde Firefox Add-ons y permite acceso a Dropbox. También puedes instalar el `.xpi` firmado mediante about:addons → engranaje → Instalar complemento desde archivo.
7. Comprueba que la extensión sigue instalada tras cerrar y abrir Firefox.

El ID se conserva respecto a la versión temporal para mantener la identidad del complemento. No cambies el nombre del ZIP a XPI para intentar evitar la firma: eso no lo firma. No es necesario reducir la seguridad de Firefox.

Antes de enviar la versión 0.4.0, confirmar mk/dm en Paper real. El paquete está preparado para firma, pero no es una afirmación de firma o instalación ya realizadas.

Fuentes oficiales:
- https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/
- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://extensionworkshop.com/documentation/publish/install-self-distributed/
