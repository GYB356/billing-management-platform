import prisma from '@/lib/prisma';
import { 
  CustomerType, 
  TaxRuleType, 
  TaxRule,
  TaxRuleFormData
} from '@/types/tax';
import { createEvent, EventType } from '@/lib/events';

interface TaxRuleCondition {
  type: 'AMOUNT_THRESHOLD' | 'DATE_RANGE' | 'CUSTOMER_TYPE';
  threshold?: number;
  startDate?: Date;
  endDate?: Date;
  customerTypes?: CustomerType[];
}

export class TaxRuleService {
  /**
   * Create a new tax rule
   */
  public async createTaxRule(params: TaxRuleFormData): Promise<TaxRule> {
    const {
      name,
      description,
      type,
      priority,
      conditions,
      modifier,
      override,
      countryCode,
      stateCode,
      isActive = true,
      organizationId
    } = params;

    // Validate rule configuration
    this.validateRuleConfiguration(params);

    const rule = await prisma.taxRule.create({
      data: {
        name,
        description,
        type,
        priority,
        conditions: conditions as any,
        modifier,
        override,
        countryCode,
        stateCode,
        isActive,
        organizationId
      }
    });

    await createEvent({
      eventType: EventType.TAX_RULE_CREATED,
      resourceType: 'TAX_RULE',
      resourceId: rule.id,
      metadata: {
        organizationId,
        ruleType: type,
        conditions: conditions
      }
    });

    return rule;
  }

  /**
   * Update an existing tax rule
   */
  public async updateTaxRule(
    ruleId: string,
    params: Partial<TaxRuleFormData>
  ): Promise<TaxRule> {
    const rule = await prisma.taxRule.findUnique({
      where: { id: ruleId }
    });

    if (!rule) {
      throw new Error('Tax rule not found');
    }

    // Validate updated configuration
    this.validateRuleConfiguration({ ...rule, ...params } as TaxRuleFormData);

    const updatedRule = await prisma.taxRule.update({
      where: { id: ruleId },
      data: {
        ...params,
        conditions: params.conditions as any
      }
    });

    await createEvent({
      eventType: EventType.TAX_RULE_UPDATED,
      resourceType: 'TAX_RULE',
      resourceId: ruleId,
      metadata: {
        changes: params
      }
    });

    return updatedRule;
  }

  /**
   * Get applicable rules for a transaction
   */
  public async getApplicableRules(params: {
    amount: number;
    countryCode: string;
    stateCode?: string;
    customerType: CustomerType;
    date?: Date;
  }): Promise<TaxRule[]> {
    const { amount, countryCode, stateCode, customerType, date = new Date() } = params;

    const rules = await prisma.taxRule.findMany({
      where: {
        countryCode,
        stateCode: stateCode || null,
        isActive: true
      },
      orderBy: {
        priority: 'desc'
      }
    });

    return rules.filter(rule => this.isRuleApplicable(rule, {
      amount,
      customerType,
      date
    }));
  }

  private validateRuleConfiguration(params: TaxRuleFormData): void {
    const errors: string[] = [];

    // Validate basic fields
    if (!params.name) {
      errors.push('Rule name is required');
    }

    if (params.priority < 0) {
      errors.push('Priority must be a positive number');
    }

    // Validate conditions
    if (!params.conditions || params.conditions.length === 0) {
      errors.push('At least one condition is required');
    } else {
      params.conditions.forEach(condition => {
        switch (condition.type) {
          case 'AMOUNT_THRESHOLD':
            if (typeof condition.threshold !== 'number' || condition.threshold < 0) {
              errors.push('Amount threshold must be a positive number');
            }
            break;
          case 'DATE_RANGE':
            if (condition.startDate && condition.endDate && condition.startDate > condition.endDate) {
              errors.push('Date range start must be before end');
            }
            break;
        }
      });
    }

    // Validate rule type specific requirements
    switch (params.type) {
      case 'MODIFIER':
        if (typeof params.modifier !== 'number') {
          errors.push('Modifier value is required for MODIFIER type rules');
        }
        break;
      case 'OVERRIDE':
        if (typeof params.override !== 'number' || params.override < 0 || params.override > 100) {
          errors.push('Override value must be between 0 and 100');
        }
        break;
    }

    if (errors.length > 0) {
      throw new Error(`Invalid tax rule configuration: ${errors.join(', ')}`);
    }
  }

  private isRuleApplicable(
    rule: TaxRule,
    params: {
      amount: number;
      customerType: CustomerType;
      date: Date;
    }
  ): boolean {
    const { amount, customerType, date } = params;

    for (const condition of rule.conditions as TaxRuleCondition[]) {
      switch (condition.type) {
        case 'AMOUNT_THRESHOLD':
          if (condition.threshold && amount < condition.threshold) {
            return false;
          }
          break;
        case 'DATE_RANGE':
          if (condition.startDate && new Date(condition.startDate) > date) {
            return false;
          }
          if (condition.endDate && new Date(condition.endDate) < date) {
            return false;
          }
          break;
        case 'CUSTOMER_TYPE':
          if (condition.customerTypes && !condition.customerTypes.includes(customerType)) {
            return false;
          }
          break;
      }
    }

    return true;
  }
}