import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationRole: string;
  permissions: string[];
}

const availableRoles = [
  { id: 'OWNER', label: 'Owner', description: 'Full access to all billing and organizational settings' },
  { id: 'ADMIN', label: 'Admin', description: 'Can manage billing, but cannot delete organization' },
  { id: 'BILLING_MANAGER', label: 'Billing Manager', description: 'Can manage billing settings and view reports' },
  { id: 'MEMBER', label: 'Member', description: 'Can view billing information only' },
];

const billingPermissions = [
  { id: 'manage:billing', label: 'Manage Billing', description: 'Can modify billing settings and payment methods' },
  { id: 'view:billing', label: 'View Billing', description: 'Can view billing information and invoices' },
  { id: 'manage:subscriptions', label: 'Manage Subscriptions', description: 'Can modify subscription plans' },
  { id: 'view:subscriptions', label: 'View Subscriptions', description: 'Can view subscription details' },
  { id: 'manage:invoices', label: 'Manage Invoices', description: 'Can create and modify invoices' },
  { id: 'view:invoices', label: 'View Invoices', description: 'Can view invoice history' },
];

export default function TeamPermissionsManager() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/admin/team-members');
      if (!response.ok) throw new Error('Failed to fetch team members');
      const data = await response.json();
      setMembers(data);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    try {
      const response = await fetch('/api/organizations/members/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: memberId,
          organizationId: session?.user?.organizationId,
          role,
        }),
      });

      if (!response.ok) throw new Error('Failed to update member role');
      await fetchTeamMembers();
    } catch (error) {
      console.error('Error updating member role:', error);
    }
  };

  const updateMemberPermissions = async (memberId: string, permissions: string[]) => {
    try {
      const response = await fetch('/api/admin/team-members/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: memberId,
          permissions,
        }),
      });

      if (!response.ok) throw new Error('Failed to update member permissions');
      await fetchTeamMembers();
    } catch (error) {
      console.error('Error updating member permissions:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Permissions</CardTitle>
        <CardDescription>
          Manage team member roles and permissions for billing-related features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    No team members found
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Select
                        value={member.organizationRole}
                        onValueChange={(value) => updateMemberRole(member.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.permissions.map((permission) => (
                          <span
                            key={permission}
                            className="px-2 py-1 text-xs rounded-full bg-gray-100"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedMember(member)}
                          >
                            Edit Permissions
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Permissions - {member.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            {billingPermissions.map((permission) => (
                              <div key={permission.id} className="flex items-start space-x-3">
                                <Checkbox
                                  id={`${member.id}-${permission.id}`}
                                  checked={member.permissions.includes(permission.id)}
                                  onCheckedChange={(checked) => {
                                    const newPermissions = checked
                                      ? [...member.permissions, permission.id]
                                      : member.permissions.filter((p) => p !== permission.id);
                                    updateMemberPermissions(member.id, newPermissions);
                                  }}
                                />
                                <div className="space-y-1">
                                  <label
                                    htmlFor={`${member.id}-${permission.id}`}
                                    className="font-medium"
                                  >
                                    {permission.label}
                                  </label>
                                  <p className="text-sm text-gray-500">
                                    {permission.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}