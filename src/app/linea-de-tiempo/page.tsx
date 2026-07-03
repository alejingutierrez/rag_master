import { ComingSoon } from "@/components/public/coming-soon";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Línea de tiempo",
    metaDescription:
      "Cinco siglos de historia de Colombia en una línea de tiempo calibrada por relevancia. En construcción.",
    keywords: ["línea de tiempo", "cronología", "historia de Colombia"],
  },
  path: "/linea-de-tiempo",
  type: "website",
});

export default function LineaDeTiempoPage() {
  return (
    <ComingSoon
      label="Línea de tiempo"
      title="Cinco siglos, pronto"
      note="La línea de tiempo completa —calibrada por atención, donde los hitos pesan más— está en construcción."
    />
  );
}
