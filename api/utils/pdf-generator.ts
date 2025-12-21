import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export type PdfKeyValue = {
  label: string;
  value: string;
};

export type IntakePdfInput = {
  intakeId: string;
  submittedAtIso?: string;
  ipAddress?: string;
  patient: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  qualification?: {
    eligible?: string;
    bmi?: string;
    height?: string;
    weight?: string;
  };
  consents?: {
    termsAndConditions?: boolean | string;
    privacyPolicy?: boolean | string;
    telehealthConsent?: boolean | string;
    cancellationPolicy?: boolean | string;
    floridaWeightLoss?: boolean | string;
    floridaConsent?: boolean | string;
  };
  answers: PdfKeyValue[];
};

export type InvoicePdfInput = {
  paymentIntentId: string;
  paidAtIso?: string;
  amount: number; // cents
  currency: string;
  patient: {
    name?: string;
    email?: string;
    phone?: string;
  };
  order: {
    medication?: string;
    plan?: string;
    addons?: string[];
    expeditedShipping?: boolean;
    shippingAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
};

function formatIsoDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amountCents: number, currency: string): string {
  const dollars = (amountCents / 100).toFixed(2);
  return `$${dollars} ${currency.toUpperCase()}`;
}

export async function generateIntakePdf(input: IntakePdfInput): Promise<Uint8Array> {
  console.log('[pdf] Starting intake PDF generation with pdf-lib...');
  
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    const margin = 50;
    let yPosition = height - margin;
    
    const lineHeight = 15;
    const sectionSpacing = 20;
    
    // Helper to add new page if needed
    const checkSpace = (needed: number) => {
      if (yPosition - needed < margin) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - margin;
      }
    };
    
    // Title
    page.drawText('EONMeds Medical Intake Form', {
      x: margin,
      y: yPosition,
      size: 18,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yPosition -= 25;
    
    // MSO Disclosure
    page.drawText('MEDICAL SERVICE ORGANIZATION DISCLOSURE', {
      x: margin,
      y: yPosition,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 15;
    
    const msoText = 'Apollo Based Health, LLC dba EONMeds operates as a Medical Service Organization (MSO) providing non-clinical administrative and business services on behalf of Vital Link PLLC, a Wyoming-licensed medical practice.';
    const msoLines = wrapText(msoText, 75);
    for (const line of msoLines) {
      checkSpace(lineHeight);
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight;
    }
    yPosition -= sectionSpacing;
    
    // Submission Info
    if (input.submittedAtIso) {
      checkSpace(lineHeight);
      page.drawText(`Submitted: ${formatIsoDate(input.submittedAtIso)}`, {
        x: margin,
        y: yPosition,
        size: 9,
        font,
      });
      yPosition -= lineHeight;
    }
    
    if (input.intakeId) {
      checkSpace(lineHeight);
      page.drawText(`Intake ID: ${input.intakeId}`, {
        x: margin,
        y: yPosition,
        size: 9,
        font,
      });
      yPosition -= lineHeight;
    }
    
    yPosition -= sectionSpacing;
    
    // Patient Information
    checkSpace(25);
    page.drawText('I. Patient Information', {
      x: margin,
      y: yPosition,
      size: 12,
      font: fontBold,
    });
    yPosition -= 20;
    
    const patientFields = [
      { label: 'Name', value: `${input.patient.firstName || ''} ${input.patient.lastName || ''}`.trim() },
      { label: 'Email', value: input.patient.email },
      { label: 'Phone', value: input.patient.phone },
      { label: 'Date of Birth', value: input.patient.dateOfBirth },
      { label: 'Gender', value: input.patient.gender },
    ];
    
    for (const field of patientFields) {
      if (field.value) {
        checkSpace(lineHeight);
        page.drawText(`${field.label}: ${field.value}`, {
          x: margin + 10,
          y: yPosition,
          size: 10,
          font,
        });
        yPosition -= lineHeight;
      }
    }
    
    yPosition -= sectionSpacing;
    
    // Shipping Address
    checkSpace(25);
    page.drawText('II. Shipping Address', {
      x: margin,
      y: yPosition,
      size: 12,
      font: fontBold,
    });
    yPosition -= 20;
    
    if (input.patient.addressLine1) {
      checkSpace(lineHeight);
      page.drawText(input.patient.addressLine1, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= lineHeight;
    }
    
    if (input.patient.addressLine2) {
      checkSpace(lineHeight);
      page.drawText(input.patient.addressLine2, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= lineHeight;
    }
    
    const cityStateZip = [
      input.patient.city,
      input.patient.state,
      input.patient.zipCode,
    ].filter(Boolean).join(', ');
    
    if (cityStateZip) {
      checkSpace(lineHeight);
      page.drawText(cityStateZip, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= lineHeight;
    }
    
    yPosition -= sectionSpacing;
    
    // Medical History / Answers
    if (input.answers && input.answers.length > 0) {
      checkSpace(25);
      page.drawText('III. Medical History & Assessment', {
        x: margin,
        y: yPosition,
        size: 12,
        font: fontBold,
      });
      yPosition -= 20;
      
      for (const answer of input.answers) {
        const label = answer.label || 'Question';
        const value = answer.value || 'Not provided';
        
        // Question
        checkSpace(lineHeight * 2);
        const questionLines = wrapText(`Q: ${label}`, 70);
        for (const line of questionLines) {
          page.drawText(line, {
            x: margin + 10,
            y: yPosition,
            size: 9,
            font: fontBold,
            color: rgb(0.7, 0, 0),
          });
          yPosition -= lineHeight;
        }
        
        // Answer
        const answerLines = wrapText(`A: ${value}`, 70);
        for (const line of answerLines) {
          checkSpace(lineHeight);
          page.drawText(line, {
            x: margin + 10,
            y: yPosition,
            size: 10,
            font,
            color: rgb(0, 0.4, 0),
          });
          yPosition -= lineHeight;
        }
        
        yPosition -= 5; // Small gap between Q&A pairs
      }
    }
    
    yPosition -= sectionSpacing;
    
    // Consents Section
    if (input.consents) {
      checkSpace(25);
      page.drawText('VIII. Consent Agreements', {
        x: margin,
        y: yPosition,
        size: 12,
        font: fontBold,
      });
      yPosition -= 20;
      
      const consents = [
        { label: 'Terms & Conditions', value: input.consents.termsAndConditions },
        { label: 'Privacy Policy', value: input.consents.privacyPolicy },
        { label: 'Telehealth Consent', value: input.consents.telehealthConsent },
        { label: 'Cancellation Policy', value: input.consents.cancellationPolicy },
        { label: 'Florida Weight Loss Consent', value: input.consents.floridaWeightLoss },
        { label: 'Florida General Consent', value: input.consents.floridaConsent },
      ];
      
      for (const consent of consents) {
        if (consent.value) {
          checkSpace(lineHeight);
          const status = consent.value === true || consent.value === 'true' || 
                        String(consent.value).toLowerCase().includes('agree') ? '✓ Accepted' : String(consent.value);
          page.drawText(`${consent.label}: ${status}`, {
            x: margin + 10,
            y: yPosition,
            size: 10,
            font,
          });
          yPosition -= lineHeight;
        }
      }
    }
    
    yPosition -= sectionSpacing;
    
    // E-Signature
    checkSpace(40);
    page.drawText('IX. Electronic Signature', {
      x: margin,
      y: yPosition,
      size: 12,
      font: fontBold,
    });
    yPosition -= 20;
    
    const patientName = `${input.patient.firstName || ''} ${input.patient.lastName || ''}`.trim();
    if (patientName) {
      checkSpace(lineHeight);
      page.drawText(`E-Signed by: ${patientName}`, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: fontBold,
      });
      yPosition -= lineHeight;
    }
    
    if (input.submittedAtIso) {
      checkSpace(lineHeight);
      page.drawText(`Date/Time: ${formatIsoDate(input.submittedAtIso)}`, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= lineHeight;
    }
    
    if (input.ipAddress) {
      checkSpace(lineHeight);
      page.drawText(`IP Address: ${input.ipAddress}`, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= lineHeight;
    }
    
    const pdfBytes = await pdfDoc.save();
    console.log(`[pdf] ✅ Intake PDF generated successfully (${pdfBytes.length} bytes)`);
    return pdfBytes;
    
  } catch (error: any) {
    console.error('[pdf] ❌ Error generating intake PDF:', {
      message: error?.message,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    throw error;
  }
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  console.log('[pdf] Starting invoice PDF generation with pdf-lib...');
  
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const margin = 50;
    let yPosition = height - margin;
    
    // Title
    page.drawText('INVOICE - EONMeds', {
      x: margin,
      y: yPosition,
      size: 20,
      font: fontBold,
    });
    yPosition -= 40;
    
    // Payment Intent ID
    page.drawText(`Payment ID: ${input.paymentIntentId}`, {
      x: margin,
      y: yPosition,
      size: 10,
      font,
    });
    yPosition -= 20;
    
    if (input.paidAtIso) {
      page.drawText(`Paid: ${formatIsoDate(input.paidAtIso)}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= 20;
    }
    
    // Patient Info
    page.drawText('Patient Information:', {
      x: margin,
      y: yPosition,
      size: 12,
      font: fontBold,
    });
    yPosition -= 20;
    
    if (input.patient.name) {
      page.drawText(`Name: ${input.patient.name}`, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= 15;
    }
    
    if (input.patient.email) {
      page.drawText(`Email: ${input.patient.email}`, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= 15;
    }
    
    yPosition -= 20;
    
    // Order Details
    page.drawText('Order Details:', {
      x: margin,
      y: yPosition,
      size: 12,
      font: fontBold,
    });
    yPosition -= 20;
    
    if (input.order.medication) {
      page.drawText(`Medication: ${input.order.medication}`, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= 15;
    }
    
    if (input.order.plan) {
      page.drawText(`Plan: ${input.order.plan}`, {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= 15;
    }
    
    // Amount
    yPosition -= 20;
    page.drawText('Amount:', {
      x: margin,
      y: yPosition,
      size: 12,
      font: fontBold,
    });
    yPosition -= 20;
    
    page.drawText(formatMoney(input.amount, input.currency), {
      x: margin + 10,
      y: yPosition,
      size: 14,
      font: fontBold,
      color: rgb(0, 0.5, 0),
    });
    yPosition -= 30;
    
    // Status
    page.drawText('PAYMENT RECEIVED', {
      x: margin,
      y: yPosition,
      size: 12,
      font: fontBold,
      color: rgb(0, 0.5, 0),
    });
    yPosition -= 20;
    
    page.drawText('Ready for prescription review', {
      x: margin,
      y: yPosition,
      size: 10,
      font,
    });
    
    const pdfBytes = await pdfDoc.save();
    console.log(`[pdf] ✅ Invoice PDF generated successfully (${pdfBytes.length} bytes)`);
    return pdfBytes;
    
  } catch (error: any) {
    console.error('[pdf] ❌ Error generating invoice PDF:', {
      message: error?.message,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    throw error;
  }
}

// Helper function to wrap text
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).length <= maxChars) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}
