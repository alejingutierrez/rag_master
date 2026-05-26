# Crónica — Sistema de Diseño

> Sistema de diseño para **Archivo Histórico Digital**, un asistente de
> investigación con IA sobre historia de Colombia.

**Versión:** 0.1 (borrador inicial — sin implementar)
**Última revisión:** 2026-05-25
**Estado:** documentación → implementación pendiente

---

## ¿Por qué "Crónica"?

El nombre tiene dos lecturas, ambas pertinentes:

- **Histórica** — la *crónica de Indias* es uno de los primeros géneros de
  escritura sobre el territorio colombiano. Una crónica narra hechos con
  fuentes, en orden, con voz autoral. Es lo que esta app hace.
- **Editorial** — la *crónica periodística* (latinoamericana, colombiana
  en particular: *El Malpensante*, *Arcadia*, *Credencial Historia*) es
  un género que combina rigor reportero con voz literaria. Esa es la
  estética visual del producto.

El sistema no se llama "Design System" ni "UI Kit" porque eso no dice
nada. *Crónica* es lo que sí dice.

---

## Para quién es esto

Esta documentación es la **fuente única** del lenguaje visual y
componencial del producto. Cualquier decisión que conflictúe con este
documento se discute primero acá; cualquier componente nuevo se diseña
contra estas reglas.

Lectores esperados:

- **Diseñador / desarrollador** (vos) implementando o iterando la UI
- **Colaboradores futuros** que necesiten extender el sistema sin
  romperlo
- **Modelos LLM** asistiendo el desarrollo: este doc está escrito para
  ser citable y específico, no aspiracional

---

## El problema que estamos resolviendo

El producto actual (con Ant Design) tiene tres problemas concretos:

1. **No transmite identidad.** Se ve como "otro workspace Notion-like".
   No hay nada en la UI que diga "esto es sobre historia, sobre
   Colombia, sobre investigación seria".
2. **El dark mode no funciona.** Ant aplica un algoritmo opaco que
   oscurece tokens sin override por componente. Hay pérdida de
   contraste, jerarquías rotas, y elementos invisibles.
3. **Componentes inestables.** Tooltips con problemas de z-index y
   placement. Menús que se cierran cuando no deben. Modales que
   compiten entre sí.

La causa raíz es la misma: usamos un sistema de diseño que no es
nuestro, que no fue pensado para este producto, y que oculta sus
decisiones detrás de tokens automáticos.

**La solución no es "rediseñar la UI".** Es *definir un sistema propio*
y después implementarlo. Este documento es el sistema. La
implementación viene después.

---

## Personalidad — qué se siente al usar Crónica

Una sola frase: **"estás leyendo una pieza bien escrita"**.

Concretamente eso significa:

| Dimensión        | Sí                                                | No                                                 |
| ---------------- | ------------------------------------------------- | -------------------------------------------------- |
| Voz              | autoral, segura, accesible                        | corporativa, neutra-genérica, infantil             |
| Densidad         | rica en información, con respiración              | saturada (Bloomberg) o vacía (landing page)        |
| Jerarquía        | editorial — el texto manda, la UI sirve           | dashboard-céntrica, widgets compitiendo            |
| Cromática        | sobria, neutra, con un acento de tinta            | colorida, gradientes, ilustraciones decorativas    |
| Tipografía       | serif para lectura, sans para UI                  | sans en todo                                       |
| Tono editorial   | curado, respetuoso con las fuentes                | clickbait, optimizado para engagement              |
| Microcopy        | preciso, en buen español, sin anglicismos vacíos  | "¡Hey! 👋 ¿Listo para explorar?"                   |

Referencias visuales que sí: *The Atlantic*, *London Review of Books*,
*Stripe Press*, *Are.na*, JSTOR rediseñado, el sitio web del Museo del
Oro.

Referencias que no: Notion (genérico), Linear (técnico-frío),
ChatGPT (corporativo), Khan Academy (infantilizado).

---

## Los seis principios

Estos principios resuelven empates. Cuando dos opciones de diseño son
defendibles, gana la que esté más alineada con estos principios — en
orden.

### 1. La prosa primero

La UI sirve al texto. Cualquier cosa que compita con la lectura
(animaciones constantes, ilustraciones decorativas, gradientes
distrayentes) es ruido. El usuario viene a investigar, no a admirar la
interfaz.

