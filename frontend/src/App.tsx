import { Toast } from '@heroui/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './auth/ProtectedRoute'
import DashboardShell from './dashboard/DashboardShell'
import AdminUsersPanel from './dashboard/AdminUsersPanel'
import AvailabilityPanel from './dashboard/AvailabilityPanel'
import {
  AdminOverviewPage,
  CompanyOverviewPage,
  ProviderOverviewPage,
  UserOverviewPage,
} from './dashboard/OverviewPages'
import { OwnRatingsPage, ProfilePage, SettingsPage } from './dashboard/SharedPages'
import {
  AdminRequestsPanel,
  ProviderInboxPanel,
  UserRequestsPanel,
} from './dashboard/RequestPanels'
import MessagesPage from './dashboard/MessagesPage'
import {
  CompanyExpertsPanel,
  ProviderServicesPanel,
} from './dashboard/panels'
import AdminFeedbackPanel from './dashboard/AdminFeedbackPanel'
import DashboardRedirect from './pages/DashboardRedirect'
import AboutPage from './pages/AboutPage'
import HomePage from './pages/HomePage'
import LegalPage from './pages/LegalPage'
import LoginPage from './pages/LoginPage'
import OffersPage from './pages/OffersPage'
import { CompanyOnboardingPage, ExpertOnboardingPage } from './dashboard/OnboardingPages'
import RegisterPage from './pages/RegisterPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import ProviderProfilePage from './pages/ProviderProfilePage'

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
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
