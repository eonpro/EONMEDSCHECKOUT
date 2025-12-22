import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateIntakePdf } from './utils/pdf-generator.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[test-pdf] Generating test PDF...');
    
    const pdf = await generateIntakePdf({
      intakeId: 'TEST-123',
      submittedAtIso: new Date().toISOString(),
      ipAddress: '192.168.1.1',
      patient: {
        firstName: 'Test',
        lastName: 'Patient',
        email: 'test@test.com',
        phone: '8135551234',
        dateOfBirth: '1990-01-01',
        gender: 'Female',
        addressLine1: '123 Test St',
        addressLine2: 'Apt 100',
        city: 'Tampa',
        state: 'FL',
        zipCode: '33601',
        country: 'USA',
      },
      consents: {
        termsAndConditions: true,
        privacyPolicy: true,
        telehealthConsent: true,
      },
      answers: [
        { label: 'Have you taken GLP-1 before?', value: 'Yes' },
        { label: 'Do you have diabetes?', value: 'No' },
        { label: 'Blood pressure', value: '120/80' },
      ],
    });
    
    console.log(`[test-pdf] PDF generated: ${pdf.length} bytes`);
    
    // Return the PDF as a downloadable file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-intake.pdf"');
    res.setHeader('Content-Length', pdf.length.toString());
    
    return res.status(200).send(Buffer.from(pdf));
    
  } catch (error: any) {
    console.error('[test-pdf] Error:', error);
    return res.status(500).json({ 
      error: 'PDF generation failed', 
      message: error?.message,
      stack: error?.stack?.split('\n').slice(0, 10).join('\n'),
    });
  }
}
