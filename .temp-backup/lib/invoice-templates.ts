import { format } from 'date-fns';
import PDFDocument from 'pdfkit';
import { InvoiceData } from './invoice';
import { CurrencyService } from './currency';

export interface InvoiceTemplateOptions {
  logo?: Buffer;
  primaryColor?: string;
  secondaryColor?: string;
  font?: string;
  fontSize?: number;
  showTaxDetails?: boolean;
  showPaymentInstructions?: boolean;
  paymentInstructions?: string;
  footerText?: string;
  companyDetails?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
  };
  showExchangeRate?: boolean;
  showTaxBreakdown?: boolean;
  headerStyle?: 'standard' | 'modern' | 'minimal';
  dateFormat?: string;
  currencyOptions?: {
    showOriginalCurrency?: boolean;
    showConversionRate?: boolean;
    showInMultipleCurrencies?: boolean;
    displayCurrencies?: string[];
    primaryCurrency?: string;
    roundingMethod?: 'ceil' | 'floor' | 'round';
    showSymbol?: boolean;
    position?: 'prefix' | 'suffix';
  };
  theme?: 'light' | 'dark' | 'branded';
  customizableSections?: {
    showBankDetails?: boolean;
    bankDetails?: {
      bankName?: string;
      accountNumber?: string;
      routingNumber?: string;
      swift?: string;
      iban?: string;
    };
    showQRCode?: boolean;
    qrCodeData?: string;
    showTermsAndConditions?: boolean;
    termsAndConditions?: string;
  };
  digitalSignature?: {
    enabled: boolean;
    signature?: Buffer;
    name?: string;
    position?: string;
    date?: Date;
  };
  paymentMethods?: {
    creditCard?: boolean;
    bankTransfer?: boolean;
    paypal?: boolean;
    crypto?: boolean;
    other?: string[];
  };
  qrCodePayment?: {
    enabled: boolean;
    qrData?: string;
    instructions?: string;
  };
  pageSize?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  locale?: string;
  customFields?: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  branding?: {
    logo?: Buffer;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    fontSize?: number;
    headerStyle?: 'standard' | 'modern' | 'minimal' | 'custom';
    customHeader?: {
      backgroundColor?: string;
      textColor?: string;
      borderColor?: string;
      borderWidth?: number;
      padding?: number;
    };
    customFooter?: {
      backgroundColor?: string;
      textColor?: string;
      borderColor?: string;
      borderWidth?: number;
      padding?: number;
    };
    watermark?: {
      enabled: boolean;
      text?: string;
      opacity?: number;
      rotation?: number;
      color?: string;
    };
    pageBackground?: {
      color?: string;
      image?: Buffer;
      opacity?: number;
    };
  };
}

export class InvoiceTemplate {
  private doc: PDFKit.PDFDocument;
  private options: InvoiceTemplateOptions;
  private currentY: number = 0;

  constructor(options: InvoiceTemplateOptions = {}) {
    this.options = {
      primaryColor: '#000000',
      secondaryColor: '#666666',
      font: 'Helvetica',
      fontSize: 10,
      showTaxDetails: true,
      showPaymentInstructions: true,
      paymentInstructions: 'Please make payment to the bank account below:',
      footerText: 'Thank you for your business!',
      showExchangeRate: true,
      showTaxBreakdown: true,
      headerStyle: 'standard',
      dateFormat: 'MMM dd, yyyy',
      theme: 'light',
      customizableSections: {
        showBankDetails: false,
        showQRCode: false,
        showTermsAndConditions: true,
        termsAndConditions: 'Standard terms and conditions apply.'
      },
      pageSize: 'A4',
      orientation: 'portrait',
      currencyOptions: {
        showOriginalCurrency: true,
        showConversionRate: true,
        showInMultipleCurrencies: false,
        displayCurrencies: ['USD']
      },
      ...options
    };

    this.doc = new PDFDocument({
      size: this.options.pageSize || 'A4',
      layout: this.options.orientation || 'portrait',
      margin: 50,
      info: {
        Title: 'Invoice',
        Author: this.options.companyDetails?.name || 'Company Name'
      }
    });
  }

