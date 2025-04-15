import { PrismaClient } from '@prisma/client';

export interface TaxRate {
  id: string;
  countryCode: string;
  stateCode?: string;
  name: string;
  rate: number;
  isActive: boolean;
  isEU: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaxRateInput {
  countryCode: string;
  stateCode?: string;
  name: string;
  rate: number;
  isEU?: boolean;
}

export interface UpdateTaxRateInput {
  name?: string;
  rate?: number;
  isActive?: boolean;
}

export class TaxRateModel {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(data: CreateTaxRateInput): Promise<TaxRate> {
    return this.prisma.taxRate.create({
      data: {
        countryCode: data.countryCode,
        stateCode: data.stateCode,
        name: data.name,
        rate: data.rate,
        isEU: data.isEU || false,
        isActive: true
      }
    });
  }

  async findByCountryAndState(countryCode: string, stateCode?: string): Promise<TaxRate | null> {
    return this.prisma.taxRate.findFirst({
      where: {
        countryCode,
        stateCode: stateCode || null,
        isActive: true
      }
    });
  }

  async findByCountry(countryCode: string): Promise<TaxRate[]> {
    return this.prisma.taxRate.findMany({
      where: {
        countryCode,
        isActive: true
      }
    });
  }

  async update(id: string, data: UpdateTaxRateInput): Promise<TaxRate> {
    return this.prisma.taxRate.update({
      where: { id },
      data
    });
  }

  async deactivate(id: string): Promise<TaxRate> {
    return this.prisma.taxRate.update({
      where: { id },
      data: { isActive: false }
    });
  }

  async findEURates(): Promise<TaxRate[]> {
    return this.prisma.taxRate.findMany({
      where: {
        isEU: true,
        isActive: true
      }
    });
  }
} 