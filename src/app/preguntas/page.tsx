import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

// "Preguntas" se consolidó en la superficie de lectura pública: Ensayos.
// El detalle /preguntas/[slug] sigue vivo (se re-etiqueta como Ensayo en la UI).
export default function PreguntasPage() {
  permanentRedirect("/ensayos");
}
