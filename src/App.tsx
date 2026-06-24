import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HeroSection from './components/sections/HeroSection';
import TechnologiesSection from './components/sections/TechnologiesSection';
import ServicesSection from './components/sections/ServicesSection';
import CasesSection from './components/sections/CasesSection';
import SolutionsSection from './components/sections/SolutionsSection';
import AdvantagesSection from './components/sections/AdvantagesSection';
import ComparisonSection from './components/sections/ComparisonSection';
import BenefitsSection from './components/sections/BenefitsSection';
import FaqSection from './components/sections/FaqSection';
import AnimatedGradientBackground from './components/ui/AnimatedGradientBackground';
import ScrollToTop from './components/ui/ScrollToTop';

// Páginas de Vagas
import JobPostingPage from './pages/jobs/JobPosting';
import JobDetailView from './pages/jobs/JobDetailView';
import ApplicationFormPage from './pages/jobs/ApplicationForm';
import ApplicationSuccessPage from './pages/jobs/ApplicationSuccess';

// Páginas de Admin
import AdminLogin from './pages/admin/Login';
import CandidatesManagement from './pages/admin/CandidatesManagement';
import JobsManagement from './pages/admin/JobsManagement';
import CreateJobPage from './pages/admin/CreateJobPage';
import EditJobPage from './pages/admin/EditJobPage';
import BoardsManagement from './pages/admin/BoardsManagement';
import DevelopersManagement from './pages/admin/DevelopersManagement';
import UsersManagement from './pages/admin/UsersManagement';
import MetricsManagement from './pages/admin/MetricsManagement';
import DeveloperDetail from './pages/admin/DeveloperDetail';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProjectLogs from './pages/admin/ProjectLogs';
import AdminGuard from './components/admin/AdminGuard';
import AdminLayout from './components/admin/AdminLayout';

// Páginas e componentes de Usuário
import UserGuard from './components/user/UserGuard';
import UserLayout from './components/user/UserLayout';
import { BoardBackgroundProvider } from './context/BoardBackgroundContext';
import UserDashboard from './pages/user/Dashboard';
import MyJourneyDashboard from './pages/user/MyJourneyDashboard';
import KanbanGuard from './components/user/KanbanGuard';
import KanbanPage from './pages/user/KanbanPage';

function HomePage() {
  return (
    <>
      <HeroSection />
      <ServicesSection />
      <CasesSection />
      <SolutionsSection />
      <AdvantagesSection />
      <ComparisonSection />
      <BenefitsSection />
      <FaqSection />
      <TechnologiesSection />
    </>
  );
}

function AppContent() {
  const location = useLocation();
  const isAdminPath =
    location.pathname.startsWith('/admin') ||
    location.pathname === '/login' ||
    location.pathname === '/dashboard' ||
    location.pathname === '/jornada' ||
    location.pathname.startsWith('/quadro');

  return (
    <div className="relative flex flex-col min-h-screen overflow-x-hidden">
      {/* Animated gradient background across the entire app */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <AnimatedGradientBackground 
          Breathing 
          startingGap={125} 
          topOffset={0}
          gradientColors={["#000000", "#000000", "#000000", "#1E0B3A", "#6D28D9", "#A78BFA", "#FFFFFF"]}
          gradientStops={[0, 30, 50, 65, 75, 85, 100]}
        />
      </div>
      
      {!isAdminPath && <Header />}
      
      <main className="relative z-10 flex-1 flex flex-col">
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/vagas" element={<JobPostingPage />} />
            <Route path="/vaga/:slug" element={<JobDetailView />} />
            <Route path="/vaga/:slug/candidatar-se" element={<ApplicationFormPage />} />
            <Route path="/vaga/sucesso" element={<ApplicationSuccessPage />} />
            
            {/* User Routes */}
            <Route
              path="/dashboard"
              element={
                <UserGuard>
                  <BoardBackgroundProvider>
                    <UserLayout>
                      <UserDashboard />
                    </UserLayout>
                  </BoardBackgroundProvider>
                </UserGuard>
              }
            />

            <Route
              path="/jornada"
              element={
                <UserGuard>
                  <BoardBackgroundProvider>
                    <UserLayout>
                      <MyJourneyDashboard />
                    </UserLayout>
                  </BoardBackgroundProvider>
                </UserGuard>
              }
            />

            <Route 
              path="/quadro/:boardId" 
              element={
                <UserGuard>
                  <KanbanGuard>
                    <BoardBackgroundProvider>
                      <UserLayout fluid>
                        <KanbanPage />
                      </UserLayout>
                    </BoardBackgroundProvider>
                  </KanbanGuard>
                </UserGuard>
              } 
            />

            {/* Admin Routes */}
            <Route path="/login" element={<AdminLogin />} />
            <Route 
              path="/admin/*" 
              element={
                <AdminGuard>
                  <AdminLayout>
                    <Routes>
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="candidates" element={<CandidatesManagement />} />
                      <Route path="jobs" element={<JobsManagement />} />
                      <Route path="jobs/new" element={<CreateJobPage />} />
                      <Route path="jobs/edit/:id" element={<EditJobPage />} />
                      <Route path="boards" element={<BoardsManagement />} />
                      <Route path="boards/:boardId/logs" element={<ProjectLogs />} />
                      <Route path="developers" element={<DevelopersManagement />} />
                      <Route path="developers/:id" element={<DeveloperDetail />} />
                      <Route path="users" element={<UsersManagement />} />
                      <Route path="metrics" element={<MetricsManagement />} />
                    </Routes>
                  </AdminLayout>
                </AdminGuard>
              } 
            />
          </Routes>
        </div>
        {!isAdminPath && <Footer />}
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AppContent />
    </Router>
  );
}

export default App;