**Aplicación:** ancho de lectura óptimo (65–72ch); tipografía serif para
contenido largo; sin sidebars siempre visibles cuando el usuario está
leyendo; densidad baja en vistas de respuesta.

### 2. Densidad con respiración

Es una app data-rich (líneas de tiempo, grafos, citas, fuentes). La
información tiene que estar visible, pero no apretada. Whitespace no es
"espacio vacío", es jerarquía.

**Aplicación:** padding generoso en cards (24px+); gaps de 16-24 entre
secciones; nunca más de 7±2 elementos visibles sin agrupación; filtros
y metadatos siempre disponibles pero secundarios.

### 3. Período como identidad

Los `PERIOD_COLORS` son el activo identitario más fuerte del producto.
Cada período histórico tiene un color, y esa paleta cuenta una historia
cromática (cálidos → fríos → rojos → violetas → verdes contemporáneos).
No los escondemos: los usamos.

**Aplicación:** badges de período con su color; bandas de timeline;
acentos en cards; tints sutiles en backgrounds de fuentes. Pero
**nunca** como color principal de UI — siempre acompañado de etiqueta
de texto.

### 4. Sobriedad cromática

El neutro académico es la base. Blancos, grises tinta, un acento
signature. Los `PERIOD_COLORS` y `CATEGORY_COLORS` son la *única*
excepción permitida — y solo en contextos de dominio (badges,
timeline, grafo).

**Aplicación:** sin gradientes decorativos; sin colores semánticos
fuera de los 5 definidos (success, warning, danger, info, neutral);
sin "colorful illustrations".

### 5. Citas trazables

Es un asistente de **investigación**. Toda afirmación generada por el
LLM tiene que tener fuente visible y verificable. La cita es un
ciudadano de primera clase: tiene componente propio, estilo propio,
interacción propia.

**Aplicación:** `<Citation>` inline siempre con número; popover de
fuente al hover/focus; panel de fuentes accesible desde toda respuesta;
fuentes no son notas al pie, son afirmaciones equivalentes.

### 6. Modo oscuro intencional

Dark mode no es "invertir colores". Es **otra cara del mismo papel**.
Misma jerarquía visual, mismos contrastes relativos, misma personalidad
editorial. Los tokens se diseñan en pares (light ↔ dark) desde el
principio, nunca derivados algorítmicamente.

**Aplicación:** cada token tiene valor light y dark explícito; ningún
componente "se ve raro en dark" porque su diseño fue dual desde el
día uno; transición light↔dark es instantánea y sin parpadeo.

---

## Estructura de esta documentación

| Doc                                          | Cubre                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| [README.md](./README.md)                     | (este archivo) Filosofía, principios, voz                                      |
| [foundations.md](./foundations.md)           | Tipografía, color, espaciado, grid, radios, elevación, motion                  |
| [components.md](./components.md)             | Primitivos (Button, Input, Tooltip…) + dominio (PeriodBadge, Citation…)        |
| [patterns.md](./patterns.md)                 | Patrones de página: shell, dashboard, conversación, lectura, timeline, grafo   |
| [accessibility.md](./accessibility.md)       | Contraste, focus, keyboard, screen readers, motion                             |
| [implementation.md](./implementation.md)     | Tokens técnicos (Tailwind), dependencias, roadmap de migración por fases       |

**Orden de lectura recomendado:** este README → foundations →
components. Patterns y accessibility son consulta. Implementation es
para cuando arranquemos a codear.

---

## Cómo se usa este sistema

1. **Antes de diseñar un componente nuevo**, leer
   [components.md](./components.md). Probablemente ya está pensado.
2. **Antes de elegir un color**, consultar
   [foundations.md § Color](./foundations.md#color). No hay colores
   "extra".
3. **Antes de tomar una decisión visual ambigua**, releer los 6
   principios. Resuelven empates.
4. **Cuando algo no está cubierto**, agregarlo al sistema antes de
   implementarlo en código. El sistema crece *con intención*, no por
   acumulación.

---

## Estado actual de implementación

Nada de este sistema está implementado todavía. El código actual
(`src/lib/theme.ts`, `src/app/globals.css`, componentes Ant Design en
`src/components/`) será reemplazado en fases — ver
[implementation.md § Roadmap](./implementation.md#roadmap).

Esto es **documentación de diseño**, no una guía de migración.
