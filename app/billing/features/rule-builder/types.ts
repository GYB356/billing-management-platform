export interface BillingRule {
    id: string;
    name: string;
    description: string;
    type: BillingRuleType;
    conditions: BillingCondition[];
    actions: BillingAction[];
    priority: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export enum BillingRuleType {
    BANDWIDTH = 'BANDWIDTH',
    TIME_BASED = 'TIME_BASED',
    EVENT_BASED = 'EVENT_BASED',
    HYBRID = 'HYBRID'
  }
  
  export interface BillingCondition {
    id: string;
    field: string;
    operator: ConditionOperator;
    value: any;
    type: 'NUMBER' | 'STRING' | 'BOOLEAN' | 'DATE';
  }
  
  export enum ConditionOperator {
    EQUALS = 'EQUALS',
    NOT_EQUALS = 'NOT_EQUALS',
    GREATER_THAN = 'GREATER_THAN',
    LESS_THAN = 'LESS_THAN',
    CONTAINS = 'CONTAINS',
    NOT_CONTAINS = 'NOT_CONTAINS',
    BETWEEN = 'BETWEEN'
  }
  
  export interface BillingAction {
    id: string;
    type: ActionType;
    parameters: Record<string, any>;
  }
  
  export enum ActionType {
    APPLY_CHARGE = 'APPLY_CHARGE',
    APPLY_DISCOUNT = 'APPLY_DISCOUNT',
    SEND_NOTIFICATION = 'SEND_NOTIFICATION',
    UPDATE_SUBSCRIPTION = 'UPDATE_SUBSCRIPTION'
  }
  
  export interface RuleTemplate {
    id: string;
    name: string;
    description: string;
    type: BillingRuleType;
    defaultConditions: Partial<BillingCondition>[];
    defaultActions: Partial<BillingAction>[];
  }