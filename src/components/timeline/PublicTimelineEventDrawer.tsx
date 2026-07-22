"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PeriodTag } from "@/components/editorial";
import { CATEGORIES, type CategoryCode, type PeriodCode, PERIODS } from "@/lib/design-tokens";
import type { TimelineLinkPiece, PeriodTimelineLinks } from "@/lib/public-data";
import { fmtYearSpan, type TimelineEventData } from "./TimelineEventDrawer";
import "./public-timeline.css";
import { imageAt } from "@/lib/image-url";

/** Suscripción nula: solo sirve para distinguir servidor de cliente. */
const sinSuscripcion = () => () => {};

const ACENTOS = /[̀-ͯ]/g;
/** Palabras vacías del español: no distinguen un hecho de otro. */
const VACIAS = new Set(
  ("de la el los las y en del a al un una para por con su sus e o entre sobre desde hasta " +
    "como mas mientras tras ante bajo segun sin durante contra").split(" "),
);

/** Términos distintivos de un título, normalizados y sin repetir. */
function terminos(texto: string): string[] {
  return [
    ...new Set(
      texto
        .normalize("NFD")
        .replace(ACENTOS, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 3 && !VACIAS.has(t)),
    ),
  ];
}

/**
 * Cuánto comparten dos títulos, entre 0 y 1: términos distintivos en común sobre
 * el menor de los dos conjuntos. Se usa el menor a propósito, para que un título
 * corto ("Camellones del bajo San Jorge") pueda casar al 100 % con su versión
 * larga ("Camellones del bajo San Jorge e intensificación agrícola").
 */
function afinidad(a: string, b: string): number {
  const A = terminos(a);
  const B = new Set(terminos(b));
  if (A.length === 0 || B.size === 0) return 0;
  let comunes = 0;
  for (const t of A) if (B.has(t)) comunes++;
  return comunes / Math.min(A.length, B.size);
}

/** Un evento solo anuncia una ficha si comparten claramente el asunto. */
const AFINIDAD_MINIMA = 0.5;
/** Holgura de años: el evento y su ficha pueden fechar el mismo proceso distinto. */
const HOLGURA = 3;

/**
 * Casa cada evento con el hecho publicado que lo cuenta, POR EL ASUNTO.
 *
 * Antes se casaba por cercanía de año con asignación exclusiva, y eso era falso:
 * medido sobre el corpus, el 70 % de los pares no tenía ninguna relación temática.
 * Peor, la exclusividad producía un corrimiento en cascada — cada evento se
 * quedaba con la ficha del siguiente, de modo que "Real Audiencia de Santafé"
 * (1549) anunciaba "Catástrofe demográfica" (1550) aunque su ficha exacta existía.
 *
 * Los eventos y las fichas se producen del mismo material, así que sus títulos se
 * corresponden casi literalmente: comparar los términos distintivos es una señal
 * mucho más fiable que el año. El año queda solo como comprobación de coherencia.
 * Sin afinidad suficiente el evento NO ofrece enlace: es preferible un evento sin
 * ficha a un evento que promete el hecho equivocado.
 */
export function matchHechos(
  events: TimelineEventData[],
  hechos: TimelineLinkPiece[],
): Map<string, TimelineLinkPiece> {
  const out = new Map<string, TimelineLinkPiece>();
  // Si dos eventos reclaman la misma ficha, se la queda el de mayor afinidad.
  const mejorPorFicha = new Map<string, { evId: string; score: number }>();

  for (const ev of events) {
    let mejor: { hecho: TimelineLinkPiece; score: number } | null = null;
    for (const h of hechos) {
      // Coherencia temporal: descarta homónimos de otro siglo, sin decidir nada.
      if (h.anio != null && (h.anio < ev.anioInicio - HOLGURA || h.anio > ev.anioFin + HOLGURA)) {
        continue;
      }
      const score = afinidad(ev.titulo, h.titulo);
      if (score < AFINIDAD_MINIMA) continue;
      if (!mejor || score > mejor.score) mejor = { hecho: h, score };
    }
    if (!mejor) continue;

    const disputa = mejorPorFicha.get(mejor.hecho.href);
    if (disputa && disputa.score >= mejor.score) continue;
    if (disputa) out.delete(disputa.evId);
    mejorPorFicha.set(mejor.hecho.href, { evId: ev.id, score: mejor.score });
    out.set(ev.id, mejor.hecho);
  }
  return out;
}

