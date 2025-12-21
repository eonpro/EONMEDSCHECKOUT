// Dynamic import to avoid issues in Vercel serverless
let PDFDocument: any;

async function loadPDFKit() {
  if (!PDFDocument) {
    try {
      // Use require for better compatibility with native modules
      PDFDocument = require('pdfkit');
    } catch (e: any) {
      console.error('[pdf] Failed to load PDFKit:', e?.message || e);
      throw new Error('PDF generation unavailable');
    }
  }
  return PDFDocument;
}

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

async function createDoc(): Promise<any> {
  const PDFDoc = await loadPDFKit();
  return new PDFDoc({
    size: 'LETTER',
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: { Producer: 'EONMeds Checkout' },
  });
}

function collectPdf(doc: any): Promise<Uint8Array> {
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
  // Only add page if we're within 80px of the bottom
  if (y + neededHeight > pageHeight - bottom - 80) {
    doc.addPage();
  }
}

function header(doc: any, title: string, subtitle?: string) {
  // Professional header with branding
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  
  // EONMeds logo/branding (styled text since we can't embed images easily)
  doc.font('Helvetica-Bold').fontSize(28).fillColor('#00B4D8').text('eon', { continued: true });
  doc.font('Helvetica').fontSize(28).fillColor('#000000').text('meds');
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text('Telehealth Weight Management Services');
  doc.fillColor('#000000');
  doc.moveDown(0.8);
  
  // Title
  doc.font('Helvetica-Bold').fontSize(18).text(title);
  if (subtitle) {
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(subtitle);
    doc.fillColor('#000000');
  }
  
  // Divider line
  doc.moveDown(0.5);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#E5E7EB')
    .lineWidth(1)
    .stroke();
  doc.strokeColor('#000000');
  doc.moveDown(1);
}

function sectionTitle(doc: any, title: string) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  
  // Just draw a simple gray bar with title
  doc
    .save()
    .fillColor('#F3F4F6')
    .rect(doc.page.margins.left, y, pageWidth, 24)
    .fill()
    .restore();
  
  doc.y = y + 6;
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(title);
  doc.moveDown(0.3);
}

function simpleField(doc: any, label: string, value: string) {
  // Ultra-simple: label on one line, value on next
  doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(label.toUpperCase());
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(value || '-');
  doc.moveDown(0.4);
}

function categorizeAnswers(answers: PdfKeyValue[]): {
  medicalHistory: PdfKeyValue[];
  glp1Usage: PdfKeyValue[];
  lifestyle: PdfKeyValue[];
  referral: PdfKeyValue[];
  other: PdfKeyValue[];
} {
  const medicalHistory: PdfKeyValue[] = [];
  const glp1Usage: PdfKeyValue[] = [];
  const lifestyle: PdfKeyValue[] = [];
  const referral: PdfKeyValue[] = [];
  const other: PdfKeyValue[] = [];

  const medicalKeywords = [
    'diabetes', 'thyroid', 'cancer', 'endocrine', 'neoplasia', 'pancreatitis',
    'gastroparesis', 'pregnant', 'pregnancy', 'breastfeeding', 'chronic', 'condition',
    'diagnosis', 'surgery', 'procedure', 'blood pressure', 'mental health', 'family history'
  ];

  const glp1Keywords = [
    'glp-1', 'glp1', 'semaglutide', 'tirzepatide', 'ozempic', 'wegovy', 'mounjaro',
    'zepbound', 'dose', 'medication type', 'current dose', 'success', 'side effect'
  ];

  const lifestyleKeywords = [
    'activity', 'exercise', 'physical', 'alcohol', 'smoking', 'diet', 'weight',
    'bmi', 'height', 'ideal weight', 'starting weight', 'pounds to lose'
  ];

  const referralKeywords = [
    'hear about', 'referral', 'referred', 'how did you', 'source', 'life change', 'goals'
  ];

  for (const item of answers) {
    const labelLower = item.label.toLowerCase();
    
    if (glp1Keywords.some(kw => labelLower.includes(kw))) {
      glp1Usage.push(item);
    } else if (medicalKeywords.some(kw => labelLower.includes(kw))) {
      medicalHistory.push(item);
    } else if (lifestyleKeywords.some(kw => labelLower.includes(kw))) {
      lifestyle.push(item);
    } else if (referralKeywords.some(kw => labelLower.includes(kw))) {
      referral.push(item);
    } else {
      other.push(item);
    }
  }

  return { medicalHistory, glp1Usage, lifestyle, referral, other };
}

