import { prisma } from '../../../lib/prisma';
import { User, Comment, Approval, CollaborationItem } from '@prisma/client';

interface CommentThread {
  id: string;
  comments: Comment[];
  status: 'open' | 'resolved';
  tags: string[];
  assignees: User[];
}

interface ApprovalWorkflow {
  id: string;
  steps: Array<{
    order: number;
    type: 'sequential' | 'parallel';
    approvers: User[];
    status: 'pending' | 'approved' | 'rejected';
    deadline?: Date;
  }>;
  currentStep: number;
  status: 'in_progress' | 'completed' | 'rejected';
}

interface CollaborationUpdate {
  itemId: string;
  userId: string;
  type: 'comment' | 'approval' | 'edit' | 'mention';
  content: any;
  timestamp: Date;
}

export class CollaborationService {
  // Initialize collaboration for an item
  async initializeCollaboration(
    itemType: string,
    itemId: string,
    creatorId: string,
    settings?: {
      requireApproval?: boolean;
      approvers?: string[];
      tags?: string[];
      visibility?: 'public' | 'private' | 'team';
    }
  ) {
    const collaborationItem = await prisma.collaborationItem.create({
      data: {
        itemType,
        itemId,
        creatorId,
        settings: settings || {},
        status: 'active',
        metadata: {
          createdAt: new Date(),
          lastActivity: new Date(),
          version: 1
        }
      }
    });

    if (settings?.requireApproval) {
      await this.createApprovalWorkflow(collaborationItem.id, settings.approvers || []);
    }

    return collaborationItem;
  }

  // Add a comment to an item
  async addComment(
    itemId: string,
    userId: string,
    content: string,
    options?: {
      parentCommentId?: string;
      mentions?: string[];
      tags?: string[];
      attachments?: string[];
    }
  ) {
    const comment = await prisma.comment.create({
      data: {
        itemId,
        userId,
        content,
        parentCommentId: options?.parentCommentId,
        mentions: options?.mentions || [],
        tags: options?.tags || [],
        attachments: options?.attachments || [],
        metadata: {
          createdAt: new Date(),
          editedAt: null,
          status: 'active'
        }
      }
    });

    // Process mentions and notifications
    if (options?.mentions?.length) {
      await this.processMentions(comment.id, options.mentions);
    }

    // Update item's last activity
    await this.updateLastActivity(itemId, 'comment', userId);

    return comment;
  }

  // Request approval for an item
  async requestApproval(
    itemId: string,
    requesterId: string,
    approvers: string[],
    options?: {
      deadline?: Date;
      priority?: 'low' | 'medium' | 'high';
      notes?: string;
    }
  ) {
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        itemId,
        requesterId,
        status: 'in_progress',
        steps: {
          create: approvers.map((approverId, index) => ({
            order: index + 1,
            approverId,
            status: index === 0 ? 'pending' : 'waiting',
            deadline: options?.deadline,
            priority: options?.priority || 'medium'
          }))
        },
        metadata: {
          notes: options?.notes,
          createdAt: new Date(),
          lastUpdated: new Date()
        }
      }
    });

    // Notify first approver
    await this.notifyApprover(workflow.id, approvers[0]);

    return workflow;
  }

  // Submit an approval decision
  async submitApprovalDecision(
    workflowId: string,
    approverId: string,
    decision: 'approve' | 'reject',
    comment?: string
  ) {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: { steps: true }
    });

    if (!workflow) throw new Error('Approval workflow not found');

    const currentStep = workflow.steps.find(
      step => step.status === 'pending' && step.approverId === approverId
    );

    if (!currentStep) throw new Error('Invalid approval step');

    // Update current step
    await prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: {
        status: decision === 'approve' ? 'approved' : 'rejected',
        decision: {
          create: {
            approverId,
            decision,
            comment,
            timestamp: new Date()
          }
        }
      }
    });

    if (decision === 'reject') {
      // Reject entire workflow
      await this.rejectWorkflow(workflow.id, approverId, comment);
    } else {
      // Move to next step if available
      const nextStep = workflow.steps.find(step => step.order === currentStep.order + 1);
      if (nextStep) {
        await prisma.approvalStep.update({
          where: { id: nextStep.id },
          data: { status: 'pending' }
        });
        await this.notifyApprover(workflow.id, nextStep.approverId);
      } else {
        // Complete workflow if all steps are approved
        await this.completeWorkflow(workflow.id);
      }
    }

    return await this.getWorkflowStatus(workflow.id);
  }

  // Get collaboration activity feed
  async getActivityFeed(
    itemId: string,
    options?: {
      limit?: number;
      offset?: number;
      types?: string[];
      userId?: string;
    }
  ) {
    const activities = await prisma.collaborationActivity.findMany({
      where: {
        itemId,
        ...(options?.types ? { type: { in: options.types } } : {}),
        ...(options?.userId ? { userId: options.userId } : {})
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        user: true,
        comments: true,
        approvals: true
      }
    });

    return activities;
  }

  // Private helper methods
  private async processMentions(commentId: string, mentions: string[]) {
    const notifications = mentions.map(userId => ({
      userId,
      type: 'mention',
      sourceId: commentId,
      sourceType: 'comment',
      status: 'unread',
      createdAt: new Date()
    }));

    await prisma.notification.createMany({
      data: notifications
    });
  }

  private async updateLastActivity(
    itemId: string,
    activityType: string,
    userId: string
  ) {
    await prisma.collaborationItem.update({
      where: { id: itemId },
      data: {
        metadata: {
          lastActivity: new Date(),
          lastActivityType: activityType,
          lastActivityBy: userId
        }
      }
    });
  }

  private async notifyApprover(workflowId: string, approverId: string) {
    await prisma.notification.create({
      data: {
        userId: approverId,
        type: 'approval_request',
        sourceId: workflowId,
        sourceType: 'approval_workflow',
        status: 'unread',
        createdAt: new Date()
      }
    });
  }

  private async rejectWorkflow(
    workflowId: string,
    rejectorId: string,
    reason?: string
  ) {
    await prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: 'rejected',
        metadata: {
          rejectedAt: new Date(),
          rejectedBy: rejectorId,
          rejectionReason: reason
        }
      }
    });

    // Notify workflow requestor
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: workflowId }
    });

    await prisma.notification.create({
      data: {
        userId: workflow!.requesterId,
        type: 'approval_rejected',
        sourceId: workflowId,
        sourceType: 'approval_workflow',
        status: 'unread',
        createdAt: new Date()
      }
    });
  }

  private async completeWorkflow(workflowId: string) {
    await prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: 'completed',
        metadata: {
          completedAt: new Date()
        }
      }
    });

    // Notify workflow requestor
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: workflowId }
    });

    await prisma.notification.create({
      data: {
        userId: workflow!.requesterId,
        type: 'approval_completed',
        sourceId: workflowId,
        sourceType: 'approval_workflow',
        status: 'unread',
        createdAt: new Date()
      }
    });
  }

  private async getWorkflowStatus(workflowId: string) {
    return await prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          include: {
            decision: true,
            approver: true
          }
        }
      }
    });
  }
} 