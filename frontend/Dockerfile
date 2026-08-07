# Etapa 1: Build con Node.js
FROM node:20-alpine AS build-stage

# Establecer directorio de trabajo
WORKDIR /app

# Vite congela las variables VITE_* en tiempo de build, no en runtime.
# Sin estos ARG/ENV el build no las ve y el código cae a las URLs por defecto
# de src/services/api.js, que apuntan a producción.
ARG VITE_API_URL
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Copiar el código fuente y construir la app
COPY . .

# Inyectar una variable vacía para que Vite no falle si falta API_URL en build time
# Aunque lo ideal es que se configure en Railway como VITE_API_URL
RUN npm run build

# Etapa 2: Servir con Nginx
FROM nginx:stable-alpine

# Copiar la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos construidos desde la etapa anterior
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Exponer puerto 80
EXPOSE 80

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