/**
 * Drawer PÚBLICO del evento. Va en un PORTAL a <body> porque la página envuelve
 * su contenido en `.fade-up`, cuyo `transform` residual crearía un containing
 * block y anclaría este panel `fixed` al alto de la página en vez del viewport.
 *
 * Cuando el evento tiene su hecho ya publicado, el cuerpo abre con un AVANCE
 * real de la ficha (portada, bajante, por qué importa, protagonistas) e invita
 * a leerla completa. Sin ficha casada no se inventa ningún enlace.
 */
export function PublicTimelineEventDrawer({
  event,
  periodoCode,
  links,
  hecho,
  entityHrefs,
  onClose,
}: {
  event: TimelineEventData | null;
  periodoCode: PeriodCode;
  links?: PeriodTimelineLinks;
  /** Hecho publicado que cuenta este evento (o null si no hay). */
  hecho?: TimelineLinkPiece | null;
  entityHrefs?: Record<string, string>;
  onClose: () => void;
}) {
  const open = event !== null;
  const eventId = event?.id ?? null;
  const panelRef = useRef<HTMLElement | null>(null);
  // El portal solo existe en cliente: en el render del servidor no hay <body>.
  // El store vacío devuelve false en SSR/hidratación y true ya montado.
  const mounted = useSyncExternalStore(sinSuscripcion, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Con el drawer abierto el fondo no se mueve; se compensa el ancho de la
  // barra de scroll para que la página no dé un salto lateral al abrirlo.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const overflowPrevio = body.style.overflow;
    const paddingPrevio = body.style.paddingRight;
    const barra = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (barra > 0) body.style.paddingRight = `${barra}px`;
    return () => {
      body.style.overflow = overflowPrevio;
      body.style.paddingRight = paddingPrevio;
    };
  }, [open]);

  // Cada evento entra desde arriba: nunca se hereda el scroll del anterior.
  useEffect(() => {
    if (!eventId) return;
    panelRef.current?.scrollTo({ top: 0 });
  }, [eventId]);

  if (!mounted) return null;

  const period = PERIODS[periodoCode];
  const pcStyle = { "--pc": `var(--p-${period.slug})` } as CSSProperties;

  return createPortal(
    <>
      <div className="ptl-scrim" data-open={open ? "true" : "false"} onClick={onClose} />
      <aside
        ref={panelRef}
        className="ptl-drawer"
        data-open={open ? "true" : "false"}
        style={pcStyle}
        role="dialog"
        aria-modal="true"
        aria-label={event ? event.titulo : "Detalle del evento"}
        aria-hidden={!open}
      >
        {event && (
          <DrawerContent
            key={event.id}
            ev={event}
            periodoCode={periodoCode}
            hecho={hecho ?? null}
            epoca={links?.epoca ?? null}
            entityHrefs={entityHrefs}
            onClose={onClose}
          />
        )}
      </aside>
    </>,
    document.body,
  );
}

