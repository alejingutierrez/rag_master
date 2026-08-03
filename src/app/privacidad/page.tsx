import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/editorial-page.css";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Privacidad y analítica",
    metaDescription:
      "Cómo Historia Colombiana usa Google Analytics, qué datos de navegación mide, cuánto tiempo los conserva y cómo cambiar el consentimiento.",
    keywords: ["privacidad", "Google Analytics", "cookies", "datos personales"],
  },
  path: "/privacidad",
  type: "website",
});

const privacyEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "malgutierrezar@gmail.com";

export default function PrivacidadPage() {
  return (
    <PublicShell>
      <div className="edp-wrap">
        <header className="edp-head">
          <div className="edp-kick">Privacidad</div>
          <h1 className="edp-title">Medir lo necesario, explicar lo medido</h1>
          <p className="edp-stand">
            Este archivo puede leerse sin aceptar analítica. La medición se activa únicamente
            después de una elección afirmativa y esa elección se puede cambiar.
          </p>
        </header>

        <div className="edp-body">
          <div className="edp-col">
            <section className="edp-sec">
              <span className="edp-sec-n">01 · Responsable y finalidad</span>
              <h2 className="edp-h2">Para qué se usa la analítica</h2>
              <div className="prose edp-prose">
                <p>
                  El responsable de Historia Colombiana y de esta medición es Alejandro Gutiérrez
                  Arango. La analítica se usa para saber, de forma agregada, qué partes del archivo
                  se consultan, cómo llegan los lectores y dónde conviene mejorar la navegación.
                </p>
                <p>
                  No vendemos datos, no usamos formularios de perfilamiento y no enviamos a Google
                  nombres, correos ni el texto que un lector escriba. El panel administrativo y la
                  página de acceso están excluidos de la medición.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">02 · Qué se mide</span>
              <h2 className="edp-h2">Datos de navegación, no una identidad civil</h2>
              <div className="prose edp-prose">
                <p>
                  Si se acepta la analítica, Google Analytics 4 puede registrar estadísticas de
                  sesión, ubicación aproximada, navegador, dispositivo y eventos de medición
                  mejorada como vistas de página, desplazamientos, búsquedas internas, descargas y
                  clics de salida. La cookie propia <code>_ga</code> asigna un identificador de
                  cliente para distinguir navegadores y sesiones.
                </p>
                <p>
                  Historia Colombiana añade un evento editorial al abrir una pieza: el tipo de
                  contenido, su identificador y su título. Esos valores describen la página leída,
                  no a la persona que la lee. Google informa que utiliza la dirección IP durante la
                  recogida para derivar ubicación aproximada y la descarta antes de registrar los
                  datos en Analytics.
                </p>
                <p className="edp-note">
                  Detalle técnico oficial: {" "}
                  <a href="https://support.google.com/analytics/answer/11593727?hl=es" target="_blank" rel="noreferrer">
                    datos que recoge Google Analytics
                  </a>{" "}
                  y {" "}
                  <a href="https://support.google.com/analytics/answer/11598602?hl=es" target="_blank" rel="noreferrer">
                    tratamiento regional de direcciones IP
                  </a>.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">03 · Consentimiento</span>
              <h2 className="edp-h2">Nada se envía antes de aceptar</h2>
              <div className="prose edp-prose">
                <p>
                  Implementamos el modo de consentimiento básico: Google Tag Manager y Google
                  Analytics no se descargan ni transmiten datos antes de que el lector pulse
                  «Aceptar analítica». Rechazar no limita el acceso al archivo.
                </p>
                <p>
                  La decisión se guarda en el almacenamiento local del navegador bajo la clave
                  <code> hc_analytics_consent_v1</code>. El botón «Privacidad», visible al pie de la
                  pantalla, permite volver a abrir las preferencias. También se puede borrar la
                  elección eliminando los datos locales del sitio en el navegador.
                </p>
                <p className="edp-note">
                  Google describe la diferencia entre consentimiento básico y avanzado en su {" "}
                  <a href="https://support.google.com/tagmanager/answer/10000067?hl=es" target="_blank" rel="noreferrer">
                    documentación de Consent Mode
                  </a>.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">04 · Proveedor y conservación</span>
              <h2 className="edp-h2">Google Analytics 4, durante catorce meses</h2>
              <div className="prose edp-prose">
                <p>
                  La etiqueta se administra con Google Tag Manager y envía la medición a la
                  propiedad de Google Analytics 4 de Historia Colombiana. Google actúa como
                  proveedor tecnológico conforme a sus condiciones y términos de tratamiento de
                  datos.
                </p>
                <p>
                  La retención de datos de usuario y de eventos de esta propiedad está configurada
                  en catorce meses. Esta opción rige los datos no agregados usados en exploraciones;
                  los informes agregados estándar se rigen por el funcionamiento propio de
                  Analytics. La preferencia local permanece hasta que el lector la cambie o borre.
                </p>
                <p className="edp-note">
                  Consulte la {" "}
                  <a href="https://policies.google.com/privacy?hl=es" target="_blank" rel="noreferrer">política de privacidad de Google</a>,
                  los {" "}
                  <a href="https://marketingplatform.google.com/about/analytics/terms/es/" target="_blank" rel="noreferrer">términos de Google Analytics</a>{" "}
                  y la {" "}
                  <a href="https://support.google.com/analytics/answer/7667196?hl=es" target="_blank" rel="noreferrer">documentación de retención</a>.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">05 · Derechos y contacto</span>
              <h2 className="edp-h2">Consultar, corregir o solicitar la supresión</h2>
              <div className="prose edp-prose">
                <p>
                  La legislación colombiana reconoce, entre otros, los derechos a conocer,
                  actualizar y rectificar los datos personales, pedir prueba de la autorización,
                  conocer su uso y solicitar la supresión o revocar la autorización cuando
                  corresponda.
                </p>
                <p>
                  Para consultas o solicitudes de privacidad, escriba a {" "}
                  <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>. Indique con claridad la
                  solicitud y un medio para recibir respuesta.
                </p>
                <p className="edp-note">
                  Marco de referencia: {" "}
                  <a href="https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981" target="_blank" rel="noreferrer">
                    Ley Estatutaria 1581 de 2012
                  </a>{" "}
                  y orientación de la {" "}
                  <a href="https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/politicas-de-tratamiento-de-datos-personales" target="_blank" rel="noreferrer">
                    Superintendencia de Industria y Comercio
                  </a>.
                </p>
              </div>
            </section>

            <section className="edp-sec">
              <span className="edp-sec-n">06 · Vigencia</span>
              <h2 className="edp-h2">Una política que debe coincidir con el código</h2>
              <div className="prose edp-prose">
                <p>
                  Esta versión entra en vigor el 3 de agosto de 2026. Si cambia la medición, el
                  proveedor o la finalidad, esta página se actualizará antes de activar el cambio.
                </p>
              </div>
            </section>
          </div>

          <aside className="edp-rail">
            <span className="edp-rail-t">El proyecto</span>
            <Link href="/acerca" className="edp-rail-l">Acerca</Link>
            <Link href="/como-trabajamos" className="edp-rail-l">Cómo trabajamos</Link>
            <Link href="/fuentes" className="edp-rail-l">Fuentes</Link>
            <Link href="/criterios-editoriales" className="edp-rail-l">Criterios editoriales</Link>
            <Link href="/autor" className="edp-rail-l">El autor</Link>
            <Link href="/privacidad" className="edp-rail-l" aria-current="page">Privacidad</Link>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
