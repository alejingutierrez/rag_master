# Baseline Report — Sistema RAG actual

**Run ID**: `baseline-1779328998870`
**Fecha**: 2026-05-20
**Config**: `topK=50, threshold=0.35, probes=default(1), índice=ivfflat lists=100, embedding=cohere.embed-v4:0`

## Resumen global

| Métrica | Valor |
|---|---|
| **Avg Precision@5** | **73.3%** |
| Avg Precision@10 | 68.7% |
| Avg Recall@50 | 12.0% |
| Avg MRR | 0.803 |
| Avg Latencia | 11084 ms |

## Por categoría

| Categoría | n | P@5 | P@10 | MRR | Latencia |
|---|---|---|---|---|---|
| nombres_propios | 10 | **76%** | 73% | 0.762 | 6.0s |
| conceptos | 8 | **60%** | 51% | 0.810 | 11.6s |
| fechas_eventos | 5 | **100%** | 96% | 1.000 | 11.1s |
| multi_hop | 5 | **92%** | 88% | 1.000 | 12.9s |
| vagas | 2 | **0%** | 0% | 0.000 | 30.1s |

## Fallos completos (P@5 = 0)

| ID | Pregunta | Best sim |
|---|---|---|
| **np_01** | Cuéntame la historia de Manuel Cepeda Vargas… | 0.447 |
| **np_09** | Cuéntame sobre Álvaro Uribe Vélez y El Ubérrimo… | 0.461 |
| **co_07** | ¿Qué fue el M-19 y qué eventos clave protagonizó? | 0.422 |
| vg_01 | "cuentame la historia" (vaga) | 0.000 |
| vg_02 | "qué pasó" (vaga) | 0.355 |

## Casos mediocres (P@5 entre 0.40 y 0.80)

- **co_02** Frente Nacional: P@5=0.60
- **co_04** La Violencia: P@5=0.40
- **co_06** Narcotráfico: P@5=0.40
- **co_08** Ideas socialistas: P@5=0.40
- **np_07** Simón Bolívar: P@5=0.80
- **np_08** Rafael Núñez: P@5=0.80
- **mh_03** Bananeras + socialismo: P@5=0.80
- **mh_05** Periodismo: P@5=0.80

## Diagnóstico

1. **Recall@50 = 12%**: confirma que el índice IVFFLAT con `probes=1` deja fuera ~88% de los chunks relevantes.
2. Las preguntas que recuperan chunks fáciles (eventos famosos como Bojayá, Bogotazo) tienen P@5=100%, pero las que dependen de nombres específicos como **Manuel Cepeda Vargas** fallan completamente (sim < 0.45 cuando hay 127 chunks que mencionan al sujeto literal).
3. Latencia alta (11s avg, hasta 42s en vg_02) — el índice IVFFLAT está agotando recursos al filtrar antes que ordenar.
4. Preguntas vagas (vg_01, vg_02) devuelven retrieval inútil — no hay manejo de queries insuficientes.

## Target objetivo

| Métrica | Baseline | Target Fase 9 |
|---|---|---|
| P@5 | 73.3% | **≥ 90%** |
| P@10 | 68.7% | ≥ 85% |
| Recall@50 | 12.0% | ≥ 60% |
| MRR | 0.803 | ≥ 0.92 |
| Factualidad | n/a | **≥ 95%** |

## Próximos pasos

- **Fase 1** (quick wins): subir `ivfflat.probes=20`, `topK=100`, `threshold=0.25` → esperado P@5 ~80-85%
- **Fase 2** (HNSW): cambiar índice → esperado P@5 ~88%
- **Fase 3-7**: re-chunking + BM25 + reranker + query expansion → P@5 ≥ 90%
- **Fase 8**: factualidad ≥ 95% con prompts anti-alucinación y citas obligatorias
