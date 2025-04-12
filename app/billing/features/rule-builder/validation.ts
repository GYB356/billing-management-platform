import { BillingRuleTemplate, RuleCondition, RuleAction } from './templates';

interface ValidationError {
  field: string;
  message: string;
}

export function validateRule(rule: BillingRuleTemplate): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate basic rule properties
  if (!rule.name) {
    errors.push({ field: 'name', message: 'Rule name is required' });
  }
  if (!rule.description) {
    errors.push({ field: 'description', message: 'Rule description is required' });
  }

  // Validate conditions
  rule.template.conditions.forEach((condition, index) => {
    const conditionErrors = validateCondition(condition);
    conditionErrors.forEach((error) => {
      errors.push({
        field: `conditions[${index}].${error.field}`,
        message: error.message,
      });
    });
  });

  // Validate actions
  rule.template.actions.forEach((action, index) => {
    const actionErrors = validateAction(action);
    actionErrors.forEach((error) => {
      errors.push({
        field: `actions[${index}].${error.field}`,
        message: error.message,
      });
    });
  });

  // Validate rule-specific constraints
  const ruleTypeErrors = validateRuleType(rule);
  errors.push(...ruleTypeErrors);

  return errors;
}

function validateCondition(condition: RuleCondition): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!condition.field) {
    errors.push({ field: 'field', message: 'Field name is required' });
  }

  if (!condition.operator) {
    errors.push({ field: 'operator', message: 'Operator is required' });
  }

  if (condition.value === undefined || condition.value === null) {
    errors.push({ field: 'value', message: 'Value is required' });
  }

  // Validate operator-specific constraints
  switch (condition.operator) {
    case 'between':
      if (!Array.isArray(condition.value) || condition.value.length !== 2) {
        errors.push({
          field: 'value',
          message: 'Between operator requires an array of two values',
        });
      }
      break;

    case 'contains':
      if (typeof condition.value !== 'string' && !Array.isArray(condition.value)) {
        errors.push({
          field: 'value',
          message: 'Contains operator requires a string or array value',
        });
      }
      break;
  }

  return errors;
}

function validateAction(action: RuleAction): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!action.type) {
    errors.push({ field: 'type', message: 'Action type is required' });
  }

  if (!action.params || Object.keys(action.params).length === 0) {
    errors.push({ field: 'params', message: 'Action parameters are required' });
  }

  // Validate action-specific parameters
  switch (action.type) {
    case 'charge':
      if (!action.params.amount) {
        errors.push({
          field: 'params.amount',
          message: 'Charge amount is required',
        });
      }
      if (typeof action.params.amount !== 'number' || action.params.amount <= 0) {
        errors.push({
          field: 'params.amount',
          message: 'Charge amount must be a positive number',
        });
      }
      break;

    case 'discount':
      if (!action.params.type) {
        errors.push({
          field: 'params.type',
          message: 'Discount type (percentage/fixed) is required',
        });
      }
      if (!action.params.value) {
        errors.push({
          field: 'params.value',
          message: 'Discount value is required',
        });
      }
      if (
        action.params.type === 'percentage' &&
        (action.params.value <= 0 || action.params.value > 100)
      ) {
        errors.push({
          field: 'params.value',
          message: 'Percentage discount must be between 0 and 100',
        });
      }
      break;

    case 'notify':
      if (!action.params.message) {
        errors.push({
          field: 'params.message',
          message: 'Notification message is required',
        });
      }
      break;

    case 'limit':
      if (!action.params.threshold) {
        errors.push({
          field: 'params.threshold',
          message: 'Limit threshold is required',
        });
      }
      break;
  }

  return errors;
}

function validateRuleType(rule: BillingRuleTemplate): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (rule.template.type) {
    case 'usage_based':
      if (!rule.template.metadata.tiers) {
        errors.push({
          field: 'metadata.tiers',
          message: 'Usage-based pricing requires tier configuration',
        });
      }
      break;

    case 'subscription_tiered':
      if (!rule.template.metadata.features) {
        errors.push({
          field: 'metadata.features',
          message: 'Tiered subscription requires feature configuration',
        });
      }
      break;

    case 'metered_api':
      if (!rule.template.metadata.tiers) {
        errors.push({
          field: 'metadata.tiers',
          message: 'Metered API pricing requires tier configuration',
        });
      }
      break;
  }

  return errors;
} 