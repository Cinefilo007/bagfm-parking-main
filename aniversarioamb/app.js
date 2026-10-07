// Los dos primeros textos son los del documento de la organización
// ("mensajes Caminata 5K y Carrera 10K.docx"); no reescribirlos sin consultarles.
const MENSAJES = {
  inscrito: {
    clase: "inscrito",
    titulo: "¡Inscripción Confirmada! 🏃‍♀️",
    texto: "Prepárate para la Carrera 10K y Caminata 5K conmemorativa del 106º Aniversario de la Aviación Militar Bolivariana, te esperamos este 17 de octubre de 2026 a las 0700 en la Base Aérea La Carlota.",
  },
  excluido: {
    clase: "excluido",
    titulo: "No inscrito",
    texto: "Lo sentimos, extendemos nuestras más sinceras disculpas, en virtud que no se procesó tu registro en este momento por la disponibilidad de cupos para la Carrera 10K y Caminata 5K conmemorativa del 106º Aniversario de la Aviación Militar Bolivariana. Te esperamos en una próxima oportunidad.",
  },
  no_encontrado: {
    clase: "neutro",
    titulo: "Cédula no encontrada",
    texto: "Esta cédula no aparece en los listados de la carrera. Revisa que esté bien escrita; si te registraste y no apareces, comunícate con la organización del evento.",
  },
};

const formulario = document.getElementById("formulario");
const campo = document.getElementById("cedula");
const boton = document.getElementById("boton");
const caja = document.getElementById("resultado");

function soloDigitos(valor) {
  return valor.replace(/\D/g, "").replace(/^0+/, "");
}

function conPuntos(digitos) {
  return "V-" + digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function mostrar({ clase, titulo, texto }, cedula, modalidad) {
  caja.className = "resultado " + clase;
  document.getElementById("res-cedula").textContent = cedula ? conPuntos(cedula) : "";
  document.getElementById("res-titulo").textContent = titulo;
  document.getElementById("res-mensaje").textContent = texto;
  const etiqueta = document.getElementById("res-modalidad");
  etiqueta.hidden = !modalidad;
  etiqueta.textContent = modalidad ? "Modalidad: " + modalidad : "";
  caja.hidden = false;
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const cedula = soloDigitos(campo.value);
  if (cedula.length < 6 || cedula.length > 9) {
    mostrar({ clase: "neutro", titulo: "Revisa la cédula", texto: "Debe tener entre 6 y 9 números." });
    campo.focus();
    return;
  }

  boton.disabled = true;
  boton.textContent = "Consultando…";
  try {
    const respuesta = await fetch("/api/consulta?cedula=" + encodeURIComponent(cedula));
    if (respuesta.status === 429) {
      mostrar({ clase: "neutro", titulo: "Espera un momento", texto: "Hay demasiadas consultas desde tu conexión. Intenta de nuevo en un minuto." });
      return;
    }
    const datos = await respuesta.json();
    const mensaje = MENSAJES[datos.estado];
    if (!respuesta.ok || !mensaje) throw new Error(datos.error || "respuesta inesperada");
    mostrar(mensaje, cedula, datos.modalidad);
  } catch {
    mostrar({ clase: "neutro", titulo: "No se pudo consultar", texto: "Revisa tu conexión a internet e intenta de nuevo." });
  } finally {
    boton.disabled = false;
    boton.textContent = "Consultar";
  }
});
