import { WebSocket } from 'ws'
import { prisma } from '../db'

export type NotificationChannel = 'email' | 'slack' | 'in-app'
export type NotificationPriority = 'low' | 'medium' | 'high'

export interface NotificationConfig {
  channels: NotificationChannel[]
  priority: NotificationPriority
  template: string
  data: Record<string, any>
}

export class NotificationManager {
  private webSocketClients: Map<string, WebSocket> = new Map()

  async sendNotification(userId: string, config: NotificationConfig): Promise<void> {
    // Store notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: config.template,
        priority: config.priority,
        data: config.data,
        status: 'PENDING'
      }
    })

    // Process each channel
    for (const channel of config.channels) {
      await this.processChannel(channel, notification)
    }

    // Update notification status
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT' }
    })
  }

  private async processChannel(channel: NotificationChannel, notification: any): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmail(notification)
        break
      case 'slack':
        await this.sendSlack(notification)
        break
      case 'in-app':
        await this.sendInApp(notification)
        break
    }
  }

  private async sendEmail(notification: any): Promise<void> {
    // Implement email sending logic
    console.log('Sending email notification:', notification)
  }

  private async sendSlack(notification: any): Promise<void> {
    // Implement Slack notification logic
    console.log('Sending Slack notification:', notification)
  }

  private async sendInApp(notification: any): Promise<void> {
    const wsClient = this.webSocketClients.get(notification.userId)
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(JSON.stringify(notification))
    }
  }

  // WebSocket connection management
  registerWebSocketClient(userId: string, ws: WebSocket): void {
    this.webSocketClients.set(userId, ws)

    ws.on('close', () => {
      this.webSocketClients.delete(userId)
    })
  }

  // User preference management
  async updateUserPreferences(userId: string, preferences: {
    channels: NotificationChannel[],
    types: string[]
  }): Promise<void> {
    await prisma.notificationPreferences.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences
      }
    })
  }

  async getUserPreferences(userId: string): Promise<any> {
    return await prisma.notificationPreferences.findUnique({
      where: { userId }
    })
  }
} 