import { ComingSoon } from "@/components/public/coming-soon";

export const metadata = { title: "Hecho · Historia Colombiana" };

export default function HechoPage() {
  return (
    <ComingSoon
      label="Hecho"
      title="Esta ficha, pronto"
      note="La ficha de cada acontecimiento —qué pasó, cuándo, por qué importa y sus fuentes— está en construcción."
    />
  );
}
