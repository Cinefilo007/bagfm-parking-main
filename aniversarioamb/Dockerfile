FROM python:3.12-alpine

WORKDIR /app
# Se copia archivo por archivo, no la carpeta: en local conviven aquí los Excel
# con los datos personales, y un COPY . . los metería en la imagen si alguien
# construyera desde su máquina.
COPY servidor.py index.html app.js logo-106.png fondo.jpg datos.json ./

USER nobody
ENV PORT=8000 PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8000/salud || exit 1
CMD ["python", "servidor.py"]
