import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Genera el PDF de cierre diario SIN links de foto (versión original).
 * Usa el endpoint /cierres/{id}/reporte-data.
 */
export const generarReporteCierre = (kpis, modalLectura, formLectura, supervisorNombre) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colores corporativos (Aegis / Bagfm)
  const colors = {
    primary: [245, 158, 11], // Amber 500
    dark: [15, 23, 42], // Slate 900
    gray: [100, 116, 139], // Slate 500
    lightGray: [241, 245, 249], // Slate 100
    success: [16, 185, 129] // Emerald 500
  };

  const marginX = 14;
  let currentY = 20;

  // --- CABECERA ---
  doc.setFillColor(...colors.dark);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BOMBA DE COMBUSTIBLE BAGFM', marginX, 22);

  doc.setTextColor(...colors.primary);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('REPORTE OFICIAL DE CIERRE DIARIO', marginX, 30);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  const dateStr = format(new Date(), "dd 'de' MMMM, yyyy - HH:mm", { locale: es });
  doc.text(dateStr, pageWidth - marginX, 22, { align: 'right' });
  doc.text(`Supervisor: ${supervisorNombre || 'N/A'}`, pageWidth - marginX, 30, { align: 'right' });

  currentY = 50;

  // --- SECCIÓN: KPIs PRINCIPALES ---
  doc.setTextColor(...colors.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN DE OPERACIONES', marginX, currentY);
  
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.5);
  doc.line(marginX, currentY + 2, marginX + 60, currentY + 2);
  
  currentY += 10;

  const kpiData = [
    ['Total Litros Surtidos', `${Number(kpis.litros_hoy || 0).toFixed(1)} L`],
    ['Vehículos Abastecidos', `${kpis.cargas_hoy || 0}`],
    ['Solicitudes Excepcionales', `${kpis.solicitudes_pendientes || 0}`]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX },
    tableWidth: 100,
    body: kpiData,
    theme: 'plain',
    styles: {
      fontSize: 11,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: colors.gray },
      1: { fontStyle: 'bold', textColor: colors.dark, halign: 'right' }
    }
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // --- SECCIÓN: ESTADO DEL TANQUE QUE CIERRA ---
  doc.setTextColor(...colors.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LECTURA DE CIERRE', marginX, currentY);
  doc.line(marginX, currentY + 2, marginX + 45, currentY + 2);
  currentY += 10;

  const tanque = modalLectura.tanque;
  const tanqueInfo = [
    ['Tanque', tanque.nombre.toUpperCase()],
    ['Tipo Combustible', tanque.tipo_combustible.toUpperCase()],
    ['Capacidad Total', `${Number(tanque.capacidad_maxima).toFixed(1)} L`],
    ['Lectura Medida (Cierre)', `${Number(formLectura.cantidad_medida).toFixed(1)} L`],
    ['Nivel Porcentual', `${((Number(formLectura.cantidad_medida) / Number(tanque.capacidad_maxima)) * 100).toFixed(1)} %`],
    ['Observaciones', formLectura.observaciones || 'Ninguna']
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX },
    body: tanqueInfo,
    theme: 'grid',
    headStyles: { fillColor: colors.dark },
    styles: { fontSize: 10, cellPadding: 3, lineColor: [200, 200, 200] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: colors.lightGray, cellWidth: 50 },
      1: { cellWidth: 130 }
    }
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // --- SECCIÓN: REGISTRO DE ABASTECIMIENTOS ---
  if (kpis.abastecimientos_hoy && kpis.abastecimientos_hoy.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(...colors.dark);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('REGISTRO DE VEHÍCULOS ABASTECIDOS', marginX, currentY);
    doc.line(marginX, currentY + 2, marginX + 85, currentY + 2);
    currentY += 8;

    const tableCols = ['Hora', 'Placa', 'Entidad / Categoría', 'Vehículo', 'Litros'];
    const tableRows = kpis.abastecimientos_hoy.map(a => [
      format(new Date(a.fecha), 'HH:mm'),
      a.placa,
      a.entidad || 'Tránsito / Externo',
      `${a.marca || ''} ${a.modelo || ''}`.trim(),
      `${Number(a.litros).toFixed(1)} L`
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      head: [tableCols],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: colors.dark,
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: colors.lightGray
      }
    });
  }

  // --- PIE DE PÁGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text(
      `Generado por Sistema BAGFM - Sentinel Fuel Management`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
  }

  const filename = `cierre_${tanque.nombre.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(filename);
};


/**
 * Genera el PDF de cierre diario CON hipervínculos de foto (Opción D - JWT 72h).
 * Usa el endpoint /cierres/{id}/reporte-con-fotos.
 *
 * Cada fila de abastecimiento incluye un link clickeable "Ver foto →" que apunta
 * al endpoint público del backend con un token firmado de 72 horas.
 */
export const generarReporteCierreConFotos = (kpis, modalLectura, formLectura, supervisorNombre, fechaCierre) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  const colors = {
    primary: [245, 158, 11],
    dark: [15, 23, 42],
    gray: [100, 116, 139],
    lightGray: [241, 245, 249],
    success: [16, 185, 129],
    link: [37, 99, 235]     // Azul link para las URLs clickeables
  };

  const marginX = 14;
  let currentY = 20;

  // --- CABECERA ---
  doc.setFillColor(...colors.dark);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BOMBA DE COMBUSTIBLE BAGFM', marginX, 22);

  doc.setTextColor(...colors.primary);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('REPORTE DE CIERRE DIARIO — CON EVIDENCIA FOTOGRÁFICA', marginX, 30);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  const dateStr = format(new Date(), "dd 'de' MMMM, yyyy - HH:mm", { locale: es });
  doc.text(dateStr, pageWidth - marginX, 22, { align: 'right' });
  doc.text(`Supervisor: ${supervisorNombre || 'N/A'}`, pageWidth - marginX, 30, { align: 'right' });

  // Aviso de expiración de links
  currentY = 46;
  doc.setFillColor(254, 243, 199); // Amarillo suave
  doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 10, 2, 2, 'F');
  doc.setTextColor(146, 64, 14); // Ámbar oscuro
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(
    '⚠  Los enlaces "Ver foto" son válidos por 72 horas desde la generación de este reporte. Después de ese período, solicite un nuevo reporte.',
    pageWidth / 2,
    currentY + 6.5,
    { align: 'center', maxWidth: pageWidth - marginX * 2 - 4 }
  );
  currentY = 62;

  // --- KPIs ---
  doc.setTextColor(...colors.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN DE OPERACIONES', marginX, currentY);
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.5);
  doc.line(marginX, currentY + 2, marginX + 60, currentY + 2);
  currentY += 10;

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX },
    tableWidth: 100,
    body: [
      ['Total Litros Surtidos', `${Number(kpis.litros_hoy || 0).toFixed(1)} L`],
      ['Vehículos Abastecidos', `${kpis.cargas_hoy || 0}`],
    ],
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: colors.gray },
      1: { fontStyle: 'bold', textColor: colors.dark, halign: 'right' }
    }
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // --- LECTURA DE CIERRE ---
  const tanque = modalLectura.tanque;
  doc.setTextColor(...colors.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LECTURA DE CIERRE', marginX, currentY);
  doc.line(marginX, currentY + 2, marginX + 45, currentY + 2);
  currentY += 8;

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX },
    body: [
      ['Tanque', tanque.nombre.toUpperCase()],
      ['Tipo Combustible', tanque.tipo_combustible.toUpperCase()],
      ['Capacidad Total', `${Number(tanque.capacidad_maxima).toFixed(1)} L`],
      ['Lectura Medida (Cierre)', `${Number(formLectura.cantidad_medida).toFixed(1)} L`],
      ['Nivel Porcentual', `${((Number(formLectura.cantidad_medida) / Number(tanque.capacidad_maxima)) * 100).toFixed(1)} %`],
      ['Observaciones', formLectura.observaciones || 'Ninguna']
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3, lineColor: [200, 200, 200] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: colors.lightGray, cellWidth: 50 },
      1: { cellWidth: 130 }
    }
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // --- TABLA DE ABASTECIMIENTOS CON LINK DE FOTO ---
  if (kpis.abastecimientos_hoy && kpis.abastecimientos_hoy.length > 0) {
    if (currentY > 210) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(...colors.dark);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('REGISTRO DE ABASTECIMIENTOS — EVIDENCIA FOTOGRÁFICA', marginX, currentY);
    doc.line(marginX, currentY + 2, marginX + 110, currentY + 2);
    currentY += 8;

    const HEAD = [['Hora', 'Placa', 'Conductor', 'Entidad', 'Litros', 'Evidencia Surtidor']];
    const ROWS = kpis.abastecimientos_hoy.map(a => [
      format(new Date(a.fecha), 'HH:mm'),
      a.placa || '?',
      a.conductor || a.bombero || '?',
      a.entidad || 'Tránsito / Externo',
      `${Number(a.litros).toFixed(1)} L`,
      a.tiene_foto ? 'Ver foto →' : 'Sin foto'
    ]);

    // Guardar la posición Y del inicio de la tabla para calcular dónde poner los links
    const tableStartY = currentY;
    let cellLinks = []; // Array de { url, x, y, w, h }

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: marginX, right: marginX },
      head: HEAD,
      body: ROWS,
      theme: 'striped',
      headStyles: {
        fillColor: colors.dark,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: colors.lightGray },
      columnStyles: {
        0: { cellWidth: 14 },  // Hora
        1: { cellWidth: 22 },  // Placa
        2: { cellWidth: 38 },  // Conductor
        3: { cellWidth: 45 },  // Entidad
        4: { cellWidth: 18, halign: 'right' }, // Litros
        5: { cellWidth: 28, textColor: colors.link, fontStyle: 'bold' } // Link
      },
      // Hook para capturar coordenadas de las celdas de foto
      didDrawCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 5) {
          const rowIndex = hookData.row.index;
          const abast = kpis.abastecimientos_hoy[rowIndex];
          if (abast && abast.url_foto_surtidor && abast.tiene_foto) {
            cellLinks.push({
              url: abast.url_foto_surtidor,
              x: hookData.cell.x,
              y: hookData.cell.y,
              w: hookData.cell.width,
              h: hookData.cell.height,
              page: hookData.pageNumber
            });
          }
        }
      }
    });

    // Añadir los hipervínculos reales sobre las celdas capturadas
    const totalPages = doc.internal.getNumberOfPages();
    cellLinks.forEach(link => {
      // Ir a la página donde está la celda
      if (link.page && link.page <= totalPages) {
        doc.setPage(link.page);
      }
      doc.link(link.x, link.y, link.w, link.h, { url: link.url });
    });

    // Regresar a la última página para el pie
    doc.setPage(doc.internal.getNumberOfPages());
  }

  // --- PIE DE PÁGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7.5);
    doc.text(
      'Generado por Sistema BAGFM — Aegis Fuel Management  |  Los enlaces de foto expiran en 72 horas',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
  }

  const fecha = fechaCierre ? format(new Date(fechaCierre), 'yyyyMMdd') : format(new Date(), 'yyyyMMdd');
  const tanqueSlug = tanque.nombre.replace(/\s+/g, '_').toLowerCase();
  doc.save(`cierre_fotos_${tanqueSlug}_${fecha}.pdf`);
};
