"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PdfExportButtonProps {
  targetId: string;
  filename?: string;
  className?: string;
}

export function PdfExportButton({ targetId, filename = "report", className }: PdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const el = document.getElementById(targetId);
      if (!el) { toast.error("Nothing to export"); return; }

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Clone the element and prepare for capture
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.width = `${el.scrollWidth}px`;
      clone.style.position = "absolute";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#09090b",
        logging: false,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL("image/png");

      // A4-ish sizing
      const pageWidth = 595; // A4 width in points
      const pageHeight = 842; // A4 height in points
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      const imgAspect = canvas.height / canvas.width;
      const contentHeight = contentWidth * imgAspect;

      const pdf = new jsPDF({
        orientation: contentHeight > pageHeight ? "portrait" : "portrait",
        unit: "pt",
        format: "a4",
      });

      // If content fits on one page
      if (contentHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, contentWidth, contentHeight);
      } else {
        // Multi-page: split the image
        const totalPages = Math.ceil(contentHeight / (pageHeight - margin * 2));
        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage();
          const srcY = (i * (pageHeight - margin * 2) / contentHeight) * canvas.height;
          const srcH = ((pageHeight - margin * 2) / contentHeight) * canvas.height;

          // Create a cropped canvas for this page
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.min(srcH, canvas.height - srcY);
          const pCtx = pageCanvas.getContext("2d")!;
          pCtx.drawImage(canvas, 0, srcY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);

          const pageImg = pageCanvas.toDataURL("image/png");
          const drawHeight = (pageCanvas.height / canvas.width) * contentWidth;
          pdf.addImage(pageImg, "PNG", margin, margin, contentWidth, drawHeight);
        }
      }

      pdf.save(`${filename}.pdf`);
      toast.success("PDF exported!");
    } catch (err) {
      console.error("PDF export error:", err);
      // Ultimate fallback: print
      window.print();
      toast.info("Print dialog opened as fallback");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className={className}>
      {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
      Export PDF
    </Button>
  );
}
