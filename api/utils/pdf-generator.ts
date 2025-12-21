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
  amount: number;
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
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amountCents: number, currency: string): string {
  const dollars = (amountCents / 100).toFixed(2);
  return `$${dollars} ${currency.toUpperCase()}`;
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  const avgCharWidth = fontSize * 0.5;
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Categorize answers into sections (matching Google Script logic)
function categorizeAnswers(answers: PdfKeyValue[]): Record<string, PdfKeyValue[]> {
  const categories: Record<string, PdfKeyValue[]> = {
    'Patient Information': [],
    'Physical Measurements': [],
    'Medical History': [],
    'GLP-1 Treatment History': [],
    'Lifestyle & Habits': [],
    'Treatment Readiness': [],
    'Additional Information': [],
  };
  
  for (const answer of answers) {
    const label = answer.label.toLowerCase();
    
    if (label.includes('name') || label.includes('gender') || label.includes('dob') || 
        label.includes('birth') || label.includes('email') || label.includes('phone')) {
      categories['Patient Information'].push(answer);
    } else if (label.includes('weight') || label.includes('height') || label.includes('bmi') || 
               label.includes('feet') || label.includes('inches')) {
      categories['Physical Measurements'].push(answer);
    } else if (label.includes('glp') || label.includes('semaglutide') || label.includes('ozempic') || 
               label.includes('wegovy') || label.includes('dose') || label.includes('medication') ||
               label.includes('success') || label.includes('side effect')) {
      categories['GLP-1 Treatment History'].push(answer);
    } else if (label.includes('activity') || label.includes('alcohol') || label.includes('exercise')) {
      categories['Lifestyle & Habits'].push(answer);
    } else if (label.includes('commitment') || label.includes('hear about') || label.includes('life change')) {
      categories['Treatment Readiness'].push(answer);
    } else if (label.includes('diabetes') || label.includes('thyroid') || label.includes('neoplasia') || 
               label.includes('pancreatitis') || label.includes('pregnant') || label.includes('allergy') || 
               label.includes('blood') || label.includes('medical') || label.includes('health') ||
               label.includes('chronic') || label.includes('condition') || label.includes('illness') ||
               label.includes('disease') || label.includes('diagnosed') || label.includes('surgeries') ||
               label.includes('gastroparesis') || label.includes('cancer') || label.includes('breastfeeding')) {
      categories['Medical History'].push(answer);
    } else {
      categories['Additional Information'].push(answer);
    }
  }
  
  return categories;
}

export async function generateIntakePdf(input: IntakePdfInput): Promise<Uint8Array> {
  console.log('[pdf] Starting intake PDF generation with pdf-lib...');
  
  try {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    const margin = 40;
    let y = height - margin;
    
    const sectionBg = rgb(0.925, 0.937, 0.906); // #ECEFE7
    const brandGreen = rgb(0.298, 0.686, 0.314); // #4CAF50
    const textDark = rgb(0, 0, 0);
    const textGray = rgb(0.4, 0.4, 0.4);
    const textLight = rgb(0.6, 0.6, 0.6);
    
    const checkSpace = (needed: number) => {
      if (y - needed < margin + 20) {
        page = pdfDoc.addPage([612, 792]);
        y = height - margin;
      }
    };
    
    // ========== HEADER: EONMeds Logo ==========
    checkSpace(60);
    page.drawText('EONMeds', {
      x: width / 2 - 60,
      y: y,
      size: 32,
      font: fontBold,
      color: brandGreen,
    });
    y -= 50;
    
    // Title
    page.drawText('Medical Intake Form', {
      x: width / 2 - 90,
      y: y,
      size: 18,
      font: fontBold,
      color: textDark,
    });
    y -= 20;
    
    // Subtitle
    const subtitle = `Submitted on ${formatIsoDate(input.submittedAtIso)}`;
    page.drawText(subtitle, {
      x: width / 2 - (subtitle.length * 3),
      y: y,
      size: 10,
      font: fontRegular,
      color: textGray,
    });
    y -= 30;
    
    // ========== MSO DISCLOSURE BOX ==========
    checkSpace(80);
    // Draw background box
    page.drawRectangle({
      x: margin,
      y: y - 65,
      width: width - 2 * margin,
      height: 70,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });
    
    y -= 15;
    page.drawText('MANAGEMENT SERVICE ORGANIZATION DISCLOSURE', {
      x: margin + 10,
      y: y,
      size: 9,
      font: fontBold,
      color: textDark,
    });
    y -= 15;
    
    const msoText = 'Apollo Based Health, LLC dba EONMeds operates as a Management Service Organization (MSO) ' +
                    'providing non-clinical administrative and business services on behalf of Vital Link PLLC, ' +
                    'a Wyoming-licensed medical practice. All clinical services, medical decisions, and prescriptions ' +
                    'are provided by licensed healthcare providers employed by or contracted with Vital Link PLLC.';
    
    const msoLines = wrapText(msoText, width - 2 * margin - 20, 8);
    for (const line of msoLines) {
      page.drawText(line, {
        x: margin + 10,
        y: y,
        size: 8,
        font: fontRegular,
        color: textDark,
      });
      y -= 12;
    }
    
    y -= 25;
    
    // ========== SECTION: Patient Information ==========
    checkSpace(120);
    // Section background
    page.drawRectangle({
      x: margin,
      y: y - 100,
      width: width - 2 * margin,
      height: 110,
      color: sectionBg,
    });
    
    y -= 15;
    page.drawText('I. PATIENT INFORMATION', {
      x: margin + 15,
      y: y,
      size: 12,
      font: fontBold,
      color: textDark,
    });
    y -= 25;
    
    const patientName = `${input.patient.firstName || ''} ${input.patient.lastName || ''}`.trim();
    const patientFields = [
      { label: 'NAME', value: patientName, col: 1 },
      { label: 'GENDER', value: input.patient.gender || 'Not provided', col: 2 },
      { label: 'EMAIL', value: input.patient.email || 'Not provided', col: 1 },
      { label: 'PHONE', value: input.patient.phone || 'Not provided', col: 2 },
      { label: 'DATE OF BIRTH', value: input.patient.dateOfBirth || 'Not provided', col: 1 },
    ];
    
    let col1Y = y;
    let col2Y = y;
    const colWidth = (width - 2 * margin - 30) / 2;
    
    for (const field of patientFields) {
      const x = field.col === 1 ? margin + 15 : margin + 15 + colWidth + 10;
      const currentY = field.col === 1 ? col1Y : col2Y;
      
      // Label
      page.drawText(field.label, {
        x,
        y: currentY,
        size: 8,
        font: fontBold,
        color: textLight,
      });
      
      // Value
      page.drawText(field.value.substring(0, 40), {
        x,
        y: currentY - 12,
        size: 10,
        font: fontRegular,
        color: textDark,
      });
      
      if (field.col === 1) {
        col1Y -= 30;
      } else {
        col2Y -= 30;
      }
    }
    
    y = Math.min(col1Y, col2Y) - 10;
    
    // ========== SECTION: Shipping Address ==========
    checkSpace(100);
    page.drawRectangle({
      x: margin,
      y: y - 90,
      width: width - 2 * margin,
      height: 100,
      color: sectionBg,
    });
    
    y -= 15;
    page.drawText('II. SHIPPING ADDRESS', {
      x: margin + 15,
      y: y,
      size: 12,
      font: fontBold,
      color: textDark,
    });
    y -= 25;
    
    page.drawText('STREET ADDRESS', {
      x: margin + 15,
      y: y,
      size: 8,
      font: fontBold,
      color: textLight,
    });
    y -= 12;
    page.drawText((input.patient.addressLine1 || 'Not provided').substring(0, 60), {
      x: margin + 15,
      y: y,
      size: 10,
      font: fontRegular,
      color: textDark,
    });
    y -= 20;
    
    if (input.patient.addressLine2) {
      page.drawText('APT/SUITE', {
        x: margin + 15,
        y: y,
        size: 8,
        font: fontBold,
        color: textLight,
      });
      y -= 12;
      page.drawText(input.patient.addressLine2.substring(0, 40), {
        x: margin + 15,
        y: y,
        size: 10,
        font: fontRegular,
        color: textDark,
      });
      y -= 20;
    }
    
    // City, State, Zip in row
    const cityStateZip = `${input.patient.city || ''}, ${input.patient.state || ''} ${input.patient.zipCode || ''}`.trim();
    page.drawText('CITY, STATE, ZIP', {
      x: margin + 15,
      y: y,
      size: 8,
      font: fontBold,
      color: textLight,
    });
    y -= 12;
    page.drawText(cityStateZip || 'Not provided', {
      x: margin + 15,
      y: y,
      size: 10,
      font: fontRegular,
      color: textDark,
    });
    y -= 30;
    
    // ========== CATEGORIZED Q&A SECTIONS ==========
    const categories = categorizeAnswers(input.answers);
    
    for (const [categoryName, fields] of Object.entries(categories)) {
      if (fields.length === 0) continue;
      
      checkSpace(60);
      
      // Section header
      const sectionHeight = Math.min(fields.length * 40 + 40, 300);
      page.drawRectangle({
        x: margin,
        y: y - sectionHeight,
        width: width - 2 * margin,
        height: sectionHeight + 10,
        color: sectionBg,
      });
      
      y -= 15;
      page.drawText(categoryName.toUpperCase(), {
        x: margin + 15,
        y: y,
        size: 12,
        font: fontBold,
        color: textDark,
      });
      y -= 25;
      
      // Draw fields in two-column grid
      col1Y = y;
      col2Y = y;
      let colToggle = 1;
      
      for (const field of fields) {
        const fieldX = colToggle === 1 ? margin + 15 : margin + 15 + colWidth + 10;
        const fieldY = colToggle === 1 ? col1Y : col2Y;
        
        checkSpace(40);
        
        // Question label (uppercase)
        const labelText = field.label.toUpperCase().substring(0, 50);
        page.drawText(labelText, {
          x: fieldX,
          y: fieldY,
          size: 7,
          font: fontBold,
          color: textLight,
        });
        
        // Answer value
        const valueText = (field.value || 'Not provided').substring(0, 50);
        page.drawText(valueText, {
          x: fieldX,
          y: fieldY - 11,
          size: 9,
          font: fontRegular,
          color: textDark,
        });
        
        if (colToggle === 1) {
          col1Y -= 35;
          colToggle = 2;
        } else {
          col2Y -= 35;
          colToggle = 1;
        }
      }
      
      y = Math.min(col1Y, col2Y) - 15;
    }
    
    // ========== SECTION: Consent Agreements ==========
    if (input.consents) {
      checkSpace(120);
      page.drawRectangle({
        x: margin,
        y: y - 110,
        width: width - 2 * margin,
        height: 120,
        color: sectionBg,
      });
      
      y -= 15;
      page.drawText('CONSENT AGREEMENTS', {
        x: margin + 15,
        y: y,
        size: 12,
        font: fontBold,
        color: textDark,
      });
      y -= 25;
      
      const consents = [
        { label: 'Terms & Conditions', value: input.consents.termsAndConditions },
        { label: 'Privacy Policy', value: input.consents.privacyPolicy },
        { label: 'Telehealth Consent', value: input.consents.telehealthConsent },
        { label: 'Cancellation Policy', value: input.consents.cancellationPolicy },
        { label: 'Florida Weight Loss', value: input.consents.floridaWeightLoss },
        { label: 'Florida Consent', value: input.consents.floridaConsent },
      ];
      
      for (const consent of consents) {
        if (consent.value === undefined) continue;
        
        const status = consent.value === true || String(consent.value).toLowerCase().includes('agree') 
          ? '[X] Accepted' 
          : '[ ] Not Accepted';
        const statusColor = status.includes('[X]') ? rgb(0.36, 0.72, 0.36) : rgb(0.8, 0.2, 0.2);
        
        page.drawText(consent.label, {
          x: margin + 15,
          y: y,
          size: 9,
          font: fontRegular,
          color: textDark,
        });
        
        page.drawText(status, {
          x: width - margin - 80,
          y: y,
          size: 9,
          font: fontBold,
          color: statusColor,
        });
        
        y -= 15;
      }
      
      y -= 20;
    }
    
    // ========== SECTION: Electronic Signature ==========
    checkSpace(80);
    page.drawRectangle({
      x: margin,
      y: y - 70,
      width: width - 2 * margin,
      height: 80,
      color: sectionBg,
    });
    
    y -= 15;
    page.drawText('ELECTRONIC SIGNATURE', {
      x: margin + 15,
      y: y,
      size: 12,
      font: fontBold,
      color: textDark,
    });
    y -= 25;
    
    page.drawText(`E-Signed by: ${patientName || 'Unknown'}`, {
      x: margin + 15,
      y: y,
      size: 10,
      font: fontBold,
      color: textDark,
    });
    y -= 15;
    
    page.drawText(`Date/Time: ${formatIsoDate(input.submittedAtIso)}`, {
      x: margin + 15,
      y: y,
      size: 9,
      font: fontRegular,
      color: textDark,
    });
    y -= 15;
    
    page.drawText(`IP Address: ${input.ipAddress || 'Not captured'}`, {
      x: margin + 15,
      y: y,
      size: 9,
      font: fontRegular,
      color: textGray,
    });
    y -= 30;
    
    // ========== FOOTER ==========
    checkSpace(50);
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 15;
    
    page.drawText('EONPro Medical Intake Form', {
      x: width / 2 - 70,
      y: y,
      size: 9,
      font: fontBold,
      color: textDark,
    });
    y -= 12;
    
    page.drawText(`Intake ID: ${input.intakeId} | Document Type: Completed Intake Record`, {
      x: width / 2 - 120,
      y: y,
      size: 8,
      font: fontRegular,
      color: textGray,
    });
    
    const pdfBytes = await pdfDoc.save();
    console.log(`[pdf] ✅ Intake PDF generated (${pdfBytes.length} bytes)`);
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
  console.log('[pdf] Starting invoice PDF generation...');
  
  try {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const margin = 40;
    let y = height - margin;
    
    const brandGreen = rgb(0.298, 0.686, 0.314);
    const sectionBg = rgb(0.925, 0.937, 0.906);
    
    // Logo
    page.drawText('EONMeds', {
      x: width / 2 - 60,
      y: y,
      size: 32,
      font: fontBold,
      color: brandGreen,
    });
    y -= 50;
    
    // Title
    page.drawText('INVOICE', {
      x: width / 2 - 35,
      y: y,
      size: 20,
      font: fontBold,
    });
    y -= 30;
    
    // Payment details
    page.drawText(`Payment ID: ${input.paymentIntentId}`, {
      x: margin,
      y: y,
      size: 9,
      font: fontRegular,
    });
    y -= 15;
    
    if (input.paidAtIso) {
      page.drawText(`Paid: ${formatIsoDate(input.paidAtIso)}`, {
        x: margin,
        y: y,
        size: 9,
        font: fontRegular,
      });
      y -= 25;
    }
    
    // Patient section
    page.drawRectangle({
      x: margin,
      y: y - 70,
      width: width - 2 * margin,
      height: 80,
      color: sectionBg,
    });
    
    y -= 15;
    page.drawText('PATIENT INFORMATION', {
      x: margin + 15,
      y: y,
      size: 11,
      font: fontBold,
    });
    y -= 20;
    
    page.drawText(input.patient.name || 'N/A', {
      x: margin + 15,
      y: y,
      size: 10,
      font: fontRegular,
    });
    y -= 12;
    page.drawText(input.patient.email || '', {
      x: margin + 15,
      y: y,
      size: 9,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 30;
    
    // Order details
    page.drawRectangle({
      x: margin,
      y: y - 80,
      width: width - 2 * margin,
      height: 90,
      color: sectionBg,
    });
    
    y -= 15;
    page.drawText('ORDER DETAILS', {
      x: margin + 15,
      y: y,
      size: 11,
      font: fontBold,
    });
    y -= 20;
    
    if (input.order.medication) {
      page.drawText(`Medication: ${input.order.medication}`, {
        x: margin + 15,
        y: y,
        size: 10,
        font: fontRegular,
      });
      y -= 15;
    }
    
    if (input.order.plan) {
      page.drawText(`Plan: ${input.order.plan}`, {
        x: margin + 15,
        y: y,
        size: 10,
        font: fontRegular,
      });
      y -= 15;
    }
    
    page.drawText(`Shipping: ${input.order.expeditedShipping ? 'Expedited' : 'Standard'}`, {
      x: margin + 15,
      y: y,
      size: 10,
      font: fontRegular,
    });
    y -= 30;
    
    // Amount
    page.drawText('AMOUNT', {
      x: margin,
      y: y,
      size: 11,
      font: fontBold,
    });
    y -= 20;
    
    page.drawText(formatMoney(input.amount, input.currency), {
      x: margin,
      y: y,
      size: 16,
      font: fontBold,
      color: brandGreen,
    });
    y -= 30;
    
    // Status
    page.drawRectangle({
      x: margin,
      y: y - 30,
      width: width - 2 * margin,
      height: 40,
      color: rgb(0.9, 0.98, 0.9),
      borderColor: brandGreen,
      borderWidth: 1,
    });
    
    y -= 12;
    page.drawText('[PAID] PAYMENT RECEIVED - READY FOR PRESCRIPTION REVIEW', {
      x: margin + 15,
      y: y,
      size: 10,
      font: fontBold,
      color: brandGreen,
    });
    
    const pdfBytes = await pdfDoc.save();
    console.log(`[pdf] ✅ Invoice PDF generated (${pdfBytes.length} bytes)`);
    return pdfBytes;
    
  } catch (error: any) {
    console.error('[pdf] ❌ Error generating invoice PDF:', {
      message: error?.message,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    throw error;
  }
}
