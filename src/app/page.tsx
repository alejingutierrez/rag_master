import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { PERIODS, getPeriodColor, periodInfo } from "@/lib/design-tokens";
import { getRecentEssays, getEssayCount, getHome, getEntityUniverse, getTypologyList } from "@/lib/public-data";
import "@/components/public/home.css";

// TODO post-lanzamiento: envolver las queries en unstable_cache para aliviar el RDS.
export const dynamic = "force-dynamic";

export const metadata = {
  // `absolute` evita que el title.template del layout añada un sufijo duplicado.
  title: { absolute: "Historia de Colombia · Archivo abierto y citable" },
  description:
    "Un archivo vivo del pasado de Colombia, con las fuentes siempre a la vista. Ensayos, entidades, épocas y una línea de tiempo de cinco siglos.",
  alternates: { canonical: "/" },
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
  { href: "/entidades", n: "02", title: "Personas, lugares e ideas", desc: "Las figuras, los territorios y las ideas — conectados por dónde aparecen y con quién." },
  { href: "/ensayos", n: "03", title: "Ensayos", desc: "Crónicas, reportajes y preguntas con respuesta razonada, evidencia y fuentes." },
];

export default async function HomePage() {
  const [essays, essayCount, home, personas, epocaCards] = await Promise.all([
    getRecentEssays(8),
    getEssayCount(),
    getHome(),
    getEntityUniverse("persona"),
    getTypologyList("epoca"),
  ]);

  const latest = essays.map((e) => {
    const yr = e.periodCode ? startYear(PERIODS[e.periodCode as keyof typeof PERIODS]?.yearRange ?? "") : "";
    return {
      period: e.periodCode ?? "TRANS",
      title: e.title,
      meta: e.formatName + (yr && yr !== "—" ? ` · ${yr}` : ""),
      href: `/ensayos/${e.id}`,
    };
  });

  // Fallbacks REALES (solo lo producido): si el editor no configuró un bloque,
  // se usa lo publicado — personas, épocas o ensayos reales. Nunca ejemplos.
  const heroCard =
    home.hero ??
    (essays[0]
      ? {
          title: essays[0].title,
          href: `/ensayos/${essays[0].id}`,
          periodCode: essays[0].periodCode,
          kicker: essays[0].formatName,
          desc: "",
          imageUrl: null as string | null,
        }
      : null);

  const featuredCards = (home.featured.length
    ? home.featured.map((c) => ({
        href: c.href,
        period: c.periodCode ?? "TRANS",
        type: c.kicker,
        title: c.title,
        desc: c.desc,
        imageUrl: c.imageUrl,
      }))
    : essays.slice(0, 3).map((e) => ({
        href: `/ensayos/${e.id}`,
        period: e.periodCode ?? "TRANS",
        type: e.formatName,
        title: e.title,
        desc: "",
        imageUrl: null as string | null,
      })));

  // Épocas publicadas → su página; el resto del espectro → la línea de tiempo.
  const epocaSlugByCode = new Map<string, string>();
  for (const c of epocaCards) if (c.periodCode) epocaSlugByCode.set(c.periodCode, c.slug);
  const bandHref = (code: string) =>
    epocaSlugByCode.has(code) ? `/epocas/${epocaSlugByCode.get(code)}` : `/linea-de-tiempo?p=${code}`;

  const featuredEntities = personas.slice(0, 4);
  const collectionEpocas = epocaCards.slice(0, 4);

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

        {heroCard && (
        <section className="hp-hero hp-fade hp-d1">
          <div>
            <div className="hp-ek">
              <span
                className="hp-dot"
                style={{ background: getPeriodColor(heroCard.periodCode ?? "TRANS") }}
              />
              <span className="label" style={{ color: "var(--fg-muted)" }}>
                Destacado · {heroCard.kicker}
                {heroCard.periodCode ? ` · ${periodInfo(heroCard.periodCode)?.label ?? ""}` : ""}
              </span>
            </div>
            <h2>{heroCard.title}</h2>
            {heroCard.desc && <p className="hp-excerpt">{heroCard.desc}</p>}
            <div className="hp-byl">
              <Link href={heroCard.href} className="hp-read">
                Leer →
              </Link>
              <span className="hp-sep">·</span>
              <span className="hp-au">Alejandro Gutiérrez</span>
            </div>
          </div>
          <figure style={{ margin: 0 }}>
            {heroCard.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroCard.imageUrl}
                alt={heroCard.title}
                style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }}
              />
            ) : (
              <span className="hp-ph land" aria-hidden />
            )}
          </figure>
        </section>
        )}

        <section className="hp-sect">
          <div className="hp-sect-h"><span className="hp-sn">En portada</span><Link className="hp-allr" href="/archivo">Ver el archivo →</Link></div>
          <div className="hp-three">
            {featuredCards.map((f) => (
              <Link key={f.href} className="hp-fc" href={f.href}>
                <figure style={{ margin: 0 }}>
                  {f.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.imageUrl} alt={f.title} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} />
                  ) : (
                    <span className="hp-ph land" aria-hidden />
                  )}
                </figure>
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
              <Link key={p.code} className="hp-seg" href={bandHref(p.code)}>
                <div className="bar" style={{ background: getPeriodColor(p.code) }} />
                <div className="in"><div className="sn2">{BAND_LABEL[p.code] ?? p.label}</div><div className="sy">{startYear(p.yearRange)}</div></div>
              </Link>
            ))}
          </div>
        </section>

        {(home.collection || collectionEpocas.length > 0) && (
        <section className="hp-sect">
          {home.collection ? (
            <>
              <div className="hp-sect-h">
                <span className="hp-sn">Colección</span>
                <span className="hp-scount">· {home.collection.title}</span>
                {home.collection.subtitle && <span className="hp-sc">{home.collection.subtitle}</span>}
              </div>
              <div className="hp-coll">
                {home.collection.cards.map((c) => (
                  <Link key={c.id} className="hp-cc" href={c.href}>
                    <figure style={{ margin: 0 }}>
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.title} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }} />
                      ) : (
                        <span className="hp-ph sq" aria-hidden />
                      )}
                    </figure>
                    <div className="ccy">{c.title}</div>
                    <div className="ccp"><span className="hp-dot" style={{ background: getPeriodColor(c.periodCode ?? "TRANS") }} />{c.kicker}</div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="hp-sect-h"><span className="hp-sn">Colección</span><span className="hp-scount">· Épocas publicadas</span><span className="hp-sc">Los grandes períodos, ya en el sitio.</span></div>
              <div className="hp-coll">
                {collectionEpocas.map((c) => (
                  <Link key={c.id} className="hp-cc" href={c.href}>
                    <figure style={{ margin: 0 }}>
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.titulo} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }} />
                      ) : (
                        <span className="hp-ph sq" aria-hidden />
                      )}
                    </figure>
                    <div className="ccy">{c.meta ?? c.titulo}</div>
                    <div className="ccp"><span className="hp-dot" style={{ background: getPeriodColor(c.periodCode ?? "TRANS") }} />{c.titulo}</div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
        )}

        {featuredEntities.length > 0 && (
        <section className="hp-sect">
          <div className="hp-sect-h"><span className="hp-sn">Personas destacadas</span><Link className="hp-allr" href="/personas">Ver todas →</Link></div>
          <div className="hp-ents">
            {featuredEntities.map((e) => (
              <Link key={e.slug} className="hp-ent-p" href={e.href}>
                <figure style={{ margin: 0 }}><span className="hp-ph port" aria-hidden /></figure>
                <div className="enn">{e.name}</div>
                <div className="ent-t">
                  <span className="hp-dot" style={{ background: e.periods[0] ? getPeriodColor(e.periods[0]) : "var(--fg-dim)" }} />
                  {e.mentions} {e.mentions === 1 ? "aparición" : "apariciones"}
                </div>
              </Link>
            ))}
          </div>
        </section>
        )}
      </div>

      {home.questionOfWeek && (
      <section className="hp-qband">
        <div className="inner">
          <div className="ql">La pregunta de la semana</div>
          <h3>{home.questionOfWeek.title}</h3>
          <p className="qa">{home.questionOfWeek.answer}</p>
          <Link className="qr" href={home.questionOfWeek.href}>
            Ver la respuesta completa →
          </Link>
        </div>
      </section>
      )}

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
