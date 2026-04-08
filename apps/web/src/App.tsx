import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BootstrapProvider } from '@/components/layout/BootstrapProvider';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Wizard } from '@/components/wizard/Wizard';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';

const DashboardPage = React.lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const CreateCarouselPage = React.lazy(() =>
  import('@/pages/CreateCarouselPage').then((m) => ({ default: m.CreateCarouselPage }))
);
const EditorPage = React.lazy(() =>
  import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage }))
);
const TemplatesPage = React.lazy(() =>
  import('@/pages/TemplatesPage').then((m) => ({ default: m.TemplatesPage }))
);
const BrandKitsPage = React.lazy(() =>
  import('@/pages/BrandKitsPage').then((m) => ({ default: m.BrandKitsPage }))
);
const AIConfigPage = React.lazy(() =>
  import('@/pages/AIConfigPage').then((m) => ({ default: m.AIConfigPage }))
);
const MembersPage = React.lazy(() =>
  import('@/pages/MembersPage').then((m) => ({ default: m.MembersPage }))
);
const SettingsPage = React.lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

const SuspenseFallback = (
  <div className="flex items-center justify-center h-screen">Carregando...</div>
);

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={SuspenseFallback}>
        <Routes>
          {/* Public auth routes — outside BootstrapProvider */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* All other routes — wrapped by BootstrapProvider */}
          <Route
            path="/*"
            element={
              <BootstrapProvider wizard={<Wizard />}>
                <ProtectedRoute>
                  <Routes>
                    <Route
                      path="/editor/:id"
                      element={<EditorPage />}
                    />
                    <Route
                      path="/*"
                      element={
                        <AppShell>
                          <Routes>
                            <Route path="/" element={<DashboardPage />} />
                            <Route path="/create" element={<CreateCarouselPage />} />
                            <Route path="/templates" element={<TemplatesPage />} />
                            <Route path="/settings/brand-kits" element={<BrandKitsPage />} />
                            <Route path="/settings/ai" element={<AIConfigPage />} />
                            <Route path="/settings/members" element={<MembersPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </AppShell>
                      }
                    />
                  </Routes>
                </ProtectedRoute>
              </BootstrapProvider>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