function DrawerContent({
  ev,
  periodoCode,
  hecho,
  epoca,
  entityHrefs,
  onClose,
}: {
  ev: TimelineEventData;
  periodoCode: PeriodCode;
  hecho: TimelineLinkPiece | null;
  epoca: { href: string; titulo: string } | null;
  entityHrefs?: Record<string, string>;
  onClose: () => void;
}) {
  const cat = CATEGORIES[ev.categoria as CategoryCode];
  const yearsLabel = fmtYearSpan(ev.anioInicio, ev.anioFin);
  // Si la ficha publicada ya trae su propio "por qué importa", el del evento no
  // se repite: el drawer no debe decir dos veces lo mismo con otras palabras.
  const porQueEvento = hecho?.porQueImporta.trim() ? "" : ev.porQueImporta.trim();

  return (
    <>
      <header className="ptl-dhead">
        <div className="ptl-dhead-y">EVENTO · {yearsLabel}</div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="ptl-dclose">
          ✕ ESC
        </button>
      </header>

      <div className="ptl-dbody">
        <div>
          <div className="ptl-dyear">{yearsLabel}</div>
          <h2 className="ptl-dt">{ev.titulo}</h2>
        </div>

        <div className="ptl-dtags">
          <PeriodTag code={periodoCode} size="md" showName />
          {cat && <span className="ptl-dcat">{cat.label}</span>}
        </div>

        <p className="ptl-dsum">{ev.resumen}</p>

        {hecho && <HechoAvance hecho={hecho} />}

        {porQueEvento && (
          <section>
            <h3 className="ptl-sec-t">Por qué importa</h3>
            <blockquote className="ptl-quote">{porQueEvento}</blockquote>
          </section>
        )}

        <section>
          <h3 className="ptl-sec-t">{ev.curated ? "Atención del corpus" : "Relevancia en el corpus"}</h3>
          <div
            className="ptl-dgrid"
            style={{ gridTemplateColumns: ev.curated ? "1fr 1fr" : "1fr 1fr 1fr" }}
          >
            {ev.curated ? (
              <Metric label="Menciones" value={ev.evidencia.nPreguntas} />
            ) : (
              <>
                <Metric label="Preguntas" value={ev.evidencia.nPreguntas} />
                <Metric label="Obras" value={ev.evidencia.nLibros} />
              </>
            )}
            <Metric label="Peso" value={ev.evidencia.peso} suffix="/100" />
          </div>
          <div className="ptl-dbar">
            <i style={{ width: `${ev.evidencia.peso}%` }} />
          </div>
          <p className="ptl-dnote">
            {ev.curated
              ? "Hecho añadido por curaduría historiográfica (no minado). La cifra es el número de preguntas del corpus que mencionan a sus protagonistas; su peso pondera esa atención."
              : `Calibrado por cuánto interroga el corpus este momento: número de preguntas y de obras distintas ancladas a ${yearsLabel}.`}
          </p>
        </section>

        {ev.entidadesClave.length > 0 && (
          <section>
            <h3 className="ptl-sec-t">Entidades clave</h3>
            <div className="ptl-chips">
              {ev.entidadesClave.map((e) => {
                const href = entityHrefs?.[e];
                // Las entidades publicadas se enlazan a su página (wiki); las
                // demás quedan como texto — nunca se enlaza lo no producido.
                return href ? (
                  <Link key={e} href={href} className="ptl-chip">
                    {e}
                  </Link>
                ) : (
                  <span key={e} className="ptl-chip">
                    {e}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {epoca && (
          <div className="ptl-follow">
            <h3 className="ptl-sec-t">Seguir leyendo</h3>
            <Link href={epoca.href} className="ptl-flink">
              <span className="k">La época →</span>
              <span className="t">{epoca.titulo}</span>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

/** Avance de la ficha ya publicada: un cuarto del hecho y la puerta al resto. */
function HechoAvance({ hecho }: { hecho: TimelineLinkPiece }) {
  const resumen = hecho.resumen.trim();
  const porQue = hecho.porQueImporta.trim();
  const gente = hecho.protagonistas.filter((p) => p.trim().length > 0).slice(0, 4);

  return (
    <section className="ptl-adv">
      {hecho.imageUrl && (
        <div className="ptl-adv-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageAt(hecho.imageUrl, 640)!} alt={hecho.titulo} loading="lazy" />
        </div>
      )}
      <div className="ptl-adv-body">
        <div className="ptl-adv-k">
          <i />
          El hecho, publicado
        </div>
        <Link href={hecho.href} className="ptl-adv-h">
          <h3 className="ptl-adv-t">{hecho.titulo}</h3>
        </Link>
        {resumen && <p className="ptl-adv-s">{resumen}</p>}
        {porQue && (
          <p className="ptl-adv-w">
            <b>Por qué importa</b>
            {porQue}
          </p>
        )}
        {gente.length > 0 && <p className="ptl-adv-p">Protagonistas: {gente.join(" · ")}</p>}
        <Link href={hecho.href} className="ptl-cta">
          <span>Leer el hecho completo</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div className="ptl-dmetric-l">{label}</div>
      <div className="ptl-dmetric-v">
        {value.toLocaleString("es-CO")}
        {suffix && <span>{suffix}</span>}
      </div>
    </div>
  );
}