  async generate(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.doc.on('data', chunk => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);

      // Set default font and color
      this.doc.font(this.options.font || 'Helvetica');
      this.doc.fontSize(this.options.fontSize || 10);

      // Apply branding
      this.applyBranding();
      
      // Apply theme
      this.applyTheme();
      
      // Add header
      this.addHeader(data);

      // Add company details
      this.addCompanyDetails();

      // Add customer details
      this.addCustomerDetails(data);

      // Add invoice details
      this.addInvoiceDetails(data);

      // Add items table
      this.addItemsTable(data);

      // Add totals
      this.addTotals(data);

      // Add exchange rate information if available and enabled
      if (this.options.showExchangeRate && data.exchangeRate) {
        this.addExchangeRateInfo(data.exchangeRate);
      }

      // Add tax breakdown if enabled
      if (this.options.showTaxBreakdown) {
        this.addTaxBreakdown(data);
      }

      // Add multi-currency view if enabled
      if (this.options.currencyOptions?.showInMultipleCurrencies && 
          this.options.currencyOptions?.displayCurrencies?.length) {
        this.addMultiCurrencyView(data);
      }

      // Add payment instructions if enabled
      if (this.options.showPaymentInstructions) {
        this.addPaymentInstructions();
      }

      // Add bank details if enabled
      if (this.options.customizableSections?.showBankDetails) {
        this.addBankDetails();
      }

      // Add QR code if enabled
      if (this.options.customizableSections?.showQRCode && 
          this.options.customizableSections?.qrCodeData) {
        this.addQRCode();
      }

      // Add notes if any
      if (data.notes) {
        this.addNotes(data.notes);
      }

      // Add terms and conditions if enabled
      if (this.options.customizableSections?.showTermsAndConditions) {
        this.addTermsAndConditions();
      }

      // Add footer
      this.addFooter();

      this.doc.end();
    });
  }

  // Apply branding based on the selected option
  private applyBranding() {
    if (!this.options.branding) return;

    const { branding } = this.options;

    // Apply custom header styling
    if (branding.customHeader) {
      const { backgroundColor, textColor, borderColor, borderWidth, padding } = branding.customHeader;
      
      if (backgroundColor) {
        this.doc.rect(0, 0, this.doc.page.width, 100).fill(backgroundColor);
      }
      
      if (borderColor && borderWidth) {
        this.doc.strokeColor(borderColor);
        this.doc.lineWidth(borderWidth);
        this.doc.moveTo(0, 100).lineTo(this.doc.page.width, 100).stroke();
      }
      
      if (textColor) {
        this.doc.fillColor(textColor);
      }
      
      if (padding) {
        this.currentY += padding;
      }
    }

    // Apply custom footer styling
    if (branding.customFooter) {
      const { backgroundColor, textColor, borderColor, borderWidth, padding } = branding.customFooter;
      
      if (backgroundColor) {
        this.doc.rect(0, this.doc.page.height - 100, this.doc.page.width, 100).fill(backgroundColor);
      }
      
      if (borderColor && borderWidth) {
        this.doc.strokeColor(borderColor);
        this.doc.lineWidth(borderWidth);
        this.doc.moveTo(0, this.doc.page.height - 100)
          .lineTo(this.doc.page.width, this.doc.page.height - 100)
          .stroke();
      }
      
      if (textColor) {
        this.doc.fillColor(textColor);
      }
    }

    // Apply watermark if enabled
    if (branding.watermark?.enabled) {
      const { text, opacity, rotation, color } = branding.watermark;
      if (text) {
        this.doc.save();
        this.doc.translate(this.doc.page.width / 2, this.doc.page.height / 2);
        this.doc.rotate(rotation || -45);
        this.doc.opacity(opacity || 0.1);
        this.doc.fillColor(color || '#000000');
        this.doc.fontSize(60);
        this.doc.text(text, 0, 0, { align: 'center' });
        this.doc.restore();
      }
    }

    // Apply page background
    if (branding.pageBackground) {
      const { color, image, opacity } = branding.pageBackground;
      
      if (color) {
        this.doc.rect(0, 0, this.doc.page.width, this.doc.page.height).fill(color);
      }
      
      if (image) {
        this.doc.save();
        this.doc.opacity(opacity || 0.1);
        this.doc.image(image, 0, 0, {
          width: this.doc.page.width,
          height: this.doc.page.height,
          fit: [this.doc.page.width, this.doc.page.height]
        });
        this.doc.restore();
      }
    }
  }

  // Apply theme based on the selected option
  private applyTheme() {
    switch (this.options.theme) {
      case 'dark':
        this.doc.fillColor('#FFFFFF');
        this.doc.rect(0, 0, this.doc.page.width, this.doc.page.height).fill('#333333');
        this.options.primaryColor = '#FFFFFF';
        this.options.secondaryColor = '#CCCCCC';
        break;
      case 'branded':
        // Use the primary and secondary colors defined in options
        break;
      case 'light':
      default:
        // Default colors already set
        break;
    }
  }

  private addHeader(data: InvoiceData) {
    // Add logo if provided
    if (this.options.logo) {
      this.doc.image(this.options.logo, 50, 45, { width: 50 });
    }

    // Add invoice title
    this.doc
      .fontSize(20)
      .text('INVOICE', 110, 57);

    this.currentY = 120;
  }

  private addCompanyDetails() {
    if (!this.options.companyDetails) return;

    const { name, address, phone, email, website, taxId } = this.options.companyDetails;

    this.doc
      .fontSize(12)
      .text(name, 50, this.currentY);

    this.currentY += 15;

    if (address) {
      this.doc.text(address, 50, this.currentY);
      this.currentY += 15;
    }

    if (phone) {
      this.doc.text(`Phone: ${phone}`, 50, this.currentY);
      this.currentY += 15;
    }

    if (email) {
      this.doc.text(`Email: ${email}`, 50, this.currentY);
      this.currentY += 15;
    }

    if (website) {
      this.doc.text(`Website: ${website}`, 50, this.currentY);
      this.currentY += 15;
    }

    if (taxId) {
      this.doc.text(`Tax ID: ${taxId}`, 50, this.currentY);
      this.currentY += 15;
    }

    this.currentY += 20;
  }

  private addCustomerDetails(data: InvoiceData) {
    this.doc
      .fontSize(12)
      .text('Bill To:', 50, this.currentY);

    this.currentY += 15;

    this.doc
      .fontSize(10)
      .text(data.organization.name, 50, this.currentY);

    this.currentY += 15;

    if (data.organization.email) {
      this.doc.text(data.organization.email, 50, this.currentY);
      this.currentY += 15;
    }

    if (data.organization.address) {
      this.doc.text(data.organization.address, 50, this.currentY);
      this.currentY += 15;
    }

    if (data.organization.taxId) {
      this.doc.text(`Tax ID: ${data.organization.taxId}`, 50, this.currentY);
      this.currentY += 15;
    }

    this.currentY += 20;
  }

  private addInvoiceDetails(data: InvoiceData) {
    this.doc
      .fontSize(10)
      .text(`Invoice Number: ${data.invoiceNumber}`, 50, this.currentY)
      .text(`Date: ${format(data.date, 'PPP')}`, 50, this.currentY + 15)
      .text(`Due Date: ${format(data.dueDate, 'PPP')}`, 50, this.currentY + 30);

    this.currentY += 60;
  }

  private addItemsTable(data: InvoiceData) {
    // Table headers
    this.doc
      .fontSize(10)
      .text('Description', 50, this.currentY)
      .text('Quantity', 300, this.currentY)
      .text('Unit Price', 400, this.currentY)
      .text('Amount', 500, this.currentY);

    this.currentY += 20;

    // Table rows
    data.items.forEach(item => {
      this.doc
        .text(item.description, 50, this.currentY)
        .text(item.quantity.toString(), 300, this.currentY)
        .text(CurrencyService.formatCurrency(item.unitPrice, item.currency), 400, this.currentY)
        .text(CurrencyService.formatCurrency(item.amount, item.currency), 500, this.currentY);

      this.currentY += 20;
    });

    this.currentY += 20;
  }

  private addTotals(data: InvoiceData) {
    this.doc
      .text('Subtotal:', 400, this.currentY)
      .text(CurrencyService.formatCurrency(data.subtotal, data.currency), 500, this.currentY);

    this.currentY += 20;

    if (this.options.showTaxDetails) {
      this.doc
        .text(`Tax (${(data.taxRate * 100).toFixed(1)}%):`, 400, this.currentY)
        .text(CurrencyService.formatCurrency(data.taxAmount, data.currency), 500, this.currentY);

      this.currentY += 20;
    }

    this.doc
      .fontSize(12)
      .text('Total:', 400, this.currentY)
      .text(CurrencyService.formatCurrency(data.totalAmount, data.currency), 500, this.currentY);

    this.currentY += 40;
  }

  private addExchangeRateInfo(exchangeRate: any) {
    this.currentY += 15;
    this.doc.fontSize(9)
       .fillColor(this.options.secondaryColor || '#666666')
       .text('Exchange Rate Information:', 50, this.currentY);
    
    this.currentY += 15;
    this.doc.text(`Rate: 1 ${exchangeRate.from} = ${exchangeRate.rate} ${exchangeRate.to}`, 50, this.currentY);
    
    this.currentY += 15;
    this.doc.text(`Rate Date: ${format(new Date(exchangeRate.date), this.options.dateFormat || 'MMM dd, yyyy')}`, 50, this.currentY);
  }

  private addTaxBreakdown(data: InvoiceData) {
    this.doc
      .fontSize(10)
      .text('Tax Breakdown:', 50, this.currentY);

    this.currentY += 20;

    // Add tax rate details
    this.doc
      .text(`Tax Rate: ${(data.taxRate * 100).toFixed(1)}%`, 50, this.currentY)
      .text(`Tax Amount: ${CurrencyService.formatCurrency(data.taxAmount, data.currency)}`, 50, this.currentY + 15)
      .text(`Total Amount: ${CurrencyService.formatCurrency(data.totalAmount, data.currency)}`, 50, this.currentY + 30);

    this.currentY += 60;
  }

  private addMultiCurrencyView(data: InvoiceData) {
    if (!this.options.currencyOptions?.displayCurrencies?.length) return;

    this.currentY += 30;
    this.doc.fontSize(10)
       .fillColor(this.options.primaryColor || '#000000')
       .text('Amount in Other Currencies:', 50, this.currentY);
    
    this.currentY += 20;
    
    const currencies = this.options.currencyOptions.displayCurrencies;
    
    currencies.forEach((currency) => {
      if (currency === data.currency) return; // Skip base currency
      
      // In a real implementation, we would fetch actual conversion rates
      // This is a placeholder that would be replaced with actual converted values
      const conversionRate = 1.1; // Example rate
      const convertedAmount = data.totalAmount * conversionRate;
      
      this.doc.text(
        `${CurrencyService.formatCurrency(convertedAmount, currency)} (${currency})`, 
        50, 
        this.currentY
      );
      
      this.currentY += 15;
    });
  }

  private addPaymentInstructions() {
    this.doc
      .fontSize(10)
      .text(this.options.paymentInstructions || 'Please make payment to the bank account below:', 50, this.currentY);

    this.currentY += 20;
  }

  private addBankDetails() {
    if (!this.options.customizableSections?.bankDetails) return;

    const bankDetails = this.options.customizableSections.bankDetails;
    
    this.currentY += 30;
    this.doc.fontSize(10)
       .fillColor(this.options.primaryColor || '#000000')
       .text('Bank Details:', 50, this.currentY);
    
    this.currentY += 15;
    
    if (bankDetails.bankName) {
      this.doc.text(`Bank: ${bankDetails.bankName}`, 50, this.currentY);
      this.currentY += 15;
    }
    
    if (bankDetails.accountNumber) {
      this.doc.text(`Account Number: ${bankDetails.accountNumber}`, 50, this.currentY);
      this.currentY += 15;
    }
    
    if (bankDetails.routingNumber) {
      this.doc.text(`Routing Number: ${bankDetails.routingNumber}`, 50, this.currentY);
      this.currentY += 15;
    }
    
    if (bankDetails.swift) {
      this.doc.text(`SWIFT: ${bankDetails.swift}`, 50, this.currentY);
      this.currentY += 15;
    }
    
    if (bankDetails.iban) {
      this.doc.text(`IBAN: ${bankDetails.iban}`, 50, this.currentY);
      this.currentY += 15;
    }
  }

  private addQRCode() {
    if (!this.options.customizableSections?.qrCodeData) return;
    
    this.currentY += 30;
    this.doc.fontSize(10)
       .fillColor(this.options.primaryColor || '#000000')
       .text('Scan to Pay:', 50, this.currentY);
    
    this.currentY += 15;
    
    // In a real implementation, you would generate a QR code here
    // using a library like qrcode-generator or qrcode
    // For now, we'll just add a placeholder text
    this.doc.text('QR Code would be displayed here', 50, this.currentY);
  }

  private addTermsAndConditions() {
    const terms = this.options.customizableSections?.termsAndConditions || 
                 'Standard terms and conditions apply.';
    
    this.currentY += 30;
    this.doc.fontSize(9)
       .fillColor(this.options.secondaryColor || '#666666')
       .text('Terms and Conditions:', 50, this.currentY);
    
    this.currentY += 15;
    this.doc.text(terms, 50, this.currentY, { width: 500 });
  }

  private addNotes(notes: string) {
    this.doc
      .fontSize(10)
      .text('Notes:', 50, this.currentY)
      .text(notes, 50, this.currentY + 15);

    this.currentY += 40;
  }

  private addFooter() {
    const pageHeight = this.doc.page.height;
    const footerY = pageHeight - 100;

    this.doc
      .fontSize(10)
      .text(this.options.footerText || 'Thank you for your business!', 50, footerY, {
        align: 'center'
      });
  }
} 