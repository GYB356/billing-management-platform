import { prisma } from '../db'
import { sendEmail } from '../notifications/email'
import { sendSlackNotification } from '../notifications/slack'
import { PaymentStatus, RetryStrategy } from '@prisma/client'

export interface RetryConfig {
  intervals: number[] // intervals in hours
  maxAttempts: number
  notificationChannels: ('email' | 'slack' | 'in-app')[]
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  intervals: [1, 6, 24, 72], // Progressive delays in hours
  maxAttempts: 4,
  notificationChannels: ['email', 'slack']
}

export class DunningManager {
  private config: RetryConfig

  constructor(config: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.config = config
  }

  async handleFailedPayment(paymentId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: true, customer: true }
    })

    if (!payment) throw new Error('Payment not found')

    const retryStrategy = await this.createRetryStrategy(payment)
    await this.scheduleNextRetry(retryStrategy)
    await this.sendNotifications(payment, retryStrategy)
  }

  private async createRetryStrategy(payment: any): Promise<any> {
    return await prisma.retryStrategy.create({
      data: {
        paymentId: payment.id,
        attemptsMade: 0,
        maxAttempts: this.config.maxAttempts,
        nextRetryDate: this.calculateNextRetryDate(0),
        intervals: JSON.stringify(this.config.intervals),
        status: 'PENDING'
      }
    })
  }

  private calculateNextRetryDate(attemptsMade: number): Date {
    if (attemptsMade >= this.config.intervals.length) {
      throw new Error('Max retry attempts exceeded')
    }

    const hoursDelay = this.config.intervals[attemptsMade]
    const nextDate = new Date()
    nextDate.setHours(nextDate.getHours() + hoursDelay)
    return nextDate
  }

  private async scheduleNextRetry(strategy: any): Promise<void> {
    // Here you would integrate with your job scheduler (e.g., Bull, Agenda)
    // For now, we'll just log the scheduling
    console.log(`Scheduled next retry for payment ${strategy.paymentId} at ${strategy.nextRetryDate}`)
  }

  private async sendNotifications(payment: any, strategy: any): Promise<void> {
    const notificationData = {
      customerName: payment.customer.name,
      amount: payment.amount,
      nextRetryDate: strategy.nextRetryDate,
      attemptsMade: strategy.attemptsMade
    }

    if (this.config.notificationChannels.includes('email')) {
      await sendEmail(payment.customer.email, 'payment_retry', notificationData)
    }

    if (this.config.notificationChannels.includes('slack')) {
      await sendSlackNotification('payment_retry', notificationData)
    }
  }

  async processRetry(strategyId: string): Promise<boolean> {
    const strategy = await prisma.retryStrategy.findUnique({
      where: { id: strategyId },
      include: { payment: true }
    })

    if (!strategy) throw new Error('Retry strategy not found')

    try {
      // Attempt to process the payment again
      // This would integrate with your payment processor
      const success = await this.retryPayment(strategy.payment)

      if (success) {
        await this.handleSuccessfulRetry(strategy)
        return true
      } else {
        await this.handleFailedRetry(strategy)
        return false
      }
    } catch (error) {
      console.error('Payment retry failed:', error)
      await this.handleFailedRetry(strategy)
      return false
    }
  }

  private async retryPayment(payment: any): Promise<boolean> {
    // Integrate with your payment processor here
    // For now, we'll simulate a success/failure
    return Math.random() > 0.5
  }

  private async handleSuccessfulRetry(strategy: any): Promise<void> {
    await prisma.retryStrategy.update({
      where: { id: strategy.id },
      data: { status: 'SUCCEEDED' }
    })

    await prisma.payment.update({
      where: { id: strategy.paymentId },
      data: { status: 'SUCCEEDED' }
    })
  }

  private async handleFailedRetry(strategy: any): Promise<void> {
    const newAttemptsMade = strategy.attemptsMade + 1

    if (newAttemptsMade >= this.config.maxAttempts) {
      await this.handleMaxRetriesExceeded(strategy)
      return
    }

    await prisma.retryStrategy.update({
      where: { id: strategy.id },
      data: {
        attemptsMade: newAttemptsMade,
        nextRetryDate: this.calculateNextRetryDate(newAttemptsMade)
      }
    })
  }

  private async handleMaxRetriesExceeded(strategy: any): Promise<void> {
    await prisma.retryStrategy.update({
      where: { id: strategy.id },
      data: { status: 'FAILED' }
    })

    // Trigger escalation workflow
    await this.escalateToManualIntervention(strategy)
  }

  private async escalateToManualIntervention(strategy: any): Promise<void> {
    // Implement your escalation logic here
    // This could include creating a support ticket, notifying account managers, etc.
    console.log(`Payment ${strategy.paymentId} requires manual intervention`)
  }
} 