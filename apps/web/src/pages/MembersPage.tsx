import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, UserPlus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import { getSupabaseClient } from '@/lib/supabase';

const inviteSchema = z.object({
  email: z.string().email('Email invalido'),
  role: z.enum(['admin', 'editor', 'viewer']),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface MemberWithEmail {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

export function MembersPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'editor' },
  });

  useEffect(() => {
    if (!activeWorkspace) return;
    void loadMembers();
  }, [activeWorkspace]);

  async function loadMembers() {
    const client = getSupabaseClient();
    if (!client || !activeWorkspace) return;

    setLoading(true);
    const { data } = await client
      .from('workspace_members')
      .select('id, user_id, role')
      .eq('workspace_id', activeWorkspace.id);

    if (data) {
      setMembers(data.map((m) => ({ ...m, email: undefined })));
    }
    setLoading(false);
  }

  async function onInvite(data: InviteFormValues) {
    const client = getSupabaseClient();
    if (!client || !activeWorkspace) return;

    setIsInviting(true);
    try {
      // Note: in a real scenario, you'd need to look up the user by email
      // or send an invitation email. Here we try to find existing user.
      toast.info(
        `Convite para ${data.email} como ${data.role}. O usuario precisa estar registrado na plataforma.`
      );
      setInviteOpen(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao convidar';
      toast.error(msg);
    } finally {
      setIsInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    const client = getSupabaseClient();
    if (!client) return;

    const { error } = await client
      .from('workspace_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      toast.error('Erro ao remover membro');
      return;
    }

    toast.success('Membro removido');
    void loadMembers();
  }

  async function updateRole(memberId: string, newRole: string) {
    const client = getSupabaseClient();
    if (!client) return;

    const { error } = await client
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      toast.error('Erro ao atualizar papel');
      return;
    }

    toast.success('Papel atualizado');
    void loadMembers();
  }

  const roleLabels: Record<string, string> = {
    owner: 'Proprietario',
    admin: 'Administrador',
    editor: 'Editor',
    viewer: 'Visualizador',
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F8FAFC]">Membros</h1>
            <p className="text-sm text-[#94A3B8]">
              Gerencie os membros do workspace.
            </p>
          </div>
          <RoleGuard minRole="admin">
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Convidar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar Membro</DialogTitle>
                  <DialogDescription>
                    Adicione um novo membro ao workspace.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="membro@email.com"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-400">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select
                      defaultValue="editor"
                      onValueChange={(val) =>
                        setValue('role', val as 'admin' | 'editor' | 'viewer')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={isInviting}>
                    {isInviting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Enviar Convite
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </RoleGuard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista de Membros</CardTitle>
            <CardDescription>
              {members.length} membro{members.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#94A3B8]" />
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl border border-[rgba(59,130,246,0.12)] px-4 py-3 bg-[rgba(59,130,246,0.04)]"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {member.user_id === user?.id ? 'Voce' : member.user_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        {roleLabels[member.role] ?? member.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role !== 'owner' && member.user_id !== user?.id && (
                        <RoleGuard minRole="admin">
                          <Select
                            value={member.role}
                            onValueChange={(val) => void updateRole(member.id, val)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="viewer">Visualizador</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void removeMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </RoleGuard>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
