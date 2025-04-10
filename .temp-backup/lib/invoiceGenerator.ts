import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

export async function generateInvoice(data: any, language: string = 'en') {
  const templatePath = path.resolve(`./templates/${language}/invoiceTemplate.hbs`);
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);

  return template(data);
}
