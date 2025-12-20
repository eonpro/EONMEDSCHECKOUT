import PDFDocument from 'pdfkit';

export type PdfKeyValue = {
  label: string;
  value: string;
};

export type IntakePdfInput = {
  intakeId: string;
  submittedAtIso?: string;
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

function toSafeText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatMoney(amountCents: number, currency: string): string {
  const c = (currency || 'usd').toUpperCase();
  const dollars = (amountCents / 100).toFixed(2);
  return `${c} $${dollars}`;
}

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

function createDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'LETTER',
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: { Producer: 'EONMeds Checkout' },
  });
}

function collectPdf(doc: PDFKit.PDFDocument): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  const bottom = doc.page.margins.bottom;
  const y = doc.y;
  const pageHeight = doc.page.height;
  if (y + neededHeight > pageHeight - bottom) {
    doc.addPage();
  }
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  doc.font('Helvetica-Bold').fontSize(24).text('EONMeds', { align: 'left' });
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(20).text(title);
  if (subtitle) {
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#6B7280').text(subtitle);
    doc.fillColor('#000000');
  }
  doc.moveDown(1.5);
}

// Draw a light gray box background
function drawBox(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  doc
    .save()
    .fillColor('#F3F4F6')
    .rect(x, y, width, height)
    .fill()
    .restore();
}

function sectionBox(doc: PDFKit.PDFDocument, title: string, startY?: number) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = startY || doc.y;
  
  ensureSpace(doc, 40);
  
  // Draw section background
  drawBox(doc, doc.page.margins.left, y, pageWidth, 32);
  
  doc.y = y + 10;
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text(title);
  doc.moveDown(0.8);
}

function labeledField(doc: PDFKit.PDFDocument, label: string, value: string, width?: number, inline?: boolean) {
  const fieldWidth = width || (doc.page.width - doc.page.margins.left - doc.page.margins.right);
  const x = inline ? doc.x : doc.page.margins.left;
  const y = doc.y;
  
  // Calculate text heights to determine box size
  const labelHeight = doc.heightOfString(label.toUpperCase(), {
    width: fieldWidth - 24,
    font: 'Helvetica',
    fontSize: 9,
  });
  
  const valueHeight = doc.heightOfString(value || '-', {
    width: fieldWidth - 24,
    font: 'Helvetica',
    fontSize: 10,
  });
  
  const boxHeight = Math.max(55, labelHeight + valueHeight + 28);
  
  ensureSpace(doc, boxHeight + 5);
  
  // Draw white field box
  doc
    .save()
    .fillColor('#FFFFFF')
    .strokeColor('#D1D5DB')
    .lineWidth(1)
    .rect(x, y, fieldWidth, boxHeight)
    .fillAndStroke()
    .restore();
  
  // Label (small, gray, uppercase)
  doc.y = y + 10;
  doc.x = x + 12;
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(label.toUpperCase(), {
    width: fieldWidth - 24,
    lineGap: 2,
  });
  
  // Value (normal size, black)
  const afterLabelY = doc.y;
  doc.y = afterLabelY + 4;
  doc.x = x + 12;
  doc.font('Helvetica').fontSize(10).fillColor('#000000').text(value || '-', {
    width: fieldWidth - 24,
    lineGap: 2,
  });
  
  if (!inline) {
    doc.y = y + boxHeight + 8;
    doc.x = doc.page.margins.left;
  } else {
    // For inline fields, position for next column
    doc.y = y;
  }
}

