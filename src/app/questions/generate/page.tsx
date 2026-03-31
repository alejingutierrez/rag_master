import { PageContainer } from "@/components/layout/page-container";
import { GeneratePanel } from "@/components/questions/generate-panel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GenerateQuestionsPage() {
  return (
    <PageContainer maxWidth="md">
      <div className="mb-6">
        <Link
          href="/questions"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ver preguntas
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Generar Preguntas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genera 20 preguntas de investigacion historica por documento usando Claude Opus.
          El proceso tarda entre 30-60 segundos por libro.
        </p>
      </div>

      <GeneratePanel />
    </PageContainer>
  );
}
