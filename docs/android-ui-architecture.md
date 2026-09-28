# Android UI Architecture

## Fase 0: Diagnóstico Inicial
Se ha inspeccionado el repositorio y se encontró que existe la estructura de un monorepo (con apps/api, apps/web, apps/mobile, apps/worker). En `apps/mobile` hay un README que sugiere usar React Native, sin embargo, los requerimientos actuales estipulan la creación de una aplicación Android nativa utilizando Kotlin, Jetpack Compose y Material 3.

**Decisión**: 
Se creará un proyecto nativo Android desde cero en la carpeta `apps/android` con el package name `com.erp.global` para no interferir con la carpeta `apps/mobile` en caso de que mantenga una aplicación de otra tecnología, y para respetar los requerimientos de la arquitectura nativa solicitada.

## Arquitectura Objetivo
- **Patrón**: Clean Architecture + MVVM.
- **UI Toolkit**: Jetpack Compose con Material 3.
- **Inyección de Dependencias**: Hilt.
- **Navegación**: Navigation Compose (adaptable a Desktop, Tablet y Mobile).
- **Networking**: Retrofit2 + OkHttp + Kotlinx Serialization.
- **Gestión de estado**: ViewModel y StateFlow.

## Capas
1. **presentation**: Contendrá los componentes de UI (Compose), ViewModels, Navigation, Theme.
2. **domain**: Modelos de dominio, Use Cases y Repository Interfaces.
3. **data**: Implementación de Repositories, Mappers, Data Sources locales y remotos (APIs).
4. **core**: Funcionalidades transversales como auth, tenant context, network interceptors, utilities, UI primitives (Design System).

## Decisiones Estratégicas
- Se implementará un mecanismo seguro y multi-tenant en `core/network` y `core/auth`.
- Se adoptará Material 3 adaptativo utilizando Scaffold, NavigationRail y NavigationBar según el tamaño de la pantalla (Fase 1).
- No se hardcodearán endpoints, se generarán clientes REST en base a los servicios disponibles en `apps/api`.