function twoColumnFields(doc: PDFKit.PDFDocument, label1: string, value1: string, label2: string, value2: string) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const fieldWidth = (pageWidth - 12) / 2;
  const startY = doc.y;
  
  // Calculate heights for both fields
  const height1 = Math.max(
    55,
    doc.heightOfString(label1.toUpperCase(), { width: fieldWidth - 24, fontSize: 9 }) +
      doc.heightOfString(value1 || '-', { width: fieldWidth - 24, fontSize: 10 }) +
      28
  );
  
  const height2 = Math.max(
    55,
    doc.heightOfString(label2.toUpperCase(), { width: fieldWidth - 24, fontSize: 9 }) +
      doc.heightOfString(value2 || '-', { width: fieldWidth - 24, fontSize: 10 }) +
      28
  );
  
  const maxHeight = Math.max(height1, height2);
  
  ensureSpace(doc, maxHeight + 8);
  
  // Draw left field
  doc.x = doc.page.margins.left;
  doc.y = startY;
  labeledField(doc, label1, value1, fieldWidth, true);
  
  // Draw right field
  doc.x = doc.page.margins.left + fieldWidth + 12;
  doc.y = startY;
  labeledField(doc, label2, value2, fieldWidth, true);
  
  // Move to next row
  doc.y = startY + maxHeight + 8;
  doc.x = doc.page.margins.left;
}

function categorizeAnswers(answers: PdfKeyValue[]): {
  medicalHistory: PdfKeyValue[];
  treatmentReadiness: PdfKeyValue[];
  consents: PdfKeyValue[];
  other: PdfKeyValue[];
} {
  const medicalHistory: PdfKeyValue[] = [];
  const treatmentReadiness: PdfKeyValue[] = [];
  const consents: PdfKeyValue[] = [];
  const other: PdfKeyValue[] = [];

  const medicalKeywords = [
    'glp-1', 'glp1', 'medication', 'diabetes', 'thyroid', 'cancer', 'endocrine', 'neoplasia', 'men',
    'pancreatitis', 'pancrea', 'pregnant', 'pregnancy', 'breastfeeding', 'nursing', 'allerg',
    'blood pressure', 'bp', 'medical', 'condition', 'diagnosis', 'health', 'disease'
  ];

  const treatmentKeywords = [
    'committed', 'commitment', 'ready', 'age', '18', 'hear about', 'referral', 'source',
    'how did you', 'found us', 'interest', 'motivated'
  ];

  const consentKeywords = [
    'consent', 'agree', 'terms', 'condition', 'policy', 'telehealth', 'privacy',
    'cancellation', 'subscription', 'hipaa', 'acknowledge', 'understand', 'accept'
  ];

  for (const item of answers) {
    const labelLower = item.label.toLowerCase();
    
    if (medicalKeywords.some(kw => labelLower.includes(kw))) {
      medicalHistory.push(item);
    } else if (treatmentKeywords.some(kw => labelLower.includes(kw))) {
      treatmentReadiness.push(item);
    } else if (consentKeywords.some(kw => labelLower.includes(kw))) {
      consents.push(item);
    } else {
      other.push(item);
    }
  }

  return { medicalHistory, treatmentReadiness, consents, other };
}

