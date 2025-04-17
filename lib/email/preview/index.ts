import { EmailTemplate } from '../types';
import { emailTemplates } from '../templates';
import express from 'express';
import path from 'path';

const app = express();
const port = process.env.EMAIL_PREVIEW_PORT || 3001;

// Sample data for previews
const sampleData = {
  resetPassword: {
    resetUrl: 'https://example.com/reset/123456789'
  },
  subscriptionPaused: {
    planName: 'Pro Plan',
    pausedAt: new Date(),
    resumesAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    reason: 'Payment issue'
  },
  subscriptionResumed: {
    planName: 'Pro Plan',
    resumedAt: new Date()
  },
  paymentRetry: {
    amount: 99.99,
    currency: 'USD',
    retryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
  }
};

interface EmailClient {
  name: string;
  viewport: {
    width: number;
    height: number;
  };
  css: string;
  wrapper?: (html: string) => string;
}

// Add email client configurations
const emailClients: Record<string, EmailClient> = {
  gmail: {
    name: 'Gmail',
    viewport: { width: 1280, height: 800 },
    css: `
      .email-body { font-family: Arial, sans-serif; }
      .email-container { max-width: 640px; margin: 20px auto; border: 1px solid #ddd; }
    `
  },
  outlook: {
    name: 'Outlook',
    viewport: { width: 1024, height: 768 },
    css: `
      .email-body { font-family: 'Segoe UI', sans-serif; }
      .email-container { max-width: 600px; margin: 20px auto; border: 1px solid #ccc; }
    `,
    wrapper: (html: string) => `
      <!--[if mso]>
      <table role="presentation" width="100%"><tr><td>
      <![endif]-->
      ${html}
      <!--[if mso]>
      </td></tr></table>
      <![endif]-->
    `
  },
  apple: {
    name: 'Apple Mail',
    viewport: { width: 1440, height: 900 },
    css: `
      .email-body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      .email-container { max-width: 680px; margin: 20px auto; border: 1px solid #eee; }
    `
  }
};

