import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  // Fondo oscuro para la cabecera
  doc.setFillColor(...colors.dark);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Título Principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BOMBA DE COMBUSTIBLE BAGFM', marginX, 22);

  doc.setTextColor(...colors.primary);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('REPORTE OFICIAL DE CIERRE DIARIO', marginX, 30);

  // Fecha y detalles a la derecha
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
    ['Solicitudes Excepcionales', `${kpis.solicitudes_pendientes || 0}`] // Se puede ajustar a resueltas si se tuviera
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
    // Check if new page is needed
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

  // Guardar PDF
  const filename = `cierre_${tanque.nombre.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(filename);
};
