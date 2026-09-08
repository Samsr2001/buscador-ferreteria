# 🛠️ Proyecto 21: Buscador Inteligente para Ferreterías

![Estado del Proyecto](https://img.shields.io/badge/Estado-En_Desarrollo_(Sprint_2)-blue)
![Materia](https://img.shields.io/badge/Materia-Ingeniería_de_Software-brightgreen)

Bienvenido al repositorio del **Buscador Inteligente para Ferreterías**. Este proyecto académico corresponde al Proyecto N° 21 de la materia de Ingeniería de Software.

## 🎯 Objetivo del Proyecto

Desarrollar un sistema de búsqueda inteligente orientado a optimizar la gestión de inventario y facilitar la búsqueda rápida de herramientas y materiales en el rubro ferretero. 

## 🏗️ Tecnologías y Arquitectura

El proyecto se está construyendo bajo los principios de **Clean Architecture** (separación en capas de dominio, aplicación e infraestructura).
- **Backend:** Node.js con Express
- **Base de Datos:** PostgreSQL a través de Supabase
- **Documentación API:** Swagger (OpenAPI)

## 📋 Matriz de Requisitos y Criterios de Aceptación

### 1. Requerimientos Funcionales
* **RF01:** El sistema debe permitir el ingreso de texto en lenguaje coloquial o descripciones imprecisas a través de una barra de búsqueda.
* **RF02:** El sistema debe integrar una IA capaz de procesar el texto y relacionarlo con los términos técnicos del inventario.
* **RF03:** El sistema debe mostrar el código exacto, una imagen del producto y sus posibles sustitutos.
* **RF04:** El sistema debe manejar casos vacíos o de error con mensajes claros.

### 2. Requerimientos No Funcionales
* **RNF01 (Frontend):** La interfaz debe estar desarrollada en Next.js y Tailwind CSS.
* **RNF02 (Backend & BD):** La lógica debe implementarse en Node.js o Supabase, con base de datos en PostgreSQL.
* **RNF03 (Automatización y Despliegue):** Debe incluir automatización con n8n y estar desplegado en Vercel.
* **RNF04 (Repositorio):** El proyecto debe gestionarse en GitHub de forma organizada con su respectivo README.

### 3. Historias de Usuario (Formato Given-When-Then)
* **HU01: Búsqueda exitosa con lenguaje informal**
  * **Dado (Given):** Que un usuario desconoce el nombre técnico de un repuesto.
  * **Cuando (When):** Ingresa una descripción coloquial (ej. "la piecita de plástico que une el tubo de agua").
  * **Entonces (Then):** El sistema traduce la frase, consulta la base de datos y muestra el código exacto, la foto y marcas sustitutas de inmediato.
* **HU02: Búsqueda sin stock exacto**
  * **Dado (Given):** Que el usuario busca un término válido pero no hay stock exacto.
  * **Cuando (When):** El sistema procesa la información de forma automática.
  * **Entonces (Then):** El sistema alerta sobre la falta de stock y genera una salida útil mostrando inmediatamente los sustitutos viables.

## 📚 Bibliografía de Referencia

El desarrollo de este sistema se apoya en los estándares y principios estudiados en:
- *Ingeniería del Software - 5ta Edición (Roger S. Pressman)*
- *Planificación INGSW1CIVA_2026*

## 🚀 Próximos Pasos

- [x] Inicializar el repositorio y conectarlo a GitHub.
- [x] Definir los Requerimientos Funcionales y No Funcionales.
- [x] Configurar el entorno de desarrollo base (Node.js, Express, Supabase).
- [x] Construir arquitectura base (Sprint 2).
- [ ] Integrar modelo de IA en el endpoint de búsqueda (Sprint 3).
- [ ] Elaborar los diagramas de Casos de Uso.
