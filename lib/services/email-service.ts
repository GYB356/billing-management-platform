import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export class EmailService {
  /**
   * Process scheduled win-back campaign emails
   */
  public async processWinBackEmails() {
    const now = new Date();

    // Find all pending emails that are due
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        sent: false,
        error: null,
        scheduledFor: {
          lte: now
        },
        template: {
          in: ['immediate_win_back', 'seven_day_win_back', 'final_win_back']
        }
      },
      include: {
        organization: true
      }
    });

    // Process each email
    for (const email of pendingEmails) {
      try {
        // Check if campaign is still valid
        const campaign = await prisma.winBackCampaign.findFirst({
          where: {
            organizationId: email.organizationId,
            validUntil: {
              gt: now
            },
            status: 'PENDING'
          }
        });

        if (!campaign) {
          // Campaign expired or already handled
          await prisma.scheduledEmail.update({
            where: { id: email.id },
            data: {
              sent: true,
              sentAt: now,
              error: 'Campaign no longer active'
            }
          });
          continue;
        }

        // Send the win-back email
        await sendEmail(
          email.organization.email!,
          email.template,
          {
            ...email.data,
            offerType: campaign.offer.type,
            offerDetails: campaign.offer.details,
            validUntil: campaign.validUntil.toISOString()
          }
        );

        // Update email status
        await prisma.scheduledEmail.update({
          where: { id: email.id },
          data: {
            sent: true,
            sentAt: now
          }
        });
      } catch (error: any) {
        // Log error and update email status
        console.error('Error processing win-back email:', error);
        await prisma.scheduledEmail.update({
          where: { id: email.id },
          data: {
            error: error.message || 'Failed to send win-back email'
          }
        });
      }
    }
  }

  /**
   * Process campaign acceptance
   */
  public async handleWinBackAcceptance(
    campaignId: string,
    organizationId: string
  ) {
    const campaign = await prisma.winBackCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
        status: 'PENDING',
        validUntil: {
          gt: new Date()
        }
      },
      include: {
        subscription: true
      }
    });

    if (!campaign) {
      throw new Error('Campaign not found or no longer valid');
    }

    // Apply the win-back offer
    if (campaign.offer.type === 'DISCOUNT') {
      // Create a special discount coupon for the customer
      await prisma.coupon.create({
        data: {
          code: `WINBACK-${campaign.subscriptionId}`,
          description: 'Win-back discount',
          discountType: 'percentage',
          discountAmount: campaign.offer.details.percentOff,
          maxRedemptions: 1,
          expiresAt: new Date(Date.now() + campaign.offer.details.durationMonths * 30 * 24 * 60 * 60 * 1000)
        }
      });
    } else if (campaign.offer.type === 'TRIAL_EXTENSION') {
      // Extend trial period
      await prisma.subscription.update({
        where: { id: campaign.subscriptionId },
        data: {
          trialEndsAt: new Date(Date.now() + campaign.offer.details.durationDays * 24 * 60 * 60 * 1000)
        }
      });
    }

    // Update campaign status
    await prisma.winBackCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date()
      }
    });

    // Cancel any remaining win-back emails
    await prisma.scheduledEmail.updateMany({
      where: {
        organizationId,
        template: {
          in: ['seven_day_win_back', 'final_win_back']
        },
        sent: false
      },
      data: {
        sent: true,
        error: 'Campaign accepted'
      }
    });
  }
}