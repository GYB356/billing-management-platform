'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Check, Edit, Plus, Search, Upload } from 'lucide-react';
import Link from 'next/link';

interface Translation {
  id: string;
  locale: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

interface TranslationImport {
  locale: string;
  translations: Record<string, any>;
}

export default function TranslationsPage() {
  const { t, availableLocales } = useI18n();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedLocale, setSelectedLocale] = useState('en-US');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState<Translation | null>(null);
  const [editedValue, setEditedValue] = useState('');
  const [importContent, setImportContent] = useState('');
  const [newTranslation, setNewTranslation] = useState({
    locale: 'en-US',
    key: '',
    value: '',
  });

  const fetchTranslations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/admin/translations?locale=${selectedLocale}&search=${searchQuery}&page=${currentPage}&limit=10`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch translations');
      }
      
      const data = await response.json();
      setTranslations(data.translations);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError('Failed to load translations. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTranslations();
  }, [selectedLocale, currentPage, searchQuery]);

  const handleEditTranslation = (translation: Translation) => {
    setCurrentTranslation(translation);
    setEditedValue(translation.value);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!currentTranslation) return;
    
    try {
      const response = await fetch('/api/admin/translations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentTranslation.id,
          value: editedValue,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update translation');
      }
      
      // Update the translation in the list
      setTranslations(
        translations.map(t => 
          t.id === currentTranslation.id ? { ...t, value: editedValue } : t
        )
      );
      
      setSuccess('Translation updated successfully');
      setIsEditDialogOpen(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update translation. Please try again.');
      console.error(err);
    }
  };

  const handleAddTranslation = async () => {
    try {
      const response = await fetch('/api/admin/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTranslation),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add translation');
      }
      
      setSuccess('Translation added successfully');
      setIsAddDialogOpen(false);
      fetchTranslations();
      
      // Reset form
      setNewTranslation({
        locale: 'en-US',
        key: '',
        value: '',
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to add translation. Please try again.');
      console.error(err);
    }
  };

  const handleImportTranslations = async () => {
    try {
      // Parse the JSON content
      const importData = JSON.parse(importContent) as TranslationImport;
      
      const response = await fetch('/api/admin/translations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to import translations');
      }
      
      const result = await response.json();
      setSuccess(result.message);
      setIsImportDialogOpen(false);
      
      // Refresh translations if the current locale matches the imported locale
      if (selectedLocale === importData.locale) {
        fetchTranslations();
      }
      
      // Clear import content
      setImportContent('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to import translations. Please check your JSON format.');
      console.error(err);
    }
  };

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Translation Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Translation
          </Button>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="locale-select">Language</Label>
            <Select 
              value={selectedLocale} 
              onValueChange={value => {
                setSelectedLocale(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger id="locale-select">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {availableLocales.map(locale => (
                  <SelectItem key={locale.code} value={locale.code}>
                    {locale.name} ({locale.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="search-input">Search</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <Input
                id="search-input"
                className="pl-9"
                placeholder="Search by key or value"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Translations for {selectedLocale}</CardTitle>
          <CardDescription>
            Manage translations for the selected language. Add, edit, or remove translation entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : translations.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Key</TableHead>
                      <TableHead className="w-1/2">Translation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {translations.map(translation => (
                      <TableRow key={translation.id}>
                        <TableCell className="font-mono text-sm">{translation.key}</TableCell>
                        <TableCell>{translation.value}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditTranslation(translation)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <p className="mb-4">No translations found.</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsAddDialogOpen(true)}
              >
                Add your first translation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Translation</DialogTitle>
          </DialogHeader>
          {currentTranslation && (
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="key" className="text-right">
                  Key
                </Label>
                <Input
                  id="key"
                  value={currentTranslation.key}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="translation" className="text-right">
                  Translation
                </Label>
                <Textarea
                  id="translation"
                  rows={3}
                  value={editedValue}
                  onChange={e => setEditedValue(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Translation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="add-locale">Language</Label>
              <Select 
                value={newTranslation.locale} 
                onValueChange={value => 
                  setNewTranslation(prev => ({ ...prev, locale: value }))
                }
              >
                <SelectTrigger id="add-locale">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {availableLocales.map(locale => (
                    <SelectItem key={locale.code} value={locale.code}>
                      {locale.name} ({locale.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="add-key">Key</Label>
              <Input
                id="add-key"
                value={newTranslation.key}
                onChange={e => 
                  setNewTranslation(prev => ({ ...prev, key: e.target.value }))
                }
                placeholder="e.g., common.save"
              />
            </div>
            <div>
              <Label htmlFor="add-value">Translation</Label>
              <Textarea
                id="add-value"
                value={newTranslation.value}
                onChange={e => 
                  setNewTranslation(prev => ({ ...prev, value: e.target.value }))
                }
                placeholder="Enter translation text"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddTranslation}
              disabled={!newTranslation.key || !newTranslation.value}
            >
              Add Translation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Translations</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-gray-500">
              Paste your JSON translation file below. The format should match the example:
            </p>
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs">
              {`{
  "locale": "en-US",
  "translations": {
    "common": {
      "save": "Save",
      "cancel": "Cancel"
    },
    "settings": {
      "title": "Settings"
    }
  }
}`}
            </pre>
            <Textarea
              rows={10}
              value={importContent}
              onChange={e => setImportContent(e.target.value)}
              placeholder="Paste your JSON here"
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportTranslations}
              disabled={!importContent}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Documentation Link */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium mb-2">Need help with translations?</h3>
        <p className="text-gray-600 mb-4">
          Check out our comprehensive documentation on implementing and managing translations in your application.
        </p>
        <Link href="/docs/internationalization" className="text-blue-600 hover:underline">
          View Internationalization Documentation →
        </Link>
      </div>
    </div>
  );
} 