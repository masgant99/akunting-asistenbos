import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export const exportToPDF = (title: string, columns: any[], data: any[], filename: string) => {
  const doc = new jsPDF();
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("LENTERA AKUNTING", 14, 22);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(title, 14, 30);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 36);

  autoTable(doc, {
    startY: 45,
    head: [columns],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`${filename}.pdf`);
};

export const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
