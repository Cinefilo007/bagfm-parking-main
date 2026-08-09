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
      'alguna alerta que atender.',
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
    selector: '[data-tour="tarjeta"]',
    titulo: 'Cada vehículo que llega',
    texto:
      'Aparece la foto de la placa y, si el vehículo está registrado, de quién es. ' +
      'El color le dice de un vistazo: verde puede pasar, amarillo revíselo, rojo no ' +
      'debe entrar.',
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
