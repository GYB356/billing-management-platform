import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { InvoiceService, type IInvoiceService } from '@/lib/services/invoice-service'
import { UsageService, type IUsageService } from '@/lib/services/usage-service'
import { Stripe as StripeClient, type Stripe } from 'stripe'
import { EventManager, type IEventManager } from '@/lib/events'
import { BackgroundJobManager, type IBackgroundJobManager } from '@/lib/background-jobs/background-job-manager'
import { Config, type IConfig } from '@/lib/config'
import { SubscriptionService, type ISubscriptionService } from '@/lib/services/subscription-service'
import { IPrisma } from '@/lib/prisma'
import { IBackgroundJob } from '@/lib/background-jobs/background-job'
import { BackgroundJob } from '@/lib/background-jobs/background-job'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma: IPrisma = new PrismaClient()
  const config: IConfig = Config.getConfig()
  const stripe: Stripe = new StripeClient(config.stripe.secretKey)
  const eventManager: IEventManager = new EventManager()
  const backgroundJobManager: IBackgroundJobManager = new BackgroundJobManager(prisma)
  const backgroundJob: IBackgroundJob = BackgroundJob
  
  const invoiceService: IInvoiceService = new InvoiceService(
    prisma,
    stripe,
    eventManager,
  )
  const usageService: IUsageService = new UsageService(
    prisma,
    stripe,
    eventManager,
  )

  const subscriptionService: ISubscriptionService = new SubscriptionService(
    invoiceService,
    usageService,
    prisma,
    stripe,
    eventManager,
    backgroundJobManager,
    backgroundJob,
    config,
  )

  try {
    const subscriptions = await subscriptionService.getCurrentPlan({
      userId: session.user.id,
    })

    if (subscriptions.length === 0) {
        return NextResponse.json({
          message: 'No current subscriptions found',
        }, { status: 200 })
      }
    const subscription = subscriptions[0]

    return NextResponse.json({
      subscription: subscription,
    }, { status: 200 })

  } catch (error) {
    console.error('Error getting current plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
