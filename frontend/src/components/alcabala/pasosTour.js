/**
 * Guion del tour del guardia de alcabala.
 *
 * Escrito para alguien que llega de relevo y nunca ha visto el sistema. Cada paso
 * responde a una sola pregunta y evita el vocabulario del software: aquí no hay
 * "eventos", "registros" ni "detecciones", hay vehículos, cámaras y destinos.
 */

export const PASOS_ALCABALA = [
  {
    selector: '[data-tour="puerta"]',
    titulo: 'Aquí trabaja usted',
    texto:
      'La cámara lee la placa de cada vehículo sola. Entre aquí y verá los que van ' +
      'llegando. Si aparece un número, son los que están esperando que usted les ' +
      'marque a dónde van.',
  },
  {
    selector: '[data-tour="qr"]',
    titulo: 'Solo cuando haga falta',
    texto:
      'El código QR ya no es lo normal. Úselo únicamente si el visitante trae un ' +
      'pase, o si la cámara no logró leer la placa.',
  },
  {
    selector: '[data-tour="stats"]',
    titulo: 'Cómo va su turno',
    texto:
      'Cuántos vehículos han entrado y salido desde que empezó su guardia, y si hay ' +
      'alguna alerta que atender. El último número son los conductores que USTED ' +
      'identificó en este turno: es lo único que no sube solo.',
  },
  {
    selector: '[data-tour="bitacora"]',
    titulo: 'Lo que acaba de pasar',
    texto:
      'Los últimos movimientos del punto de control, en vivo. Sirve para confirmar ' +
      'que lo que usted registró quedó guardado.',
  },
];

/** Pasos de la pantalla de Puerta, que es donde se resuelve cada vehículo. */
export const PASOS_PUERTA = [
  {
    selector: '[data-tour="estado-camara"]',
    titulo: 'La cámara está conectada',
    texto:
      'Mientras diga "en línea", los vehículos le van a aparecer solos. Si dice que ' +
      'no hay conexión, avise: nada se va a registrar hasta que vuelva.',
  },
  {
    selector: '[data-tour="tema-monitor"]',
    titulo: 'El televisor de la garita',
    texto:
      'El monitor grande no tiene mando. Desde aquí usted le cambia los colores: ' +
      '"claro" cuando le pega el sol y no se lee, "oscuro" de noche para que no ' +
      'encandile. Solo cambia cómo se ve; no afecta a nada de lo que registra.',
  },
  {
    selector: '[data-tour="modo-destinos"]',
    titulo: 'Trabaje como le sea más cómodo',
    texto:
      'Los destinos se le pueden mostrar de dos maneras: "botones", con todos a la ' +
      'vista para tocar uno; o "buscar", donde escribe las primeras letras y aparece ' +
      'el que quiere. Elija la suya, este teléfono se acuerda.',
  },
  {
    selector: '[data-tour="tarjeta"]',
    titulo: 'Cada vehículo que llega',
    texto:
      'Aparece la foto de la placa y, si el vehículo está registrado, de quién es. ' +
      'El color le dice de un vistazo: verde puede pasar, amarillo revíselo, rojo no ' +
      'debe entrar.',
  },
  {
    selector: '[data-tour="identificar"]',
    titulo: 'Cuando la fila esté tranquila',
    texto:
      'Si dice "conductor sin identificar", nadie sabe todavía quién maneja ese ' +
      'carro. Con calma, pídale la cédula, tóquele aquí y fotografíela: el sistema ' +
      'saca los datos solo. Nunca lo haga con la fila encima — es opcional a ' +
      'propósito.',
  },
  {
    selector: '[data-tour="destinos"]',
    titulo: 'Solo pregunte a dónde va',
    texto:
      'Toque el destino que le diga el conductor y listo, queda registrado. Si el ' +
      'sitio no está en la lista, use "Otro" y escríbalo.',
  },
  {
    selector: '[data-tour="secundarias"]',
    titulo: 'Si algo no cuadra',
    texto:
      'Puede corregir la placa si la cámara la leyó mal, o descartar la tarjeta si ' +
      'fue un peatón o un vehículo que se devolvió sin entrar.',
  },
];
