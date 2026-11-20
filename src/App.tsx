import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LandingPage } from './pages/public/LandingPage';
import {
  DocumentationPage,
  FeaturesPage,
  PricingPage,
  SecurityPage,
} from './pages/public/MarketingPages';
import { AuthPage } from './pages/public/AuthPage';
import { FirestoreErrorBoundary } from './components/FirestoreErrorBoundary';

const DashboardPage = lazy(() => import('./pages/app/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const RepositoriesPage = lazy(() => import('./pages/app/RepositoriesPage').then((m) => ({ default: m.RepositoriesPage })));
const RepositoryDetailPage = lazy(() => import('./pages/app/RepositoryDetailPage').then((m) => ({ default: m.RepositoryDetailPage })));
const ScannerPage = lazy(() => import('./pages/app/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const ScansPage = lazy(() => import('./pages/app/ScansPage').then((m) => ({ default: m.ScansPage })));
const DiagnosisPage = lazy(() => import('./pages/app/DiagnosisPage').then((m) => ({ default: m.DiagnosisPage })));
const FixCenterPage = lazy(() => import('./pages/app/FixCenterPage').then((m) => ({ default: m.FixCenterPage })));
const AssistantPage = lazy(() => import('./pages/app/AssistantPage').then((m) => ({ default: m.AssistantPage })));
const SecurityCenterPage = lazy(() => import('./pages/app/FindingsCategoryPages').then((m) => ({ default: m.SecurityCenterPage })));
const CodeQualityPage = lazy(() => import('./pages/app/FindingsCategoryPages').then((m) => ({ default: m.CodeQualityPage })));
const DependenciesPage = lazy(() => import('./pages/app/DependenciesPage').then((m) => ({ default: m.DependenciesPage })));
const ArchitecturePage = lazy(() => import('./pages/app/ArchitecturePage').then((m) => ({ default: m.ArchitecturePage })));
const AnalyticsPage = lazy(() => import('./pages/app/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const ReportsPage = lazy(() => import('./pages/app/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const NotificationsPage = lazy(() => import('./pages/app/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const AiSettingsPage = lazy(() => import('./pages/app/AiSettingsPage').then((m) => ({ default: m.AiSettingsPage })));
const SettingsPage = lazy(() => import('./pages/app/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const TeamPage = lazy(() => import('./pages/app/TeamPage').then((m) => ({ default: m.TeamPage })));
const AdminMetricsPage = lazy(() => import('./pages/app/AdminMetricsPage').then((m) => ({ default: m.AdminMetricsPage })));

function WorkspaceFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#101014] text-sm text-[#777783]">
      Loading Repo Health workspace...
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  if (loading) {
    return <WorkspaceFallback />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Suspense fallback={<WorkspaceFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Marketing & Auth Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/documentation" element={<DocumentationPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />

            {/* Authenticated /app Workspace Routes */}
            <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/app/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/repositories" element={<ProtectedRoute><RepositoriesPage /></ProtectedRoute>} />
            <Route path="/app/repositories/:id" element={<ProtectedRoute><RepositoryDetailPage /></ProtectedRoute>} />
            <Route path="/app/scanner" element={<ProtectedRoute><ScannerPage /></ProtectedRoute>} />
            <Route path="/app/scans" element={<ProtectedRoute><ScansPage /></ProtectedRoute>} />
            <Route path="/app/diagnosis" element={<ProtectedRoute><DiagnosisPage /></ProtectedRoute>} />
            <Route path="/app/fix-center" element={<ProtectedRoute><FixCenterPage /></ProtectedRoute>} />
            <Route path="/app/assistant" element={<ProtectedRoute><AssistantPage /></ProtectedRoute>} />
            <Route path="/app/security" element={<ProtectedRoute><SecurityCenterPage /></ProtectedRoute>} />
            <Route path="/app/code-quality" element={<ProtectedRoute><CodeQualityPage /></ProtectedRoute>} />
            <Route path="/app/dependencies" element={<ProtectedRoute><DependenciesPage /></ProtectedRoute>} />
            <Route path="/app/architecture" element={<ProtectedRoute><ArchitecturePage /></ProtectedRoute>} />
            <Route path="/app/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/app/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/app/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/app/settings/ai" element={<ProtectedRoute><AiSettingsPage /></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/app/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
            <Route
              path="/app/admin/metrics"
              element={
                <ProtectedRoute>
                  <FirestoreErrorBoundary>
                    <AdminMetricsPage />
                  </FirestoreErrorBoundary>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
