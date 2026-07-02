import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { PERIODS, getPeriodColor } from "@/lib/design-tokens";
import { getRecentEssays, getEssayCount } from "@/lib/public-data";
import "@/components/public/home.css";

// TODO post-lanzamiento: envolver las queries en unstable_cache para aliviar el RDS.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Historia Colombiana",
  description:
    "Un archivo vivo del pasado de Colombia, con las fuentes siempre a la vista. Ensayos, entidades, épocas y una línea de tiempo de cinco siglos.",
};

// Etiquetas compactas para el espectro (colores/años/slug vienen de PERIODS canónico).
const BAND_LABEL: Record<string, string> = {
  PRE: "Prehispánico", CON: "Conquista", COL: "Colonia", PRE_IND: "Pre-indep.",
  IND: "Independencia", NGR: "Nueva Granada", EUC: "EE.UU. de Col.", REG: "Regeneración",
  REP_LIB: "Rep. Liberal", VIO: "La Violencia", FN: "Frente Nac.", CNA: "Crisis y narco",
  C91: "Constit. 1991", SDE: "Seg. Democr.", POS: "Posconflicto", TRANS: "Transversal",
};

function startYear(yr: string): string {
  if (!yr || yr === "—") return "—";
  if (yr.includes("antes de")) return "—" + yr.replace(/\D/g, "");
  return yr.split(/[–-]/)[0].trim();
}

const FEATURED = [
  { href: "/ensayos/rionegro", period: "EUC", type: "Ensayo · Est. U. de Colombia", title: "La Constitución de Rionegro", desc: "Nueve estados soberanos y un presidente de dos años." },
  { href: "/entidades/mosquera", period: "EUC", type: "Semblanza · Persona", title: "Tomás Cipriano de Mosquera", desc: "Cinco veces jefe de Estado; el caudillo del federalismo." },
  { href: "/hechos/bogotazo", period: "VIO", type: "Hecho · La Violencia", title: "El Bogotazo", desc: "El magnicidio que incendió Bogotá el 9 de abril de 1948." },
];

const COLLECTION = [
  { href: "/epocas/ind", year: "1821 · Cúcuta", period: "IND", desc: "La Gran Colombia" },
  { href: "/epocas/euc", year: "1863 · Rionegro", period: "EUC", desc: "El federalismo radical" },
  { href: "/epocas/reg", year: "1886 · Regeneración", period: "REG", desc: "El Estado centralista" },
  { href: "/epocas/c91", year: "1991 · Constituyente", period: "C91", desc: "La carta vigente" },
];

const ENTITIES = [
  { href: "/entidades/bolivar", name: "Simón Bolívar", period: "IND", type: "Persona · Independencia" },
  { href: "/entidades/mosquera", name: "Tomás C. de Mosquera", period: "EUC", type: "Persona · EUC" },
  { href: "/entidades/nunez", name: "Rafael Núñez", period: "REG", type: "Persona · Regeneración" },
  { href: "/entidades/gaitan", name: "Jorge Eliécer Gaitán", period: "VIO", type: "Persona · La Violencia" },
];

const STATIC_LATEST = [
  { period: "IND", title: "La Patria Boba", meta: "Ensayo · 1810", href: "/archivo" },
  { period: "VIO", title: "Jorge Eliécer Gaitán", meta: "Semblanza", href: "/archivo" },
  { period: "REG", title: "La Guerra de los Mil Días", meta: "Crónica · 1899", href: "/archivo" },
  { period: "IND", title: "Batalla de Boyacá", meta: "Hecho · 1819", href: "/archivo" },
  { period: "REG", title: "¿Qué cambió la Constitución de 1886?", meta: "Pregunta", href: "/archivo" },
  { period: "REP_LIB", title: "La República Liberal", meta: "Ensayo · 1930", href: "/archivo" },
  { period: "FN", title: "El Frente Nacional", meta: "Ensayo · 1958", href: "/archivo" },
  { period: "POS", title: "El proceso de paz", meta: "Ensayo · 2016", href: "/archivo" },
];

