'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { InvoiceTemplateOptions } from '@/lib/invoice-templates';
import { toast } from '@/components/ui/use-toast';
import { ColorPicker } from '@/components/ui/color-picker';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageUpload } from '@/components/ui/image-upload';

interface InvoiceTemplateFormProps {
  invoiceId: string;
  organization: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
  };
  defaultOptions: InvoiceTemplateOptions;
}

export function InvoiceTemplateForm({
  invoiceId,
  organization,
  defaultOptions,
}: InvoiceTemplateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<InvoiceTemplateOptions>({
    ...defaultOptions,
    branding: {
      primaryColor: '#000000',
      secondaryColor: '#666666',
      accentColor: '#0066cc',
      fontFamily: 'Helvetica',
      fontSize: 10,
      headerStyle: 'standard',
      customHeader: {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 20,
      },
      customFooter: {
        backgroundColor: '#f9fafb',
        textColor: '#6b7280',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 20,
      },
      watermark: {
        enabled: false,
        text: 'DRAFT',
        opacity: 0.1,
        rotation: -45,
        color: '#000000',
      },
      pageBackground: {
        color: '#ffffff',
        opacity: 1,
      },
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error('Failed to generate invoice');
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      window.URL.revokeObjectURL(url);

      toast.success('Invoice generated successfully');
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Failed to generate invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    field: keyof InvoiceTemplateOptions,
    value: any
  ) => {
    setOptions(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBrandingChange = (
    field: keyof typeof options.branding,
    value: any
  ) => {
    setOptions(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        [field]: value,
      },
    }));
  };

  const handleCustomHeaderChange = (
    field: keyof typeof options.branding.customHeader,
    value: any
  ) => {
    setOptions(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        customHeader: {
          ...prev.branding?.customHeader,
          [field]: value,
        },
      },
    }));
  };

  const handleCustomFooterChange = (
    field: keyof typeof options.branding.customFooter,
    value: any
  ) => {
    setOptions(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        customFooter: {
          ...prev.branding?.customFooter,
          [field]: value,
        },
      },
    }));
  };

  const handleWatermarkChange = (
    field: keyof typeof options.branding.watermark,
    value: any
  ) => {
    setOptions(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        watermark: {
          ...prev.branding?.watermark,
          [field]: value,
        },
      },
    }));
  };

  const handlePageBackgroundChange = (
    field: keyof typeof options.branding.pageBackground,
    value: any
  ) => {
    setOptions(prev => ({
      ...prev,
      branding: {
        ...prev.branding,
        pageBackground: {
          ...prev.branding?.pageBackground,
          [field]: value,
        },
      },
    }));
  };

  const handleCompanyDetailsChange = (
    field: keyof typeof options.companyDetails,
    value: string
  ) => {
    setOptions(prev => ({
      ...prev,
      companyDetails: {
        ...prev.companyDetails,
        [field]: value,
      },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="company" className="w-full">
        <TabsList>
          <TabsTrigger value="company">Company Details</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="display">Display Options</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Company Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={options.companyDetails?.name || ''}
                  onChange={(e) => handleCompanyDetailsChange('name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="companyEmail">Company Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={options.companyDetails?.email || ''}
                  onChange={(e) => handleCompanyDetailsChange('email', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="companyPhone">Company Phone</Label>
                <Input
                  id="companyPhone"
                  value={options.companyDetails?.phone || ''}
                  onChange={(e) => handleCompanyDetailsChange('phone', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="companyWebsite">Company Website</Label>
                <Input
                  id="companyWebsite"
                  value={options.companyDetails?.website || ''}
                  onChange={(e) => handleCompanyDetailsChange('website', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="companyAddress">Company Address</Label>
                <Textarea
                  id="companyAddress"
                  value={options.companyDetails?.address || ''}
                  onChange={(e) => handleCompanyDetailsChange('address', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="companyTaxId">Tax ID</Label>
                <Input
                  id="companyTaxId"
                  value={options.companyDetails?.taxId || ''}
                  onChange={(e) => handleCompanyDetailsChange('taxId', e.target.value)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="branding">
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Colors</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Primary Color</Label>
                  <ColorPicker
                    value={options.branding?.primaryColor}
                    onChange={(color) => handleBrandingChange('primaryColor', color)}
                  />
                </div>
                <div>
                  <Label>Secondary Color</Label>
                  <ColorPicker
                    value={options.branding?.secondaryColor}
                    onChange={(color) => handleBrandingChange('secondaryColor', color)}
                  />
                </div>
                <div>
                  <Label>Accent Color</Label>
                  <ColorPicker
                    value={options.branding?.accentColor}
                    onChange={(color) => handleBrandingChange('accentColor', color)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Typography</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Font Family</Label>
                  <Select
                    value={options.branding?.fontFamily}
                    onValueChange={(value) => handleBrandingChange('fontFamily', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select font" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Font Size</Label>
                  <Slider
                    value={[options.branding?.fontSize || 10]}
                    min={8}
                    max={16}
                    step={1}
                    onValueChange={([value]) => handleBrandingChange('fontSize', value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Header Style</h2>
              <Select
                value={options.branding?.headerStyle}
                onValueChange={(value) => handleBrandingChange('headerStyle', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select header style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {options.branding?.headerStyle === 'custom' && (
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Custom Header Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Background Color</Label>
                      <ColorPicker
                        value={options.branding.customHeader?.backgroundColor}
                        onChange={(color) => handleCustomHeaderChange('backgroundColor', color)}
                      />
                    </div>
                    <div>
                      <Label>Text Color</Label>
                      <ColorPicker
                        value={options.branding.customHeader?.textColor}
                        onChange={(color) => handleCustomHeaderChange('textColor', color)}
                      />
                    </div>
                    <div>
                      <Label>Border Color</Label>
                      <ColorPicker
                        value={options.branding.customHeader?.borderColor}
                        onChange={(color) => handleCustomHeaderChange('borderColor', color)}
                      />
                    </div>
                    <div>
                      <Label>Border Width</Label>
                      <Slider
                        value={[options.branding.customHeader?.borderWidth || 1]}
                        min={0}
                        max={5}
                        step={0.5}
                        onValueChange={([value]) => handleCustomHeaderChange('borderWidth', value)}
                      />
                    </div>
                    <div>
                      <Label>Padding</Label>
                      <Slider
                        value={[options.branding.customHeader?.padding || 20]}
                        min={0}
                        max={50}
                        step={5}
                        onValueChange={([value]) => handleCustomHeaderChange('padding', value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Watermark</h2>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={options.branding?.watermark?.enabled}
                  onCheckedChange={(checked) => handleWatermarkChange('enabled', checked)}
                />
                <Label>Enable Watermark</Label>
              </div>

              {options.branding?.watermark?.enabled && (
                <div className="space-y-4">
                  <div>
                    <Label>Watermark Text</Label>
                    <Input
                      value={options.branding.watermark?.text}
                      onChange={(e) => handleWatermarkChange('text', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Opacity</Label>
                    <Slider
                      value={[options.branding.watermark?.opacity || 0.1]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={([value]) => handleWatermarkChange('opacity', value)}
                    />
                  </div>
                  <div>
                    <Label>Rotation (degrees)</Label>
                    <Slider
                      value={[options.branding.watermark?.rotation || -45]}
                      min={-90}
                      max={90}
                      step={5}
                      onValueChange={([value]) => handleWatermarkChange('rotation', value)}
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <ColorPicker
                      value={options.branding.watermark?.color}
                      onChange={(color) => handleWatermarkChange('color', color)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Page Background</h2>
              <div>
                <Label>Background Color</Label>
                <ColorPicker
                  value={options.branding.pageBackground?.color}
                  onChange={(color) => handlePageBackgroundChange('color', color)}
                />
              </div>
              <div>
                <Label>Background Image</Label>
                <ImageUpload
                  value={options.branding.pageBackground?.image}
                  onChange={(image) => handlePageBackgroundChange('image', image)}
                />
              </div>
              <div>
                <Label>Background Opacity</Label>
                <Slider
                  value={[options.branding.pageBackground?.opacity || 1]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={([value]) => handlePageBackgroundChange('opacity', value)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="display">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Display Options</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="showTaxDetails">Show Tax Details</Label>
                <Switch
                  id="showTaxDetails"
                  checked={options.showTaxDetails}
                  onCheckedChange={(checked) => handleChange('showTaxDetails', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showTaxBreakdown">Show Tax Breakdown</Label>
                <Switch
                  id="showTaxBreakdown"
                  checked={options.showTaxBreakdown}
                  onCheckedChange={(checked) => handleChange('showTaxBreakdown', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showExchangeRate">Show Exchange Rate</Label>
                <Switch
                  id="showExchangeRate"
                  checked={options.showExchangeRate}
                  onCheckedChange={(checked) => handleChange('showExchangeRate', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showPaymentInstructions">Show Payment Instructions</Label>
                <Switch
                  id="showPaymentInstructions"
                  checked={options.showPaymentInstructions}
                  onCheckedChange={(checked) => handleChange('showPaymentInstructions', checked)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payment">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Payment Instructions</h2>
            <div>
              <Label htmlFor="paymentInstructions">Instructions Text</Label>
              <Textarea
                id="paymentInstructions"
                value={options.paymentInstructions || ''}
                onChange={(e) => handleChange('paymentInstructions', e.target.value)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Invoice'}
        </Button>
      </div>
    </form>
  );
} 