export function render(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const value = key.trim().split('.').reduce((obj: any, k: string) => obj?.[k], data);
    return value !== undefined ? String(value) : '';
  });
} 