export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailService {
  send(to: string, template: EmailTemplate): Promise<void>;
}

export interface EmailConfig {
  from: string;
  replyTo?: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
} 