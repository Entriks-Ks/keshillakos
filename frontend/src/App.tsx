import { lazy, Suspense, type ReactNode } from 'react'
import { RouterProvider, Toast } from '@heroui/react'
import { BrowserRouter, Navigate, Route, Routes, useHref, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './auth/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import HomePage from './pages/HomePage'

const DashboardShell = lazy(() => import('./dashboard/DashboardShell'))
const AdminUsersPanel = lazy(() => import('./dashboard/AdminUsersPanel'))
const AvailabilityPanel = lazy(() => import('./dashboard/AvailabilityPanel'))
const AdminOverviewPage = lazy(() => import('./dashboard/OverviewPages').then((module) => ({ default: module.AdminOverviewPage })))
const CompanyOverviewPage = lazy(() => import('./dashboard/CompanyOverviewPage').then((module) => ({ default: module.CompanyOverviewPage })))
const ProviderOverviewPage = lazy(() => import('./dashboard/ProviderOverviewPage').then((module) => ({ default: module.ProviderOverviewPage })))
const UserOverviewPage = lazy(() => import('./dashboard/UserOverviewPage').then((module) => ({ default: module.UserOverviewPage })))
const OwnRatingsPage = lazy(() => import('./dashboard/SharedPages').then((module) => ({ default: module.OwnRatingsPage })))
const ProfilePage = lazy(() => import('./dashboard/SharedPages').then((module) => ({ default: module.ProfilePage })))
const SettingsPage = lazy(() => import('./dashboard/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const AdminRequestsPanel = lazy(() => import('./dashboard/RequestPanels').then((module) => ({ default: module.AdminRequestsPanel })))
const ProviderInboxPanel = lazy(() => import('./dashboard/ProviderInboxPage').then((module) => ({ default: module.ProviderInboxPage })))
const UserRequestsPanel = lazy(() => import('./dashboard/UserRequestsPage').then((module) => ({ default: module.UserRequestsPage })))
const MessagesPage = lazy(() => import('./dashboard/MessagesPage'))
const CompanyExpertsPanel = lazy(() => import('./dashboard/CompanyExpertsPanel'))
const ProviderServicesPanel = lazy(() => import('./dashboard/ProviderServicesPanel'))
const AdminFeedbackPanel = lazy(() => import('./dashboard/AdminFeedbackPanel'))
const DashboardRedirect = lazy(() => import('./pages/DashboardRedirect'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OffersPage = lazy(() => import('./pages/OffersPage'))
const CompanyOnboardingPage = lazy(() => import('./dashboard/OnboardingPages').then((module) => ({ default: module.CompanyOnboardingPage })))
const ExpertOnboardingPage = lazy(() => import('./dashboard/OnboardingPages').then((module) => ({ default: module.ExpertOnboardingPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ServiceDetailPage = lazy(() => import('./pages/ServiceDetailPage'))
const ProviderProfilePage = lazy(() => import('./pages/ProviderProfilePage'))

function CompanyOnboardingRedirect() {
  const { user } = useAuth()
  const roles = user?.roles ?? (user?.role ? [user.role] : [])
  if (roles.includes('company')) {
    return <Navigate to="/dashboard/company/create" replace />
  }
  return <Navigate to="/dashboard/user/create-company" replace />
}

function ExpertOnboardingRedirect() {
  const { user } = useAuth()
  const roles = user?.roles ?? (user?.role ? [user.role] : [])
  if (roles.includes('provider')) {
    return <Navigate to="/dashboard/provider/create" replace />
  }
  return <Navigate to="/dashboard/user/become-expert" replace />
}

function HeroRouterProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      <Suspense fallback={<div className="page-center"><p className="muted">Duke u ngarkuar...</p></div>}>
        {children}
      </Suspense>
    </RouterProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toast.Provider
        aria-label="Njoftime"
        className="kk-toast-region"
        placement="bottom end"
        maxVisibleToasts={3}
        width={360}
      />
      <BrowserRouter>
        <ScrollToTop />
        <HeroRouterProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/rreth-nesh" element={<AboutPage />} />
            <Route path="/kushtet" element={<LegalPage kind="terms" />} />
            <Route path="/privatesia" element={<LegalPage kind="privacy" />} />
            <Route path="/cookies" element={<LegalPage kind="cookies" />} />
            <Route path="/ofertat" element={<OffersPage />} />
            <Route path="/services/:id" element={<ServiceDetailPage />} />
            <Route path="/providers/:uid" element={<ProviderProfilePage />} />

            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/dashboard/profile/edit" element={<DashboardShell />}>
                <Route index element={<ProfilePage />} />
              </Route>
              <Route path="/dashboard/onboarding/expert" element={<ExpertOnboardingRedirect />} />
              <Route path="/dashboard/onboarding/company" element={<CompanyOnboardingRedirect />} />
            </Route>

            <Route element={<RoleRoute roles={['user']} />}>
              <Route path="/dashboard/user" element={<DashboardShell />}>
                <Route index element={<UserOverviewPage />} />
                <Route path="requests" element={<UserRequestsPanel />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="ratings" element={<Navigate to="/dashboard/user/requests" replace />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="become-expert" element={<ExpertOnboardingPage />} />
                <Route path="create-company" element={<CompanyOnboardingPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route element={<RoleRoute roles={['provider']} />}>
              <Route path="/dashboard/provider" element={<DashboardShell />}>
                <Route index element={<ProviderOverviewPage />} />
                <Route path="inbox" element={<ProviderInboxPanel />} />
                <Route path="my-requests" element={<UserRequestsPanel />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="services" element={<ProviderServicesPanel />} />
                <Route path="availability" element={<AvailabilityPanel />} />
                <Route path="ratings" element={<OwnRatingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/edit" element={<ProfilePage />} />
                <Route path="create" element={<ExpertOnboardingPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route element={<RoleRoute roles={['company']} />}>
              <Route path="/dashboard/company" element={<DashboardShell />}>
                <Route index element={<CompanyOverviewPage />} />
                <Route path="inbox" element={<ProviderInboxPanel />} />
                <Route path="my-requests" element={<UserRequestsPanel />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="services" element={<ProviderServicesPanel />} />
                <Route path="experts" element={<CompanyExpertsPanel />} />
                <Route path="availability" element={<AvailabilityPanel />} />
                <Route path="ratings" element={<OwnRatingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/edit" element={<ProfilePage />} />
                <Route path="create" element={<CompanyOnboardingPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="/dashboard/admin" element={<DashboardShell />}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="users" element={<AdminUsersPanel />} />
                <Route path="requests" element={<AdminRequestsPanel />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="feedback" element={<AdminFeedbackPanel />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/edit" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HeroRouterProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
