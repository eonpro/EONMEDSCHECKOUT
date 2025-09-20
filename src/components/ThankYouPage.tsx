
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
  const t = language === 'es' ? {
    title: '¡Gracias por su pedido!',
    subtitle: 'Su pago ha sido procesado exitosamente.',
    orderDetails: 'Detalles del Pedido',
    transactionId: 'ID de Transacción:',
    medicationLabel: 'Medicamento:',
    planLabel: 'Plan:',
    addonsLabel: 'Extras:',
    shippingLabel: 'Envío:',
    expeditedText: 'Expedito (3-5 días)',
    standardText: 'Estándar (5-7 días)',
    totalPaid: 'Total Pagado:',
    shippingAddress: 'Dirección de Envío',
    whatsNext: '¿Qué sigue?',
    nextStep1: 'Recibirá un correo de confirmación con los detalles de su pedido.',
    nextStep2: 'Su medicamento será enviado dentro de 1-2 días hábiles.',
    nextStep3: 'Recibirá información de seguimiento cuando su pedido sea enviado.',
    nextStep4: 'Un médico revisará su información y aprobará su prescripción.',
    questions: '¿Preguntas? Contáctenos en',
    orCall: 'o llame al',
    returnHome: 'Volver al Inicio',
  } : {
    title: 'Thank You for Your Order!',
    subtitle: 'Your payment has been processed successfully.',
    orderDetails: 'Order Details',
    transactionId: 'Transaction ID:',
    medicationLabel: 'Medication:',
    planLabel: 'Plan:',
    addonsLabel: 'Add-ons:',
    shippingLabel: 'Shipping:',
    expeditedText: 'Expedited (3-5 days)',
    standardText: 'Standard (5-7 days)',
    totalPaid: 'Total Paid:',
    shippingAddress: 'Shipping Address',
    whatsNext: "What's Next?",
    nextStep1: 'You will receive a confirmation email with your order details.',
    nextStep2: 'Your medication will be shipped within 1-2 business days.',
    nextStep3: 'You will receive tracking information once your order ships.',
    nextStep4: 'A physician will review your information and approve your prescription.',
    questions: 'Questions? Contact us at',
    orCall: 'or call',
    returnHome: 'Return to Home',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://i.imgur.com/placeholder.png"
                alt="EON Meds Logo"
                className="h-10 w-auto"
              />
              <p className="text-sm text-gray-600">
                {language === 'es' ? 'Soluciones de Pérdida de Peso con GLP-1' : 'GLP-1 Weight Loss Solutions'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-xl p-8 shadow-lg">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Thank You Message */}
          <h1 className="text-3xl font-bold text-center mb-4">{t.title}</h1>
          <p className="text-gray-600 text-center mb-8">{t.subtitle}</p>

          {/* Order Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">{t.orderDetails}</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">{t.transactionId}</span>
                <span className="font-mono text-sm">{paymentIntentId}</span>
              </div>
              
              {medication && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t.medicationLabel}</span>
                  <span>{medication}</span>
                </div>
              )}
              
              {plan && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t.planLabel}</span>
                  <span>{plan}</span>
                </div>
              )}
              
              {addons.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t.addonsLabel}</span>
                  <span>{addons.join(', ')}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">{t.shippingLabel}</span>
                <span>{expeditedShipping ? t.expeditedText : t.standardText}</span>
              </div>
              
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between font-semibold text-lg">
                  <span>{t.totalPaid}</span>
                  <span>${total.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {shippingAddress?.addressLine1 && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">{t.shippingAddress}</h2>
              <div className="text-gray-600">
                <p>{shippingAddress.addressLine1}</p>
                {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}</p>
                <p>{shippingAddress.country || 'United States'}</p>
              </div>
            </div>
          )}

          {/* What's Next */}
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-900">{t.whatsNext}</h2>
            <ul className="space-y-2 text-blue-800">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>{t.nextStep1}</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>{t.nextStep2}</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>{t.nextStep3}</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>{t.nextStep4}</span>
              </li>
            </ul>
          </div>

          {/* Contact Support */}
          <div className="text-center text-gray-600">
            <p>{t.questions}</p>
            <p className="font-semibold">support@eonmeds.com</p>
            <p className="mt-2">{t.orCall} 1-888-EON-MEDS</p>
          </div>

          {/* Return to Home Button */}
          <div className="mt-8 text-center">
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-[#13a97b] text-white rounded-lg font-semibold hover:bg-[#0f8562] transition-colors"
            >
              {t.returnHome}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
