import { useRef } from 'react';
import html2canvas from 'html2canvas';

interface ThankYouPageProps {
  paymentIntentId: string;
  language: 'en' | 'es';
  medication?: string;
  plan?: string;
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
  addons = [],
  expeditedShipping,
  total,
  shippingAddress,
}: ThankYouPageProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Calculate plan price based on plan type
  const getPlanPrice = () => {
    if (plan?.toLowerCase().includes('3') || plan?.toLowerCase().includes('three')) return 549.00;
    if (plan?.toLowerCase().includes('6') || plan?.toLowerCase().includes('six')) return 1038.00;
    if (plan?.toLowerCase().includes('one')) return 299.00;
    return 229.00; // Monthly
  };

  // Get addon prices
  const getAddonPrice = (addon: string) => {
    if (addon.toLowerCase().includes('nausea')) return 39.00;
    if (addon.toLowerCase().includes('fat')) return 99.00;
    return 0;
  };

  const planPrice = getPlanPrice();
  const actualShippingCost = expeditedShipping ? 25.00 : 0;

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
    getItFaster: 'Recíbelo más rápido',
    totalPaid: 'Total Pagado',
    shippingAddress: 'Dirección de Envío:',
    whatsNext: '¿Qué sigue?',
    step1: 'Recibirá un correo de confirmación con los detalles de su pedido.',
    step2: 'Su medicamento será enviado dentro de 1-2 días hábiles.',
    step3: 'Recibirá información de seguimiento cuando su pedido sea enviado.',
    step4: 'Un médico revisará su información y aprobará su prescripción.',
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
    getItFaster: 'Get it faster',
    totalPaid: 'Total Paid',
    shippingAddress: 'Shipping Address:',
    whatsNext: "What's Next?",
    step1: 'You will receive a confirmation email with your order details.',
    step2: 'Your medication will be shipped within 1-2 business days.',
    step3: 'You will receive tracking information once your order ships.',
    step4: 'A physician will review your information and approve your prescription.',
    questions: 'Questions? Contact us at',
    orCall: 'or call',
    downloadReceipt: 'Download Receipt',
  };

  // Determine which medication is selected
  const isTirzepatide = medication?.toLowerCase().includes('tirzepatide');
  const medicationName = isTirzepatide ? t.compoundedTirzepatide : t.compoundedSemaglutide;
  const medicationDescription = isTirzepatide ? t.tirzepatideDesc : t.medicationDesc;

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
        const canvas = await html2canvas(receiptRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
        });
        
        const link = document.createElement('a');
        link.download = `eonmeds-receipt-${paymentIntentId}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } catch (error) {
        console.error('Error generating receipt image:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div ref={receiptRef} className="bg-white rounded-lg overflow-hidden shadow-lg">
          {/* Yellow Header Section */}
          <div className="bg-[#ffd24e] px-6 py-8 text-center">
            <h1 className="text-2xl font-bold mb-2">{t.title}</h1>
            <p className="text-sm font-medium mb-4">
              {t.transactionId} {paymentIntentId}
            </p>
            <p className="text-sm text-gray-800 mb-6 max-w-md mx-auto">
              {t.providerReview}
            </p>
            
            {/* Medication Vial Image */}
            <div className="mb-6">
              <img 
                src={isTirzepatide 
                  ? "https://static.wixstatic.com/media/c49a9b_00c1ff5076814c8e93e3c53a132b962e~mv2.png"
                  : "https://static.wixstatic.com/media/c49a9b_4da809344f204a088d1d4708b4c1609b~mv2.webp"
                }
                alt={medicationName}
                className="w-32 h-32 mx-auto object-contain"
              />
            </div>
            
            <div className="text-left max-w-md mx-auto">
              <p className="text-sm font-medium mb-2">{t.treatmentSelected}</p>
              <h2 className="text-xl font-bold mb-1">{medicationName}</h2>
              <p className="text-sm text-gray-800">{medicationDescription}</p>
            </div>
          </div>

          {/* Order Details Section */}
          <div className="p-6 space-y-4">
            {/* Plan Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.plan}</h3>
              <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-[#ffd24e] rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold">✓</span>
                  </div>
                  <span className="font-medium">{formatPlanName()}</span>
                </div>
                <span className="font-semibold">${planPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Add-ons Section */}
            {addons.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.addOns}</h3>
                <div className="space-y-3">
                  {addons.map((addon, index) => {
                    const isNausea = addon.toLowerCase().includes('nausea');
                    const addonPrice = getAddonPrice(addon);
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <img 
                              src={isNausea 
                                ? "https://static.wixstatic.com/media/c49a9b_6c1b30c9e184401cbc20788d869fccdf~mv2.png"
                                : "https://static.wixstatic.com/media/c49a9b_7cf96a7c6da041d2ae156b2f0436343d~mv2.png"
                              }
                              alt={addon}
                              className="w-8 h-8 object-contain mt-1"
                            />
                            <div>
                              <p className="font-medium text-sm">
                                {isNausea ? t.nauseaRelief : t.fatBurner}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
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
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.shipping}</h3>
              <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={expeditedShipping}
                      readOnly
                      className="text-green-600"
                    />
                    <span className="font-medium text-sm">{t.expedited}</span>
                  </div>
                  <p className="text-xs text-gray-600 ml-6 mt-1">{t.getItFaster}</p>
                </div>
                <span className="font-semibold text-sm">${actualShippingCost.toFixed(2)}</span>
              </div>
            </div>

            {/* Total Section */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">{t.totalPaid}</span>
                <span className="text-2xl font-bold">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Shipping Address */}
            {shippingAddress && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t.shippingAddress}</h3>
                <div className="text-sm text-gray-600">
                  <p>{shippingAddress.addressLine1}</p>
                  {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                  <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
                </div>
              </div>
            )}
          </div>

          {/* What's Next Section */}
          <div className="bg-[#ffd24e] mx-6 mb-6 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-4">{t.whatsNext}</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>{t.step1}</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>{t.step2}</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>{t.step3}</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>{t.step4}</span>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div className="px-6 pb-6 text-center text-sm text-gray-600">
            <p>{t.questions}</p>
            <p className="font-semibold">support@eonmeds.com</p>
            <p>{t.orCall} 1-888-EON-MEDS</p>
          </div>
        </div>

        {/* Download Button */}
        <div className="mt-6 text-center">
          <button
            onClick={handleDownload}
            className="px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
          >
            📥 {t.downloadReceipt}
          </button>
        </div>
      </div>
    </div>
  );
}