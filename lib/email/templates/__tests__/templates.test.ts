import { emailTemplates } from '../index';

describe('Email Templates', () => {
  describe('resetPassword', () => {
    it('should generate correct reset password email', () => {
      const resetUrl = 'https://example.com/reset/123';
      const template = emailTemplates.resetPassword(resetUrl);

      expect(template.subject).toBe('Reset Your Password');
      expect(template.html).toContain(resetUrl);
      expect(template.text).toContain(resetUrl);
      expect(template.html).toContain('<!DOCTYPE html>');
      expect(template.html).toContain('This link will expire in 24 hours');
    });

    it('should handle special characters in reset URL', () => {
      const resetUrl = 'https://example.com/reset/123?token=abc&special=!@#$%^&*()';
      const template = emailTemplates.resetPassword(resetUrl);

      expect(template.html).toContain(resetUrl);
      expect(template.html).not.toContain('undefined');
      expect(template.html).not.toContain('[object Object]');
    });

    it('should handle very long reset URLs', () => {
      const resetUrl = 'https://example.com/reset/' + 'a'.repeat(500);
      const template = emailTemplates.resetPassword(resetUrl);

      expect(template.html).toContain(resetUrl);
      expect(template.text).toContain(resetUrl);
    });
  });

  describe('subscriptionPaused', () => {
    it('should generate correct subscription paused email with reason', () => {
      const params = {
        planName: 'Pro Plan',
        pausedAt: new Date('2024-01-01'),
        resumesAt: new Date('2024-02-01'),
        reason: 'Payment issue'
      };
      const template = emailTemplates.subscriptionPaused(params);

      expect(template.subject).toBe('Subscription Paused');
      expect(template.html).toContain(params.planName);
      expect(template.html).toContain(params.reason);
      expect(template.html).toContain(params.pausedAt.toLocaleDateString());
      expect(template.text).toContain('You will not be charged');
    });

    it('should handle HTML special characters in plan name and reason', () => {
      const params = {
        planName: 'Pro Plan & Special <Features>',
        pausedAt: new Date('2024-01-01'),
        resumesAt: new Date('2024-02-01'),
        reason: 'Payment issue & <script>alert("test")</script>'
      };
      const template = emailTemplates.subscriptionPaused(params);

      expect(template.html).not.toContain('<script>');
      expect(template.html).toContain('&lt;script&gt;');
      expect(template.html).toContain('&amp;');
    });

    it('should handle very long plan names and reasons', () => {
      const params = {
        planName: 'A'.repeat(100),
        pausedAt: new Date('2024-01-01'),
        resumesAt: new Date('2024-02-01'),
        reason: 'B'.repeat(500)
      };
      const template = emailTemplates.subscriptionPaused(params);

      expect(template.html).toContain(params.planName);
      expect(template.html).toContain(params.reason);
    });

    it('should handle invalid dates gracefully', () => {
      const params = {
        planName: 'Pro Plan',
        pausedAt: new Date('invalid'),
        resumesAt: new Date('invalid'),
        reason: 'Test'
      };
      const template = emailTemplates.subscriptionPaused(params);

      expect(template.html).not.toContain('Invalid Date');
      expect(template.text).not.toContain('Invalid Date');
    });
  });

  describe('paymentRetry', () => {
    it('should handle zero amount', () => {
      const params = {
        amount: 0,
        currency: 'USD',
        retryDate: new Date('2024-01-01')
      };
      const template = emailTemplates.paymentRetry(params);

      expect(template.html).toContain('0');
      expect(template.html).toContain('USD');
    });

    it('should handle large amounts and different currencies', () => {
      const params = {
        amount: 999999999.99,
        currency: '€',
        retryDate: new Date('2024-01-01')
      };
      const template = emailTemplates.paymentRetry(params);

      expect(template.html).toContain('999999999.99');
      expect(template.html).toContain('€');
    });

    it('should handle amounts with many decimal places', () => {
      const params = {
        amount: 99.99999,
        currency: 'USD',
        retryDate: new Date('2024-01-01')
      };
      const template = emailTemplates.paymentRetry(params);

      expect(template.html).toMatch(/\d+\.\d{2}/); // Should format to 2 decimal places
    });
  });

  describe('accessibility and security', () => {
    it('should include alt text for any images', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      const hasAltText = /<img[^>]+alt="[^"]*"/g.test(template.html);
      expect(hasAltText).toBe(true);
    });

    it('should not include sensitive information in templates', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).not.toContain('API_KEY');
      expect(template.html).not.toContain('SECRET');
      expect(template.html).not.toContain('PASSWORD');
    });

    it('should have proper email structure', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toContain('<!DOCTYPE html>');
      expect(template.html).toContain('<html');
      expect(template.html).toContain('</html>');
      expect(template.html).toContain('<body');
      expect(template.html).toContain('</body>');
    });
  });

  describe('internationalization and formatting', () => {
    it('should handle non-ASCII characters in content', () => {
      const params = {
        planName: '프리미엄 플랜 🌟',
        pausedAt: new Date('2024-01-01'),
        resumesAt: new Date('2024-02-01')
      };
      const template = emailTemplates.subscriptionPaused(params);

      expect(template.html).toContain('프리미엄 플랜');
      expect(template.html).toContain('🌟');
      expect(template.html).toMatch(/<meta charset="utf-8">/i);
    });

    it('should handle RTL text direction', () => {
      const params = {
        planName: 'خطة متميزة',
        pausedAt: new Date('2024-01-01'),
        resumesAt: new Date('2024-02-01')
      };
      const template = emailTemplates.subscriptionPaused(params);

      expect(template.html).toContain('dir="rtl"');
      expect(template.html).toContain('خطة متميزة');
    });

    it('should format currency amounts based on locale', () => {
      const params = {
        amount: 1234567.89,
        currency: 'EUR',
        retryDate: new Date('2024-01-01')
      };
      const template = emailTemplates.paymentRetry(params);

      expect(template.html).toMatch(/1[,.]234[,.]567[,.]89/); // Matches different locale formats
      expect(template.html).toContain('EUR');
    });
  });

  describe('email client compatibility', () => {
    it('should include MSO conditional comments for Outlook', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toMatch(/<!--\[if mso\]>/);
      expect(template.html).toMatch(/<!\[endif\]-->/);
    });

    it('should use table-based layout for better compatibility', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toMatch(/<table/);
      expect(template.html).toMatch(/<td/);
    });

    it('should include inline styles', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toMatch(/style="/);
      expect(template.html).not.toMatch(/<link.*stylesheet/);
    });
  });

  describe('security and validation', () => {
    it('should sanitize URLs in content', () => {
      const maliciousUrl = 'javascript:alert("xss")';
      const template = emailTemplates.resetPassword(maliciousUrl);
      
      expect(template.html).not.toContain('javascript:');
      expect(template.text).not.toContain('javascript:');
    });

    it('should handle null or undefined values gracefully', () => {
      const params = {
        planName: undefined,
        pausedAt: null,
        resumesAt: new Date('2024-02-01')
      };
      // @ts-ignore - Testing invalid input
      const template = emailTemplates.subscriptionPaused(params);

      expect(template.html).not.toContain('undefined');
      expect(template.html).not.toContain('null');
    });

    it('should validate URLs in content', () => {
      const invalidUrl = 'not-a-url';
      const template = emailTemplates.resetPassword(invalidUrl);
      
      expect(template.html).not.toContain('href="not-a-url"');
    });
  });

  describe('accessibility and usability', () => {
    it('should include aria labels for interactive elements', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toMatch(/aria-label=/);
    });

    it('should maintain sufficient color contrast', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toMatch(/color:#[0-9A-F]{6}/i);
      // Add specific color contrast checks based on your design system
    });

    it('should provide text alternatives for buttons', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.text).toContain('Click here:');
      expect(template.text).toContain('https://example.com');
    });
  });

  describe('responsive design', () => {
    it('should include responsive meta tags', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toMatch(/<meta name="viewport"/);
    });

    it('should use responsive image attributes', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toMatch(/max-width:\s*100%/);
      expect(template.html).toMatch(/width="\d+"/);
    });

    it('should include media queries for mobile devices', () => {
      const template = emailTemplates.resetPassword('https://example.com');
      expect(template.html).toMatch(/@media.*max-width/);
    });
  });
}); 