const TIMELINE = [
  { year: "1810", event: "Grito de Independencia", period: "IND" },
  { year: "1819", event: "Batalla de Boyacá", period: "IND" },
  { year: "1863", event: "Convención de Rionegro", period: "EUC" },
  { year: "1886", event: "Constitución centralista", period: "REG" },
  { year: "1948", event: "El Bogotazo", period: "VIO" },
  { year: "1991", event: "Nueva Constitución", period: "C91" },
];

const ENTRADAS = [
  { href: "/linea-de-tiempo", n: "01", title: "Línea de tiempo", desc: "Cinco siglos en una columna, calibrada por atención: los hitos pesan más." },
  { href: "/entidades", n: "02", title: "Entidades", desc: "Los actores, lugares e ideas del corpus — y sus menciones exactas." },
  { href: "/preguntas", n: "03", title: "Preguntas", desc: "Dudas históricas con respuesta razonada, evidencia y fuentes." },
];

export default async function HomePage() {
  const [essays, essayCount] = await Promise.all([getRecentEssays(8), getEssayCount()]);
  const latest =
    essays.length > 0
      ? essays.map((e) => {
          const yr = e.periodCode ? startYear(PERIODS[e.periodCode as keyof typeof PERIODS]?.yearRange ?? "") : "";
          return {
            period: e.periodCode ?? "TRANS",
            title: e.title,
            meta: e.formatName + (yr && yr !== "—" ? ` · ${yr}` : ""),
            href: `/ensayos/${e.id}`,
          };
        })
      : STATIC_LATEST;

  return (
    <PublicShell>
      <div className="hp-wrap">
        <header className="hp-mast hp-fade">
          <div className="row">
            <div>
              <h1 className="hp-word">Historia Colombiana</h1>
              <p className="hp-tag">Un archivo vivo del pasado de Colombia, con las fuentes siempre a la vista.</p>
            </div>
            <div className="hp-stats">
              {[["5", "siglos"], ["16", "épocas"], [essayCount.toLocaleString("es-CO"), "ensayos"]].map(([n, l]) => (
                <span key={l} className="st"><b>{n}</b> {l}</span>
              ))}
            </div>
          </div>
        </header>

        <section className="hp-hero hp-fade hp-d1">
          <div>
            <div className="hp-ek">
              <span className="hp-dot" style={{ background: getPeriodColor("NGR") }} />
              <span className="label" style={{ color: "var(--fg-muted)" }}>Destacado · Nueva Granada · 1831—1862</span>
            </div>
            <h2>La Comisión Corográfica</h2>
            <p className="hp-excerpt">Durante casi una década, geógrafos, botánicos y dibujantes recorrieron el país cargando teodolitos y acuarelas. Volvieron con la primera imagen completa de la Nueva Granada: sus montañas, sus caminos y sus gentes.</p>
            <div className="hp-byl">
              <Link href="/ensayos/corografica" className="hp-read">Leer el ensayo →</Link>
              <span className="hp-sep">·</span>
              <span className="hp-au">Alejandro Gutiérrez</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>11 min</span>
            </div>
          </div>
          <figure style={{ margin: 0 }}>
            <span className="hp-ph land" aria-hidden />
            <figcaption className="hp-cap">Lámina · Comisión Corográfica, c. 1850 — Biblioteca Nacional</figcaption>
          </figure>
        </section>

        <section className="hp-sect">
          <div className="hp-sect-h"><span className="hp-sn">En portada</span><Link className="hp-allr" href="/archivo">Ver el archivo →</Link></div>
          <div className="hp-three">
            {FEATURED.map((f) => (
              <Link key={f.href} className="hp-fc" href={f.href}>
                <figure style={{ margin: 0 }}><span className="hp-ph land" aria-hidden /></figure>
                <div className="hp-fct"><span className="hp-dot" style={{ background: getPeriodColor(f.period) }} /><span className="hp-fcty">{f.type}</span></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="hp-sect">
          <div className="hp-sect-h"><span className="hp-sn">Cinco siglos</span><span className="hp-sc">Recorre la historia por época. El color es la navegación.</span></div>
          <div className="hp-band">
            {Object.values(PERIODS).map((p) => (
              <Link key={p.code} className="hp-seg" href={`/epocas/${p.slug}`}>
                <div className="bar" style={{ background: getPeriodColor(p.code) }} />
                <div className="in"><div className="sn2">{BAND_LABEL[p.code] ?? p.label}</div><div className="sy">{startYear(p.yearRange)}</div></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="hp-sect">
          <div className="hp-sect-h"><span className="hp-sn">Colección</span><span className="hp-scount">· Las constituciones de Colombia</span><span className="hp-sc">Un país que se ha reescrito a sí mismo una y otra vez.</span></div>
          <div className="hp-coll">
            {COLLECTION.map((c) => (
              <Link key={c.href + c.year} className="hp-cc" href={c.href}>
                <figure style={{ margin: 0 }}><span className="hp-ph sq" aria-hidden /></figure>
                <div className="ccy">{c.year}</div>
                <div className="ccp"><span className="hp-dot" style={{ background: getPeriodColor(c.period) }} />{c.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="hp-sect">
          <div className="hp-sect-h"><span className="hp-sn">Entidades destacadas</span><Link className="hp-allr" href="/entidades">Ver todas →</Link></div>
          <div className="hp-ents">
            {ENTITIES.map((e) => (
              <Link key={e.href} className="hp-ent-p" href={e.href}>
                <figure style={{ margin: 0 }}><span className="hp-ph port" aria-hidden /></figure>
                <div className="enn">{e.name}</div>
                <div className="ent-t"><span className="hp-dot" style={{ background: getPeriodColor(e.period) }} />{e.type}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="hp-qband">
        <div className="inner">
          <div className="ql">La pregunta de la semana</div>
          <h3>¿Por qué fracasó el federalismo radical?</h3>
          <p className="qa">Porque la soberanía absoluta de los estados volvió ingobernable al país: sin un poder central capaz de imponer orden, los Estados Unidos de Colombia vivieron en guerra civil casi permanente.</p>
          <Link className="qr" href="/preguntas/federalismo-radical">Ver la respuesta completa →</Link>
        </div>
      </section>

      <div className="hp-wrap">
        <section className="hp-sect">
          <div className="hp-sect-h"><span className="hp-sn">Lo último</span><Link className="hp-allr" href="/archivo">Archivo completo →</Link></div>
          <div className="hp-latest">
            {latest.map((l, i) => (
              <Link key={l.title + i} className="hp-li" href={l.href}>
                <span className="lt"><span className="hp-dot" style={{ background: getPeriodColor(l.period) }} />{l.title}</span>
                <span className="lm">{l.meta}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="hp-sect">
          <div className="hp-sect-h"><span className="hp-sn">La línea de tiempo</span><Link className="hp-allr" href="/linea-de-tiempo">Ver completa →</Link></div>
          <div className="hp-tlt">
            {TIMELINE.map((t) => (
              <Link key={t.year} href="/linea-de-tiempo">
                <span className="tdot" style={{ background: getPeriodColor(t.period) }} />
                <div className="ty2">{t.year}</div>
                <div className="te">{t.event}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="hp-sect" style={{ paddingBottom: 36 }}>
          <div className="hp-sect-h"><span className="hp-sn">Maneras de entrar</span></div>
          <div className="hp-entradas">
            {ENTRADAS.map((e) => (
              <Link key={e.n} className="hp-ent-c" href={e.href}>
                <div className="en2">{e.n}</div>
                <h4>{e.title}</h4>
                <p>{e.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
