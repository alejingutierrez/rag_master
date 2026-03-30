import { GeneratePanel } from "@/components/questions/generate-panel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GenerateQuestionsPage() {
  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/questions"
          className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ver preguntas
        </Link>
        <h1 className="text-2xl font-bold text-white">Generar Preguntas</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Genera 10 preguntas de investigación histórica por documento usando Claude Opus.
          El proceso tarda entre 20–45 segundos por libro.
        </p>
      </div>

      <GeneratePanel />
    </div>
  );
}
