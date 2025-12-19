import { useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';

interface ThankYouPageProps {
  paymentIntentId: string;
  language: 'en' | 'es';
  medication?: string;
  plan?: string;
  planPrice?: number;
  addons?: string[];
  expeditedShipping: boolean;
  total: number;
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
}

export function ThankYouPage({
  paymentIntentId,
  language,
  medication,
  plan,
  planPrice: planPriceProp,
  addons = [],
  expeditedShipping,
  total,
  shippingAddress,
}: ThankYouPageProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get addon prices
  const getAddonPrice = (addon: string) => {
    if (addon.toLowerCase().includes('nausea')) return 39.00;
    if (addon.toLowerCase().includes('fat')) return 99.00;
    return 0;
  };

  const actualShippingCost = expeditedShipping ? 25.00 : 0;
  const addonsTotal = addons.reduce((sum, addon) => sum + getAddonPrice(addon), 0);
  const fallbackPlanPrice = Math.max(0, total - actualShippingCost - addonsTotal);
  const planPrice =
    typeof planPriceProp === 'number' && planPriceProp > 0 ? planPriceProp : fallbackPlanPrice;

  // Shipping time based on selection
  const shippingTime = expeditedShipping
    ? (language === 'es' ? '3-5 días hábiles' : '3-5 business days')
    : (language === 'es' ? '5-7 días hábiles' : '5-7 business days');

  const t = language === 'es' ? {
    title: '¡Gracias por su pedido!',
    transactionId: 'ID de Transacción:',
    providerReview: 'Su información será compartida con un proveedor médico con licencia en su estado para determinar si califica para el tratamiento.',
    treatmentSelected: 'Tratamiento Seleccionado:',
    compoundedSemaglutide: 'Semaglutida Compuesta',
    compoundedTirzepatide: 'Tirzepatida Compuesta',
    medicationDesc: 'Inyección GLP-1 semanal personalizada para el control del peso',
    tirzepatideDesc: 'Inyección dual GLP-1/GIP para resultados superiores',
    plan: 'Plan',
    monthPackage: 'Paquete de meses',
    addOns: 'Complementos:',
    nauseaRelief: 'Prescripción para Alivio de Náuseas',
    nauseaDesc: 'Medicamento recetado para manejar los efectos secundarios de GLP-1',
    fatBurner: 'Quemador de Grasa (L-Carnitina + Complejo B)',
    fatBurnerDesc: 'Aumenta el metabolismo y la energía durante la pérdida de peso',
    shipping: 'Envío:',
    expedited: 'Expedito (3-5 días hábiles)',
    standard: 'Estándar (5-7 días hábiles)',
    freeShipping: 'Envío gratuito',
    totalPaid: 'Total Pagado',
    shippingAddress: 'Dirección de Envío:',
    whatsNext: '¿Qué sigue?',
    step1: 'Un médico revisará su información y aprobará su prescripción.',
    step2: 'Recibirá un correo de confirmación con los detalles de su pedido.',
    step3: `Su medicamento será enviado dentro de ${shippingTime}.`,
    step4: 'Recibirá información de seguimiento una vez que la farmacia dispense su tratamiento.',
    questions: '¿Preguntas? Contáctenos en',
    orCall: 'o llame al',
    downloadReceipt: 'Descargar Recibo',
  } : {
    title: 'Thank you for your order!',
    transactionId: 'Transaction ID:',
    providerReview: 'Your information will be shared with licensed medical provider in your state to determine if you qualify for treatment.',
    treatmentSelected: 'Treatment Selected:',
    compoundedSemaglutide: 'Compounded Semaglutide',
    compoundedTirzepatide: 'Compounded Tirzepatide',
    medicationDesc: 'Personalized weekly GLP-1 injection for weight management',
    tirzepatideDesc: 'Dual-action GLP-1/GIP injection for superior results',
    plan: 'Plan',
    monthPackage: 'month Package',
    addOns: 'Add ons:',
    nauseaRelief: 'Nausea Relief Prescription',
    nauseaDesc: 'Prescription medication to manage GLP-1 side effects',
    fatBurner: 'Fat Burner (L-Carnitine + B Complex)',
    fatBurnerDesc: 'Boost metabolism and energy during weight loss',
    shipping: 'Shipping:',
    expedited: 'Expedited (3-5 business days)',
    standard: 'Standard (5-7 business days)',
    freeShipping: 'Free shipping',
    totalPaid: 'Total Paid',
    shippingAddress: 'Shipping Address:',
    whatsNext: "What's Next?",
    step1: 'A physician will review your information and approve your prescription.',
    step2: 'You will receive a confirmation email with your order details.',
    step3: `Your medication will be shipped within ${shippingTime}.`,
    step4: 'You will receive tracking information once the pharmacy dispensed your treatment.',
    questions: 'Questions? Contact us at',
    orCall: 'or call',
    downloadReceipt: 'Download Receipt',
  };

  // Determine which medication is selected
  const isTirzepatide = medication?.toLowerCase().includes('tirzepatide');
  const medicationName = isTirzepatide ? t.compoundedTirzepatide : t.compoundedSemaglutide;
  const medicationDescription = isTirzepatide ? t.tirzepatideDesc : t.medicationDesc;
  const accentColor = isTirzepatide ? '#ff6f00' : '#ffd24e';

  // Format plan name
  const formatPlanName = () => {
    if (plan?.toLowerCase().includes('3') || plan?.toLowerCase().includes('three')) return `3 ${t.monthPackage}`;
    if (plan?.toLowerCase().includes('6') || plan?.toLowerCase().includes('six')) return `6 ${t.monthPackage}`;
    if (plan?.toLowerCase().includes('one')) return language === 'es' ? 'Compra Única' : 'One-time Purchase';
    return language === 'es' ? 'Recurrencia Mensual' : 'Monthly Recurring';
  };

  const handleDownload = async () => {
    if (receiptRef.current) {
      try {
        // Clone the element to avoid modifying the original
        const element = receiptRef.current;
        
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: element.scrollWidth,
          height: element.scrollHeight,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          // Ensure images load properly
          imageTimeout: 15000,
          onclone: (clonedDoc) => {
            // Force any lazy-loaded images to display
            const clonedElement = clonedDoc.querySelector('[data-receipt]');
            if (clonedElement) {
              (clonedElement as HTMLElement).style.width = `${element.scrollWidth}px`;
            }
          },
        });
        
        const link = document.createElement('a');
        link.download = `eonmeds-receipt-${paymentIntentId}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      } catch (error) {
        console.error('Error generating receipt image:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div 
          ref={receiptRef} 
          data-receipt="true"
          className="bg-white rounded-lg overflow-hidden shadow-lg"
          style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}
        >
          {/* Header Section */}
          <div className="px-6 py-8 text-center" style={{ backgroundColor: accentColor, width: '100%' }}>
            <h1 className="text-2xl font-bold mb-2">{t.title}</h1>
            <p className="text-sm font-medium mb-4">
              {t.transactionId} {paymentIntentId}
            </p>
            <p className="text-sm text-gray-800 mb-6 max-w-md mx-auto">
              {t.providerReview}
            </p>
            
            {/* Medication Vial Image */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
              <img 
                src={isTirzepatide 
                  ? "https://static.wixstatic.com/media/c49a9b_00c1ff5076814c8e93e3c53a132b962e~mv2.png"
                  : "https://static.wixstatic.com/media/c49a9b_4da809344f204a088d1d4708b4c1609b~mv2.webp"
                }
                alt={medicationName}
                style={{ maxWidth: '140px', maxHeight: '140px', width: 'auto', height: 'auto', objectFit: 'contain' }}
                crossOrigin="anonymous"
              />
            </div>
            
            <div style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
              <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>{t.treatmentSelected}</p>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>{medicationName}</h2>
              <p style={{ fontSize: '14px', color: '#1f2937' }}>{medicationDescription}</p>
            </div>
          </div>

          {/* Order Details Section */}
          <div className="p-6" style={{ padding: '24px' }}>
            {/* Plan Section */}
            <div style={{ marginBottom: '16px' }}>
              <h3 className="text-sm font-semibold text-gray-700" style={{ marginBottom: '12px' }}>{t.plan}</h3>
              <div className="bg-gray-50 rounded-lg p-4" style={{ backgroundColor: '#f9fafb', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                  </div>
                  <span className="font-medium">{formatPlanName()}</span>
                </div>
                <span className="font-semibold">${planPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Add-ons Section */}
            {addons.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h3 className="text-sm font-semibold text-gray-700" style={{ marginBottom: '12px' }}>{t.addOns}</h3>
                <div>
                  {addons.map((addon, index) => {
                    const isNausea = addon.toLowerCase().includes('nausea');
                    const addonPrice = getAddonPrice(addon);
                    return (
                      <div key={index} style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: index < addons.length - 1 ? '12px' : '0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <img 
                              src={isNausea 
                                ? "https://static.wixstatic.com/media/c49a9b_6c1b30c9e184401cbc20788d869fccdf~mv2.png"
                                : "https://static.wixstatic.com/media/c49a9b_7cf96a7c6da041d2ae156b2f0436343d~mv2.png"
                              }
                              alt={addon}
                              style={{ width: '32px', height: '32px', objectFit: 'contain', marginTop: '4px' }}
                              crossOrigin="anonymous"
                            />
                            <div>
                              <p className="font-medium text-sm">
                                {isNausea ? t.nauseaRelief : t.fatBurner}
                              </p>
                              <p className="text-xs text-gray-600" style={{ marginTop: '4px' }}>
                                {isNausea ? t.nauseaDesc : t.fatBurnerDesc}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-sm">${addonPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shipping Section */}
            <div style={{ marginBottom: '16px' }}>
              <h3 className="text-sm font-semibold text-gray-700" style={{ marginBottom: '12px' }}>{t.shipping}</h3>
              <div className="bg-gray-50 rounded-lg p-4" style={{ backgroundColor: '#f9fafb', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '10px', height: '10px', backgroundColor: '#16a34a', borderRadius: '50%' }}></div>
                  </div>
                  <span className="font-medium text-sm">
                    {expeditedShipping ? t.expedited : t.standard}
                  </span>
                </div>
                <span className="font-semibold text-sm">
                  {expeditedShipping ? `$${actualShippingCost.toFixed(2)}` : t.freeShipping}
                </span>
              </div>
            </div>

            {/* Total Section */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-lg font-bold">{t.totalPaid}</span>
                <span className="text-2xl font-bold">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Shipping Address */}
            {shippingAddress && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                <h3 className="text-sm font-semibold text-gray-700" style={{ marginBottom: '8px' }}>{t.shippingAddress}</h3>
                <div className="text-sm text-gray-600">
                  <p>{shippingAddress.addressLine1}</p>
                  {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                  <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
                </div>
              </div>
            )}
          </div>

          {/* What's Next Section */}
          <div className="mx-6 mb-6 rounded-lg p-6" style={{ backgroundColor: accentColor, width: 'calc(100% - 48px)' }}>
            <h3 className="font-bold text-lg mb-4" style={{ marginBottom: '16px' }}>{t.whatsNext}</h3>
            <ul className="text-sm" style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li style={{ marginBottom: '8px' }}>{t.step1}</li>
              <li style={{ marginBottom: '8px' }}>{t.step2}</li>
              <li style={{ marginBottom: '8px' }}>{t.step3}</li>
              <li style={{ marginBottom: '0' }}>{t.step4}</li>
            </ul>
          </div>

          {/* Contact Section */}
          <div style={{ padding: '0 24px 24px 24px', textAlign: 'center', fontSize: '14px', color: '#4b5563' }}>
            <p>{t.questions}</p>
            <p>
              <a 
                href="mailto:support@eonmeds.com" 
                style={{ fontWeight: '600', color: '#111827' }}
              >
                support@eonmeds.com
              </a>
            </p>
            <p>
              {t.orCall}{' '}
              <a 
                href="tel:+18889206025" 
                style={{ fontWeight: '600', color: '#111827' }}
              >
                1-888-920-6025
              </a>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleDownload}
            className="w-full px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t.downloadReceipt}
          </button>
          
          <button
            onClick={() => window.location.href = 'https://eonmeds.com'}
            className="w-full px-6 py-3 bg-white text-black border-2 border-black rounded-full font-medium hover:bg-gray-100 transition-colors"
          >
            {language === 'es' ? 'Regresar al Sitio Web' : 'Return to Website'}
          </button>
        </div>
      </div>
    </div>
  );
}