export async function generateIntakePdf(input: IntakePdfInput): Promise<Uint8Array> {
  const doc = createDoc();

  const subtitleParts: string[] = [];
  if (input.submittedAtIso) subtitleParts.push(`Submitted via HeyFlow on ${formatIsoDate(input.submittedAtIso)}`);

  header(doc, 'Patient Intake Form', subtitleParts.join('  |  '));

  // Patient Information Section
  sectionBox(doc, 'Patient Information');
  twoColumnFields(doc, 'First Name', toSafeText(input.patient.firstName), 'Last Name', toSafeText(input.patient.lastName));
  twoColumnFields(doc, 'Date of Birth', toSafeText(input.patient.dateOfBirth), 'Sex', toSafeText(input.patient.gender));
  twoColumnFields(doc, 'Email Address', toSafeText(input.patient.email), 'Phone Number', toSafeText(input.patient.phone));
  doc.moveDown(1);

  // Shipping Information Section
  sectionBox(doc, 'Shipping Information');
  labeledField(doc, 'Street Address', toSafeText(input.patient.addressLine1));
  if (input.patient.addressLine2) {
    labeledField(doc, 'Apartment/Suite Number', toSafeText(input.patient.addressLine2));
  }
  twoColumnFields(doc, 'City', toSafeText(input.patient.city), 'State', toSafeText(input.patient.state));
  twoColumnFields(doc, 'Postal Code', toSafeText(input.patient.zipCode), 'Country', toSafeText(input.patient.country));
  doc.moveDown(1);

  // Categorize answers into sections
  const categorized = categorizeAnswers(input.answers || []);

  // Medical History Section
  if (categorized.medicalHistory.length > 0) {
    sectionBox(doc, 'Medical History');
    for (const item of categorized.medicalHistory) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      labeledField(doc, label, value);
    }
    doc.moveDown(1);
  }

  // Treatment Readiness Section
  if (categorized.treatmentReadiness.length > 0) {
    sectionBox(doc, 'Treatment Readiness');
    for (const item of categorized.treatmentReadiness) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      labeledField(doc, label, value);
    }
    doc.moveDown(1);
  }

  // Consent Agreements Section
  if (categorized.consents.length > 0) {
    sectionBox(doc, 'Consent Agreements');
    for (const item of categorized.consents) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      labeledField(doc, label, `✓ ${value}`);
    }
    doc.moveDown(1);
  }

  // Additional Information (catch-all for other questions)
  if (categorized.other.length > 0) {
    sectionBox(doc, 'Additional Information');
    for (const item of categorized.other) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      labeledField(doc, label, value);
    }
  }

  doc.end();
  return collectPdf(doc);
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = createDoc();

  const subtitleParts: string[] = [];
  subtitleParts.push(`PaymentIntent: ${input.paymentIntentId}`);
  if (input.paidAtIso) subtitleParts.push(`Paid: ${formatIsoDate(input.paidAtIso)}`);

  header(doc, 'Invoice / Payment Receipt', subtitleParts.join('  |  '));

  sectionTitle(doc, 'Status');
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('PAYMENT RECEIVED - READY FOR PRESCRIPTION REVIEW');
  doc.moveDown(0.8);

  sectionTitle(doc, 'Payment');
  keyValueRow(doc, 'Amount', formatMoney(input.amount, input.currency));

  sectionTitle(doc, 'Patient');
  keyValueRow(doc, 'Name', toSafeText(input.patient.name));
  keyValueRow(doc, 'Email', toSafeText(input.patient.email));
  if (input.patient.phone) keyValueRow(doc, 'Phone', toSafeText(input.patient.phone));

  sectionTitle(doc, 'Order');
  keyValueRow(doc, 'Medication', toSafeText(input.order.medication));
  keyValueRow(doc, 'Plan', toSafeText(input.order.plan));

  const addons = (input.order.addons || []).filter(Boolean);
  if (addons.length > 0) {
    ensureSpace(doc, 18);
    doc.font('Helvetica-Bold').fontSize(10).text('Add-ons:');
    for (const a of addons) bullet(doc, a);
  }

  ensureSpace(doc, 18);
  keyValueRow(doc, 'Shipping', input.order.expeditedShipping ? 'Expedited (3-5 business days)' : 'Standard (5-7 business days)');

  if (input.order.shippingAddress) {
    sectionTitle(doc, 'Shipping Address');
    const line1 = toSafeText(input.order.shippingAddress.line1);
    const line2 = toSafeText(input.order.shippingAddress.line2);
    const cityStateZip = `${toSafeText(input.order.shippingAddress.city)}, ${toSafeText(input.order.shippingAddress.state)} ${toSafeText(input.order.shippingAddress.zip)}`.trim();
    if (line1) doc.font('Helvetica').fontSize(10).text(line1);
    if (line2) doc.font('Helvetica').fontSize(10).text(line2);
    if (cityStateZip) doc.font('Helvetica').fontSize(10).text(cityStateZip);
  }

  doc.moveDown(1);
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(
    'This document is generated by EONMeds Checkout for internal recordkeeping and patient reference.',
    { align: 'left' }
  );
  doc.fillColor('#000000');

  doc.end();
  return collectPdf(doc);
}