export async function generateIntakePdf(input: IntakePdfInput): Promise<Uint8Array> {
  const doc = await createDoc();

  const subtitleParts: string[] = [];
  if (input.submittedAtIso) subtitleParts.push(`Submitted: ${formatIsoDate(input.submittedAtIso)}`);
  if (input.intakeId) subtitleParts.push(`ID: ${input.intakeId}`);

  header(doc, 'Medical Intake Form', subtitleParts.join('  |  '));

  // MSO DISCLOSURE (Critical for legal compliance)
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .save()
    .fillColor('#F3F4F6')
    .rect(doc.page.margins.left, doc.y, pageWidth, 50)
    .fill()
    .restore();
  
  doc.y += 8;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text('MEDICAL SERVICE ORGANIZATION DISCLOSURE');
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(8).fillColor('#000000').text(
    'Apollo Based Health, LLC dba EONMeds operates as a Medical Service Organization (MSO) ' +
    'providing non-clinical administrative and business services on behalf of Vital Link PLLC, ' +
    'a Wyoming-licensed medical practice. All clinical services, medical decisions, and prescriptions ' +
    'are provided by licensed healthcare providers employed by or contracted with Vital Link PLLC.',
    { align: 'left' }
  );
  doc.y += 58; // Move past the MSO disclosure box
  doc.moveDown(1);

  // ========================================
  // SECTION 1: PATIENT INFORMATION
  // ========================================
  sectionTitle(doc, 'I. Patient Information');
  simpleField(doc, 'First Name', toSafeText(input.patient.firstName));
  simpleField(doc, 'Last Name', toSafeText(input.patient.lastName));
  simpleField(doc, 'Date of Birth', toSafeText(input.patient.dateOfBirth));
  if (input.patient.gender) simpleField(doc, 'Gender/Sex', toSafeText(input.patient.gender));
  simpleField(doc, 'Email Address', toSafeText(input.patient.email));
  simpleField(doc, 'Phone Number', toSafeText(input.patient.phone));
  doc.moveDown(0.8);

  // ========================================
  // SECTION 2: SHIPPING ADDRESS
  // ========================================
  sectionTitle(doc, 'II. Shipping Address');
  if (input.patient.addressLine1) simpleField(doc, 'Street Address', toSafeText(input.patient.addressLine1));
  if (input.patient.addressLine2) simpleField(doc, 'Apartment/Suite #', toSafeText(input.patient.addressLine2));
  if (input.patient.city) simpleField(doc, 'City', toSafeText(input.patient.city));
  if (input.patient.state) simpleField(doc, 'State', toSafeText(input.patient.state));
  if (input.patient.zipCode) simpleField(doc, 'Postal Code', toSafeText(input.patient.zipCode));
  if (input.patient.country) simpleField(doc, 'Country', toSafeText(input.patient.country));
  doc.moveDown(0.8);

  const categorized = categorizeAnswers(input.answers || []);

  // ========================================
  // SECTION 3: CLINICAL ASSESSMENT & TREATMENT RATIONALE
  // (Establishes medical necessity for personalized treatment)
  // ========================================
  sectionTitle(doc, 'III. Clinical Assessment & Treatment Rationale');
  
  // Highlight key answers that support personalized treatment
  const medicalNecessity: PdfKeyValue[] = [];
  
  for (const item of input.answers || []) {
    const labelLower = item.label.toLowerCase();
    
    // Flag answers that indicate need for personalized/tailored treatment
    if (
      labelLower.includes('personalized') ||
      labelLower.includes('side effect') ||
      labelLower.includes('successful') ||
      labelLower.includes('dose') ||
      labelLower.includes('glp-1') ||
      labelLower.includes('semaglutide') ||
      labelLower.includes('tirzepatide')
    ) {
      medicalNecessity.push(item);
    }
  }
  
  if (medicalNecessity.length > 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(
      'The following patient-reported information supports individualized treatment planning:'
    );
    doc.fillColor('#000000');
    doc.moveDown(0.4);
    
    for (const item of medicalNecessity) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      
      // Use full question text and highlight the answer
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#DC2626').text('Q: ', { continued: true });
      doc.font('Helvetica').fontSize(9).fillColor('#000000').text(label);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#059669').text('A: ', { continued: true });
      doc.font('Helvetica').fontSize(10).fillColor('#000000').text(value || 'Not provided');
      doc.moveDown(0.4);
    }
  } else {
    doc.font('Helvetica').fontSize(9).text('Standard treatment protocol applicable.');
  }
  doc.moveDown(0.8);

  // ========================================
  // SECTION 4: COMPLETE MEDICAL HISTORY
  // ========================================
  if (categorized.medicalHistory.length > 0) {
    sectionTitle(doc, 'III. Medical History');
    for (const item of categorized.medicalHistory) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      simpleField(doc, label, value);
    }
    doc.moveDown(0.8);
  }

  // ========================================
  // SECTION 5: GLP-1 MEDICATION HISTORY (Additional Details)
  // ========================================
  if (categorized.glp1Usage.length > 0) {
    sectionTitle(doc, 'V. GLP-1 Medication History (Additional Details)');
    for (const item of categorized.glp1Usage) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      simpleField(doc, label, value);
    }
    doc.moveDown(0.8);
  }

  // ========================================
  // SECTION 6: LIFESTYLE & HEALTH METRICS
  // ========================================
  if (categorized.lifestyle.length > 0) {
    sectionTitle(doc, 'VI. Lifestyle & Health Metrics');
    for (const item of categorized.lifestyle) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      simpleField(doc, label, value);
    }
    doc.moveDown(0.8);
  }

  // ========================================
  // SECTION 7: REFERRAL INFORMATION
  // ========================================
  if (categorized.referral.length > 0) {
    sectionTitle(doc, 'VII. Referral & Treatment Goals');
    for (const item of categorized.referral) {
      const label = toSafeText(item.label).trim();
      const value = toSafeText(item.value).trim();
      if (!label) continue;
      simpleField(doc, label, value);
    }
    doc.moveDown(0.8);
  }

  // ========================================
  // SECTION 8: CONSENT AGREEMENTS (CRITICAL FOR CHARGEBACKS)
  // ========================================
  sectionTitle(doc, 'VIII. Consent Agreements & Acknowledgments');
  
  doc.font('Helvetica').fontSize(9).fillColor('#DC2626')
    .text('The following consents were acknowledged and accepted by the patient:');
  doc.fillColor('#000000');
  doc.moveDown(0.4);

  if (input.consents) {
    if (input.consents.termsAndConditions) {
      doc.font('Helvetica-Bold').fontSize(10).text('✓ Terms and Conditions');
      doc.font('Helvetica').fontSize(9).text('Patient acknowledges reading and agreeing to the Terms of Use.');
      doc.moveDown(0.3);
    }
    if (input.consents.privacyPolicy) {
      doc.font('Helvetica-Bold').fontSize(10).text('✓ Privacy Policy');
      doc.font('Helvetica').fontSize(9).text('Patient acknowledges the Privacy Policy and data handling practices.');
      doc.moveDown(0.3);
    }
    if (input.consents.telehealthConsent) {
      doc.font('Helvetica-Bold').fontSize(10).text('✓ Informed Telemedicine Consent');
      doc.font('Helvetica').fontSize(9).text('Patient consents to receive medical care through telehealth services.');
      doc.moveDown(0.3);
    }
    if (input.consents.cancellationPolicy) {
      doc.font('Helvetica-Bold').fontSize(10).text('✓ Cancellation & Subscription Policy');
      doc.font('Helvetica').fontSize(9).text('Patient understands cancellation terms and recurring charges.');
      doc.moveDown(0.3);
    }
    if (input.consents.floridaWeightLoss && input.patient.state?.toUpperCase() === 'FL') {
      doc.font('Helvetica-Bold').fontSize(10).text('✓ Florida Weight Loss Consumer Bill of Rights');
      doc.font('Helvetica').fontSize(9).text('Patient acknowledges Florida-specific consumer protections.');
      doc.moveDown(0.3);
    }
    if (input.consents.floridaConsent && input.patient.state?.toUpperCase() === 'FL') {
      doc.font('Helvetica-Bold').fontSize(10).text('✓ Florida Consent');
      doc.font('Helvetica').fontSize(9).text('Patient acknowledges Florida telehealth consent requirements.');
      doc.moveDown(0.3);
    }
  }
  doc.moveDown(0.8);

  // ========================================
  // SECTION 9: ELECTRONIC SIGNATURE (CRITICAL FOR CHARGEBACKS)
  // ========================================
  ensureSpace(doc, 120);
  
  // Signature box
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const sigY = doc.y;
  
  doc
    .save()
    .strokeColor('#374151')
    .lineWidth(2)
    .rect(doc.page.margins.left, sigY, pageWidth, 110)
    .stroke()
    .restore();

  doc.y = sigY + 15;
  doc.font('Helvetica-Bold').fontSize(11).text('ELECTRONIC SIGNATURE');
  doc.moveDown(0.5);

  const patientName = `${toSafeText(input.patient.firstName)} ${toSafeText(input.patient.lastName)}`.trim();
  const signatureDate = formatIsoDate(input.submittedAtIso);

  doc.font('Helvetica').fontSize(9).text(
    `By electronically submitting this form, I, ${patientName || '[Patient Name]'}, ` +
    `certify that I am over 18 years of age and that all information provided is true and accurate to the best of my knowledge. ` +
    `I acknowledge that I have read, understood, and agree to all terms, policies, and consents referenced herein.`,
    { align: 'left' }
  );
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(9).text('E-Signed by: ', { continued: true });
  doc.font('Helvetica').text(patientName || 'Unknown');
  
  doc.font('Helvetica-Bold').fontSize(9).text('Date & Time: ', { continued: true });
  doc.font('Helvetica').text(signatureDate || 'Unknown');

  doc.font('Helvetica-Bold').fontSize(9).text('IP Address: ', { continued: true });
  doc.font('Helvetica').text(input.ipAddress || 'Not captured');

  doc.y = sigY + 115;
  doc.moveDown(0.5);

  // ========================================
  // FOOTER: CONFIDENTIALITY NOTICE
  // ========================================
  doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(
    'CONFIDENTIAL PATIENT INFORMATION - This document contains protected health information (PHI) ' +
    'and is intended solely for the use of EONMeds medical staff. Unauthorized access, use, or disclosure ' +
    'is strictly prohibited and may be unlawful.',
    { align: 'center' }
  );
  doc.fillColor('#000000');

  doc.end();
  return collectPdf(doc);
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await createDoc();

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
