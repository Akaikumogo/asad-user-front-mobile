import jsPDF from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

type DeviceReport = {
  deviceId: string;
  deviceName?: string;
  deviceLocation?: string;
  totalEnergy: number;
  totalWater: number;
  hours?: number;
  days?: Array<{ date: string; energy: number; water: number }>;
  daysCount?: number;
};

type ReportData = {
  type: 'daily' | 'monthly' | 'yearly';
  date: string;
  devices: DeviceReport[];
  totalEnergy: number;
  totalWater: number;
  weekStart?: string;
  weekEnd?: string;
  month?: string;
  year?: string;
};

export const generatePDF = async (
  reportData: ReportData,
  translations: {
    title: string;
    daily: string;
    monthly: string;
    yearly: string;
    energy: string;
    water: string;
    totalEnergy: string;
    totalWater: string;
    deviceName: string;
    location: string;
    date: string;
    downloadSuccess: string;
    downloadError: string;
    devices: string;
  }
): Promise<void> => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const title = `${translations[reportData.type]} ${translations.title}`;
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Date/Period info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    let periodText = '';
    if (reportData.type === 'daily') {
      periodText = `${translations.date}: ${reportData.date}`;
    } else if (reportData.type === 'monthly') {
      periodText = `${translations.date}: ${reportData.month}`;
    } else if (reportData.type === 'yearly') {
      periodText = `${translations.date}: ${reportData.year}`;
    }
    if (reportData.weekStart && reportData.weekEnd) {
      periodText = `${reportData.weekStart} - ${reportData.weekEnd}`;
    }
    doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(translations.totalEnergy, 20, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`${reportData.totalEnergy.toFixed(2)} kWh`, 20, yPosition + 7);
    
    doc.setFont('helvetica', 'bold');
    doc.text(translations.totalWater, pageWidth / 2 + 20, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`${reportData.totalWater.toFixed(2)} L`, pageWidth / 2 + 20, yPosition + 7);
    yPosition += 20;

    // Devices
    if (reportData.devices.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${translations.devices}:`, 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      reportData.devices.forEach((device, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        // Device name
        doc.setFont('helvetica', 'bold');
        doc.text(
          `${index + 1}. ${device.deviceName || 'Unknown Device'}`,
          20,
          yPosition
        );
        yPosition += 7;

        // Location
        if (device.deviceLocation) {
          doc.setFont('helvetica', 'normal');
          doc.text(`${translations.location}: ${device.deviceLocation}`, 25, yPosition);
          yPosition += 7;
        }

        // Energy and Water
        doc.text(
          `${translations.energy}: ${device.totalEnergy.toFixed(2)} kWh`,
          25,
          yPosition
        );
        yPosition += 7;
        doc.text(
          `${translations.water}: ${device.totalWater.toFixed(2)} L`,
          25,
          yPosition
        );
        yPosition += 10;
      });
    }

    // Generate PDF as base64
    const pdfOutput = doc.output('arraybuffer');
    const pdfBlob = new Uint8Array(pdfOutput);

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let filename = '';
    if (reportData.type === 'daily') {
      filename = `Hisobot_Kunlik_${reportData.date.replace(/-/g, '')}_${timestamp}.pdf`;
    } else if (reportData.type === 'monthly') {
      filename = `Hisobot_Oylik_${reportData.month?.replace(/-/g, '')}_${timestamp}.pdf`;
    } else if (reportData.type === 'yearly') {
      filename = `Hisobot_Yillik_${reportData.year}_${timestamp}.pdf`;
    }

    // Save to Downloads folder on Android
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      // Convert Uint8Array to base64
      const base64Data = btoa(
        Array.from(pdfBlob)
          .map((byte) => String.fromCharCode(byte))
          .join('')
      );

      // For Android 10+ (API 29+), Capacitor Filesystem handles Scoped Storage automatically
      // Try multiple paths to ensure compatibility
      let saved = false;
      const pathsToTry = [
        `Download/${filename}`,  // Standard Downloads folder
        `download/${filename}`,  // Lowercase variant
        filename,                 // Root of ExternalStorage
      ];

      for (const path of pathsToTry) {
        try {
          await Filesystem.writeFile({
            path: path,
            data: base64Data,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
          saved = true;
          break;
        } catch (error) {
          // Continue to next path
          console.log(`Failed to save to ${path}, trying next...`);
        }
      }

      // If ExternalStorage fails, try Documents directory
      if (!saved) {
        try {
          await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });
          saved = true;
        } catch (docError) {
          // Last fallback: try Cache directory (user can manually move it)
          try {
            await Filesystem.writeFile({
              path: filename,
              data: base64Data,
              directory: Directory.Cache,
              recursive: true,
            });
            // Show message that file is in cache
            console.log('File saved to cache directory');
          } catch (cacheError) {
            throw new Error(translations.downloadError);
          }
        }
      }

      // Show success notification using Share plugin
      // This provides user feedback and allows them to share the file
      try {
        await Share.share({
          title: translations.downloadSuccess,
          text: `${filename} ${translations.downloadSuccess}`,
        });
      } catch (shareError) {
        // If share fails, that's okay - file is still saved
        // The UI will show success message from Reports component
        console.log('Share notification skipped:', shareError);
      }
    } else {
      // For web, download directly
      const blob = new Blob([pdfBlob], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};

