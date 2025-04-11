export interface ReportTemplate {
  name: string;
  description: string;
  generate: (data: any) => Promise<any>;
  formatters: {
    [key: string]: (data: any) => any;
  };
}
