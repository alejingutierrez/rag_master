/**
 * Inyecta datos estructurados schema.org como <script type="application/ld+json">.
 * Componente server (sin "use client"). Escapa "<" para evitar romper el <script>.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
