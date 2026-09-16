import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
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
  AdminDomainsPanel,
  CompanyExpertsPanel,
  ProviderServicesPanel,
  UserRateProvidersPanel,
} from './dashboard/panels'
import DashboardRedirect from './pages/DashboardRedirect'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OffersPage from './pages/OffersPage'
import RegisterPage from './pages/RegisterPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import ProviderProfilePage from './pages/ProviderProfilePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ofertat" element={<OffersPage />} />
          <Route path="/services/:id" element={<ServiceDetailPage />} />
          <Route path="/providers/:uid" element={<ProviderProfilePage />} />

          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardRedirect />} />
          </Route>

          <Route element={<RoleRoute roles={['user']} />}>
            <Route path="/dashboard/user" element={<DashboardShell />}>
              <Route index element={<UserOverviewPage />} />
              <Route path="requests" element={<UserRequestsPanel />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="ratings" element={<UserRateProvidersPanel />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<RoleRoute roles={['provider']} />}>
            <Route path="/dashboard/provider" element={<DashboardShell />}>
              <Route index element={<ProviderOverviewPage />} />
              <Route path="inbox" element={<ProviderInboxPanel />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="services" element={<ProviderServicesPanel />} />
              <Route path="availability" element={<AvailabilityPanel />} />
              <Route path="ratings" element={<OwnRatingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<RoleRoute roles={['company']} />}>
            <Route path="/dashboard/company" element={<DashboardShell />}>
              <Route index element={<CompanyOverviewPage />} />
              <Route path="inbox" element={<ProviderInboxPanel />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="experts" element={<CompanyExpertsPanel />} />
              <Route path="availability" element={<AvailabilityPanel />} />
              <Route path="ratings" element={<OwnRatingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/dashboard/admin" element={<DashboardShell />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="users" element={<AdminUsersPanel />} />
              <Route path="requests" element={<AdminRequestsPanel />} />
              <Route path="inbox" element={<ProviderInboxPanel />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="domains" element={<AdminDomainsPanel />} />
              <Route path="services" element={<ProviderServicesPanel />} />
              <Route path="availability" element={<AvailabilityPanel />} />
              <Route path="experts" element={<CompanyExpertsPanel />} />
              <Route path="ratings" element={<OwnRatingsPage />} />
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
