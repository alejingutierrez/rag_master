# Eval — Sistema de evaluación del RAG

## Estructura

```
eval/
├── golden-set.json          # 30 preguntas + expected_facts (1.0)
├── types.ts                 # Tipos de las métricas
├── metrics.ts               # Cálculo de P@k, Recall, MRR, factualidad
├── run-retrieval-eval.mts   # Eval del retriever (sin generación)
├── run-pipeline-eval.mts    # Eval del pipeline completo (con reranker/expansion)
├── run-answer-eval.mts      # Eval de calidad de respuesta (factualidad)
├── run-consistency-eval.mts # Determinismo, robustez, no-regression
├── compare-runs.mts         # Diff entre dos runs guardados
├── baseline-report.md       # Reporte del baseline
├── runs/                    # JSONs de cada run
└── README.md                # Este archivo
```

## Métricas

### Retrieval
- **P@k**: % de los top-k chunks que son pertinentes
- **Recall@k**: % de chunks pertinentes del corpus que aparecen en top-k
- **MRR**: 1/rank del primer chunk pertinente

### Factualidad
- **Facts recall**: % de `expected_facts` presentes en la respuesta
- **Hallucination rate**: % de claims sin soporte en chunks
- **Factuality score**: `recall - 0.5 × hallucination_rate`

### Consistencia
- **Determinism stability**: % de chunks que aparecen en todos los runs (misma query)
- **Robustness overlap**: # de chunks que comparten queries parafraseadas

## Targets (P@5 ≥ 90%, factualidad ≥ 95%)

| Métrica | Baseline | Target |
|---|---|---|
| P@5 | 73.3% | **≥ 90%** |
| P@10 | 68.7% | ≥ 85% |
| Recall@50 | 12% | ≥ 60% |
| MRR | 0.803 | ≥ 0.92 |
| Factualidad | n/a | **≥ 95%** |

## Comandos

```bash
# Baseline (config actual)
npx tsx eval/run-retrieval-eval.mts --tag baseline

# Fase 1 (probes alto sobre IVFFLAT)
npx tsx eval/run-retrieval-eval.mts --tag f1-probes20 --probes 20 --topK 100 --threshold 0.25

# Fase 2 (HNSW)
npx tsx eval/run-retrieval-eval.mts --tag f2-hnsw --topK 100 --threshold 0.25

# Fase 5 (BM25 híbrido)
npx tsx eval/run-pipeline-eval.mts --tag f5-hybrid

# Fase 6 (con reranker)
npx tsx eval/run-pipeline-eval.mts --tag f6-rerank --reranker

# Fase 7 (con query expansion)
npx tsx eval/run-pipeline-eval.mts --tag f7-full --reranker --query-expansion

# Fase 8 (factualidad)
npx tsx eval/run-answer-eval.mts --tag f8-factuality

# Fase 9 (consistencia)
npx tsx eval/run-consistency-eval.mts --determinism 5
npx tsx eval/run-consistency-eval.mts --robustness
npx tsx eval/run-consistency-eval.mts --regression eval/runs/baseline-X.json

# Comparar dos runs
npx tsx eval/compare-runs.mts --latest 2
npx tsx eval/compare-runs.mts baseline-X.json f7-full-Y.json
```

## Filosofía

1. **Cada fase produce un run JSON guardado** — historial completo de evolución
2. **Comparación clara entre fases** — sabemos exactamente qué mejoró y qué regresó
3. **Métricas alineadas con el objetivo** — no optimizamos vanidad, optimizamos hechos correctos
4. **Tests de consistencia** — el sistema debe ser estable, no solo bueno una vez