// Generate preview HTML
function generatePreviewPage(templates: Record<string, EmailTemplate>) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Email Template Preview</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          :root {
            --bg-color: #ffffff;
            --text-color: #000000;
            --border-color: #cccccc;
            --button-bg: #f0f0f0;
            --button-hover: #e0e0e0;
          }

          [data-theme="dark"] {
            --bg-color: #1a1a1a;
            --text-color: #ffffff;
            --border-color: #404040;
            --button-bg: #2d2d2d;
            --button-hover: #3d3d3d;
          }

          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px;
            background-color: var(--bg-color);
            color: var(--text-color);
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .controls {
            display: flex;
            gap: 10px;
          }

          .template-list { 
            display: flex; 
            gap: 20px; 
            margin-bottom: 20px;
            flex-wrap: wrap;
          }

          .template-button {
            padding: 10px 20px;
            background: var(--button-bg);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            color: var(--text-color);
          }

          .template-button:hover { 
            background: var(--button-hover);
          }

          .preview-container {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
          }

          @media (min-width: 768px) {
            .preview-container {
              grid-template-columns: 1fr 1fr;
            }
          }

          .preview-section {
            border: 1px solid var(--border-color);
            padding: 20px;
            border-radius: 4px;
          }

          .preview-frame {
            width: 100%;
            height: 500px;
            border: none;
            background: white;
          }

          .preview-frame-mobile {
            width: 375px;
            height: 667px;
            margin: 20px auto;
            border: 10px solid #333;
            border-radius: 20px;
          }

          .editor {
            width: 100%;
            height: 200px;
            font-family: monospace;
            background: var(--bg-color);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            padding: 10px;
            margin-top: 10px;
          }

          .device-toggle {
            padding: 5px 10px;
            background: var(--button-bg);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            color: var(--text-color);
          }

          .theme-toggle {
            padding: 5px 10px;
            background: var(--button-bg);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            color: var(--text-color);
          }

          .client-selector {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
          }

          .client-button {
            padding: 5px 10px;
            background: var(--button-bg);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            color: var(--text-color);
          }

          .client-button.active {
            background: var(--button-hover);
            font-weight: bold;
          }

          .preview-toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
          }

          .preview-settings {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
          }

          .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 10px;
          }

          .setting-item {
            display: flex;
            align-items: center;
            gap: 5px;
          }

          .color-picker {
            width: 40px;
            height: 20px;
            padding: 0;
            border: 1px solid var(--border-color);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Email Template Preview</h1>
          <div class="controls">
            <button class="device-toggle" onclick="toggleDevice()">Toggle Mobile View</button>
            <button class="theme-toggle" onclick="toggleTheme()">Toggle Dark Mode</button>
          </div>
        </div>

        <div class="client-selector">
          ${Object.entries(emailClients).map(([id, client]) => `
            <button class="client-button" onclick="setEmailClient('${id}')" data-client="${id}">
              ${client.name}
            </button>
          `).join('')}
        </div>

        <div class="template-list">
          ${Object.keys(templates).map(name => `
            <button class="template-button" onclick="showTemplate('${name}')">${name}</button>
          `).join('')}
        </div>

        <div class="preview-container">
          ${Object.entries(templates).map(([name, template]) => `
            <div class="preview-section" id="${name}" style="display: none;">
              <h2>${name}</h2>
              
              <div class="preview-toolbar">
                <button onclick="toggleGrid()">Toggle Grid</button>
                <button onclick="toggleSpacing()">Toggle Spacing</button>
                <button onclick="validateTemplate()">Validate Template</button>
              </div>

              <h3>HTML Version</h3>
              <div class="preview-frame-container">
                <iframe class="preview-frame" srcdoc="${template.html.replace(/"/g, '&quot;')}"></iframe>
              </div>

              <div class="preview-settings">
                <h4>Preview Settings</h4>
                <div class="settings-grid">
                  <div class="setting-item">
                    <label>Background:</label>
                    <input type="color" class="color-picker" onchange="updateBackground(this.value)">
                  </div>
                  <div class="setting-item">
                    <label>Font Size:</label>
                    <input type="range" min="12" max="24" value="16" onchange="updateFontSize(this.value)">
                  </div>
                  <div class="setting-item">
                    <label>Width:</label>
                    <input type="number" min="320" max="1920" value="600" onchange="updateWidth(this.value)">
                  </div>
                </div>
              </div>

              <h3>Text Version</h3>
              <pre>${template.text}</pre>
              
              <h3>Live Editor</h3>
              <textarea class="editor" onchange="updatePreview('${name}', this.value)">${template.html.replace(/"/g, '&quot;')}</textarea>
            </div>
          `).join('')}
        </div>

        <script>
          let isMobileView = false;
          let isDarkMode = false;
          let currentClient = 'gmail';

          function showTemplate(name) {
            document.querySelectorAll('.preview-section').forEach(el => el.style.display = 'none');
            document.getElementById(name).style.display = 'block';
          }

          function toggleDevice() {
            isMobileView = !isMobileView;
            document.querySelectorAll('.preview-frame').forEach(frame => {
              frame.className = isMobileView ? 'preview-frame preview-frame-mobile' : 'preview-frame';
            });
          }

          function toggleTheme() {
            isDarkMode = !isDarkMode;
            document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
          }

          function updatePreview(name, html) {
            const frame = document.querySelector(\`#\${name} iframe\`);
            frame.srcdoc = html;
          }

          function setEmailClient(clientId) {
            currentClient = clientId;
            document.querySelectorAll('.client-button').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.client === clientId);
            });
            updateAllPreviews();
          }

          function updateAllPreviews() {
            document.querySelectorAll('.preview-frame').forEach(frame => {
              const html = frame.srcdoc;
              frame.srcdoc = applyClientStyles(html, currentClient);
            });
          }

          function applyClientStyles(html, clientId) {
            const client = ${JSON.stringify(emailClients)}[clientId];
            if (!client) return html;

            const styleTag = \`<style>\${client.css}</style>\`;
            const wrappedHtml = client.wrapper ? client.wrapper(html) : html;
            
            return wrappedHtml.replace('</head>', \`\${styleTag}</head>\`);
          }

          function toggleGrid() {
            const style = \`
              <style>
                * { outline: 1px solid rgba(255, 0, 0, 0.2); }
              </style>
            \`;
            const frame = document.querySelector('.preview-frame');
            frame.srcdoc = frame.srcdoc.includes('outline: 1px solid') 
              ? frame.srcdoc.replace(/<style>.*?<\/style>/s, '')
              : frame.srcdoc.replace('</head>', \`\${style}</head>\`);
          }

          function toggleSpacing() {
            const style = \`
              <style>
                * { margin: 2px; padding: 2px; }
              </style>
            \`;
            const frame = document.querySelector('.preview-frame');
            frame.srcdoc = frame.srcdoc.includes('margin: 2px')
              ? frame.srcdoc.replace(/<style>.*?<\/style>/s, '')
              : frame.srcdoc.replace('</head>', \`\${style}</head>\`);
          }

          function validateTemplate() {
            const frame = document.querySelector('.preview-frame');
            const html = frame.srcdoc;
            
            // Basic validation checks
            const issues = [];
            if (html.includes('<style>') && !html.includes('style="')) {
              issues.push('Warning: Non-inline styles detected');
            }
            if (!html.includes('<!--[if mso]>')) {
              issues.push('Warning: Missing Outlook conditional comments');
            }
            if (!html.includes('<meta name="viewport"')) {
              issues.push('Warning: Missing viewport meta tag');
            }
            
            alert(issues.length ? issues.join('\\n') : 'No issues found!');
          }

          function updateBackground(color) {
            const frame = document.querySelector('.preview-frame');
            frame.style.backgroundColor = color;
          }

          function updateFontSize(size) {
            const frame = document.querySelector('.preview-frame');
            const style = \`<style>body { font-size: \${size}px !important; }</style>\`;
            frame.srcdoc = frame.srcdoc.replace(/<style>.*?<\/style>/s, style);
          }

          function updateWidth(width) {
            const frame = document.querySelector('.preview-frame');
            frame.style.width = width + 'px';
          }

          // Show first template by default
          showTemplate('${Object.keys(templates)[0]}');
        </script>
      </body>
    </html>
  `;
}

// Generate all templates with sample data
const previewTemplates = {
  resetPassword: emailTemplates.resetPassword(sampleData.resetPassword.resetUrl),
  subscriptionPaused: emailTemplates.subscriptionPaused(sampleData.subscriptionPaused),
  subscriptionResumed: emailTemplates.subscriptionResumed(sampleData.subscriptionResumed),
  paymentRetry: emailTemplates.paymentRetry(sampleData.paymentRetry)
};

// Setup preview server
export function startPreviewServer() {
  app.get('/', (req, res) => {
    res.send(generatePreviewPage(previewTemplates));
  });

  app.listen(port, () => {
    console.log(`Email preview server running at http://localhost:${port}`);
  });
}

// For CLI usage
if (require.main === module) {
  startPreviewServer();
} 