# ERP Platform

Monorepo base para un ERP modular, multiempresa y orientado a eventos.

## Estado

La Fase 0 y la base de la Fase 1 están en construcción. No se han implementado todavía procesos completos de ERP.

## Principios

- Modular monolith con eventos internos y límites preparados para extracción futura.
- Clean Architecture por módulo: domain, application, infrastructure y presentation.
- TypeScript estricto y dominio independiente de Express, MongoDB y React.
- MongoDB como fuente de verdad; Redis solo para cache, locks y trabajos efímeros.
- Todos los datos empresariales deben estar acotados por tenant.

Consulta `docs/architecture/current-state.md`, `docs/architecture/target-architecture.md` y `docs/architecture/decisions.md` para el diagnóstico y las decisiones iniciales.
