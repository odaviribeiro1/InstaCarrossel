import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState, useRef } from 'react';
import { Loader2, UserPlus, LogIn, Mail, ShieldCheck } from 'lucide-react';

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
import { useWizardStore } from '@/stores/wizard-store';
import { getSupabaseClient } from '@/lib/supabase';

const authSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type AuthFormValues = z.infer<typeof authSchema>;

export function WizardStepAuth() {
  const { setCurrentStep } = useWizardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'register' | 'login' | 'verify'>('register');
  const [otpCode, setOtpCode] = useState('');
  const pendingEmail = useRef('');
  const pendingPassword = useRef('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: AuthFormValues) {
    const client = getSupabaseClient();
    if (!client) {
      toast.error('Supabase nao configurado');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await client.auth.signUp({
          email: data.email,
          password: data.password,
          options: { data: { role: 'owner' } },
        });

        if (error) {
          if (error.message?.includes('already registered')) {
            toast.error('Email ja cadastrado. Faca login.');
            setMode('login');
            return;
          }
          throw error;
        }

        // Try to sign in immediately (works if email confirmation is disabled)
        const { error: signInError } = await client.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (!signInError) {
          // Email confirmation disabled — logged in directly
          toast.success('Conta criada com sucesso!');
          await new Promise((r) => setTimeout(r, 500));
          setCurrentStep(3);
          return;
        }

        // Email confirmation is enabled — show OTP screen
        pendingEmail.current = data.email;
        pendingPassword.current = data.password;
        setMode('verify');
        toast.success('Codigo de verificacao enviado para ' + data.email);
      } else {
        // Login mode
        const { error } = await client.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) throw error;

        toast.success('Login realizado com sucesso!');
        await new Promise((r) => setTimeout(r, 500));
        setCurrentStep(3);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na autenticacao';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyOtp() {
    const client = getSupabaseClient();
    if (!client) return;

    if (otpCode.length < 6) {
      toast.error('Insira o codigo de 6 digitos');
      return;
    }

    setIsLoading(true);

    try {
      // Verify OTP
      const { error } = await client.auth.verifyOtp({
        email: pendingEmail.current,
        token: otpCode,
        type: 'signup',
      });

      if (error) throw error;

      // OTP verified — now sign in with password
      const { error: signInError } = await client.auth.signInWithPassword({
        email: pendingEmail.current,
        password: pendingPassword.current,
      });

      if (signInError) throw signInError;

      // Clear sensitive data
      pendingPassword.current = '';

      toast.success('Email verificado com sucesso!');
      await new Promise((r) => setTimeout(r, 500));
      setCurrentStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Codigo invalido';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function resendCode() {
    const client = getSupabaseClient();
    if (!client || !pendingEmail.current) return;

    try {
      await client.auth.resend({
        email: pendingEmail.current,
        type: 'signup',
      });
      toast.success('Codigo reenviado para ' + pendingEmail.current);
    } catch {
      toast.error('Erro ao reenviar codigo');
    }
  }

  // OTP verification screen
  if (mode === 'verify') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
              <ShieldCheck className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <div>
              <CardTitle>Verificar Email</CardTitle>
              <CardDescription>
                Enviamos um codigo de 6 digitos para <strong>{pendingEmail.current}</strong>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Codigo de Verificacao</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />
          </div>

          <Button
            onClick={verifyOtp}
            className="w-full"
            disabled={isLoading || otpCode.length < 6}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verificar
          </Button>

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-[#94A3B8] hover:text-[#F8FAFC]"
              onClick={resendCode}
            >
              Reenviar codigo
            </button>
            <button
              type="button"
              className="text-sm text-[#94A3B8] hover:text-[#F8FAFC]"
              onClick={() => {
                setMode('register');
                setOtpCode('');
              }}
            >
              Alterar email
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
            <Mail className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              Verifique sua caixa de entrada e spam. O codigo expira em 60 minutos.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Register / Login screen
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
            {mode === 'register' ? (
              <UserPlus className="h-5 w-5 text-[#3B82F6]" />
            ) : (
              <LogIn className="h-5 w-5 text-[#3B82F6]" />
            )}
          </div>
          <div>
            <CardTitle>{mode === 'register' ? 'Criar Conta' : 'Fazer Login'}</CardTitle>
            <CardDescription>
              {mode === 'register'
                ? 'Crie sua conta de administrador para gerenciar a plataforma.'
                : 'Entre com suas credenciais.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimo 6 caracteres"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-400">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'register' ? 'Criar Conta' : 'Entrar'}
          </Button>

          <p className="text-center text-sm text-[#94A3B8]">
            {mode === 'register' ? (
              <>
                Ja tem conta?{' '}
                <button type="button" className="text-[#3B82F6] underline" onClick={() => setMode('login')}>
                  Fazer login
                </button>
              </>
            ) : (
              <>
                Nao tem conta?{' '}
                <button type="button" className="text-[#3B82F6] underline" onClick={() => setMode('register')}>
                  Criar conta
                </button>
              </>
            )}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
