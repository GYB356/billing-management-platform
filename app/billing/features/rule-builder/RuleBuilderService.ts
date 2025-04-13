import { prisma } from '@/lib/prisma';
import { 
  BillingRule, 
  BillingCondition, 
  BillingAction,
  RuleTemplate,
  BillingRuleType,
  ConditionOperator,
  ActionType
} from './types';

export class RuleBuilderService {
  async createRule(data: Omit<BillingRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<BillingRule> {
    const rule = await prisma.billingRule.create({
      data: {
        ...data,
        conditions: {
          create: data.conditions
        },
        actions: {
          create: data.actions
        }
      }
    });
    return rule;
  }

  async validateRule(rule: Partial<BillingRule>): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!rule.name) errors.push('Rule name is required');
    if (!rule.type) errors.push('Rule type is required');
    if (!rule.conditions?.length) errors.push('At least one condition is required');
    if (!rule.actions?.length) errors.push('At least one action is required');

    // Validate conditions
    rule.conditions?.forEach((condition, index) => {
      if (!condition.field) errors.push(`Condition ${index + 1}: Field is required`);
      if (!condition.operator) errors.push(`Condition ${index + 1}: Operator is required`);
      if (condition.value === undefined) errors.push(`Condition ${index + 1}: Value is required`);
    });

    // Validate actions
    rule.actions?.forEach((action, index) => {
      if (!action.type) errors.push(`Action ${index + 1}: Type is required`);
      if (!action.parameters) errors.push(`Action ${index + 1}: Parameters are required`);
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async applyTemplate(templateId: string, customizations: Partial<BillingRule> = {}): Promise<BillingRule> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const rule: Omit<BillingRule, 'id' | 'createdAt' | 'updatedAt'> = {
      name: customizations.name || template.name,
      description: customizations.description || template.description,
      type: customizations.type || template.type,
      conditions: customizations.conditions || template.defaultConditions as BillingCondition[],
      actions: customizations.actions || template.defaultActions as BillingAction[],
      priority: customizations.priority || 0,
      isActive: customizations.isActive ?? true
    };

    const validation = await this.validateRule(rule);
    if (!validation.isValid) {
      throw new Error(`Invalid rule: ${validation.errors.join(', ')}`);
    }

    return this.createRule(rule);
  }

  private async getTemplate(templateId: string): Promise<RuleTemplate | null> {
    // In a real implementation, this would fetch from a database
    // For now, return a mock template
    return {
      id: templateId,
      name: 'Basic Usage Billing',
      description: 'Charges based on resource usage',
      type: BillingRuleType.BANDWIDTH,
      defaultConditions: [
        {
          field: 'usage.bandwidth',
          operator: ConditionOperator.GREATER_THAN,
          value: 1000,
          type: 'NUMBER'
        }
      ],
      defaultActions: [
        {
          type: ActionType.APPLY_CHARGE,
          parameters: {
            amount: 0.1,
            currency: 'USD',
            per: 'GB'
          }
        }
      ]
    };
  }
}