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
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
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
  doc.font('Helvetica-Bold').fontSize(20).text('EONMeds', { align: 'left' });
  doc.moveDown(0.25);
  doc.font('Helvetica-Bold').fontSize(16).text(title);
  if (subtitle) {
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(10).fillColor('#374151').text(subtitle);
    doc.fillColor('#000000');
  }
  doc.moveDown(0.8);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#E5E7EB')
    .stroke();
  doc.strokeColor('#000000');
  doc.moveDown(1);
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 28);
  doc.font('Helvetica-Bold').fontSize(12).text(title);
  doc.moveDown(0.4);
}

function keyValueRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  ensureSpace(doc, 18);
  doc.font('Helvetica-Bold').fontSize(10).text(`${label}:`, { continued: true });
  doc.font('Helvetica').fontSize(10).text(` ${value || '-'}`);
}

function bullet(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 18);
  doc.font('Helvetica').fontSize(10).text(`• ${text}`);
}

export async function generateIntakePdf(input: IntakePdfInput): Promise<Uint8Array> {
  const doc = createDoc();

  const subtitleParts: string[] = [];
  if (input.intakeId) subtitleParts.push(`Intake ID: ${input.intakeId}`);
  if (input.submittedAtIso) subtitleParts.push(`Submitted: ${formatIsoDate(input.submittedAtIso)}`);

  header(doc, 'Medical Intake Submission', subtitleParts.join('  |  '));

  sectionTitle(doc, 'Patient');
  keyValueRow(doc, 'Name', `${toSafeText(input.patient.firstName)} ${toSafeText(input.patient.lastName)}`.trim());
  keyValueRow(doc, 'Email', toSafeText(input.patient.email));
  keyValueRow(doc, 'Phone', toSafeText(input.patient.phone));
  keyValueRow(doc, 'DOB', toSafeText(input.patient.dateOfBirth));

  const addressLine = [
    input.patient.addressLine1,
    input.patient.addressLine2,
    `${toSafeText(input.patient.city)}, ${toSafeText(input.patient.state)} ${toSafeText(input.patient.zipCode)}`.trim(),
  ]
    .map(toSafeText)
    .filter(Boolean)
    .join(', ');

  if (addressLine) {
    keyValueRow(doc, 'Address', addressLine);
  }

  if (input.qualification) {
    sectionTitle(doc, 'Qualification');
    if (input.qualification.eligible) keyValueRow(doc, 'Eligibility', input.qualification.eligible);
    if (input.qualification.bmi) keyValueRow(doc, 'BMI', input.qualification.bmi);
    if (input.qualification.height) keyValueRow(doc, 'Height', input.qualification.height);
    if (input.qualification.weight) keyValueRow(doc, 'Weight', input.qualification.weight);
  }

  sectionTitle(doc, 'Responses');

  if (Array.isArray(input.answers) && input.answers.length > 0) {
    for (const item of input.answers) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label && !value) continue;
      ensureSpace(doc, 22);
      doc.font('Helvetica-Bold').fontSize(10).text(label || 'Question');
      doc.font('Helvetica').fontSize(10).fillColor('#111827').text(value || '-');
      doc.fillColor('#000000');
      doc.moveDown(0.6);
    }
  } else {
    doc.font('Helvetica').fontSize(10).text('No responses provided.');
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
