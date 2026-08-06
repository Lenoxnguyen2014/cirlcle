import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';
import { LayoutAfterSignin } from './layout/LayoutAfterSignin';
import { LoginPage } from './pages/Auth/LoginPage';
import { SignupPage } from './pages/Auth/SignupPage';
import { BoardsHomePage } from './pages/BoardsHome/BoardsHomePage';
import { InteractiveBoardPage } from './pages/InteractiveBoard/InteractiveBoardPage';
import { MapPage } from './pages/Map/MapPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <LayoutAfterSignin>
                  <BoardsHomePage />
                </LayoutAfterSignin>
              </RequireAuth>
            }
          />
          <Route
            path="/boards/:boardId"
            element={
              <RequireAuth>
                <LayoutAfterSignin>
                  <InteractiveBoardPage />
                </LayoutAfterSignin>
              </RequireAuth>
            }
          />
          <Route
            path="/boards/:boardId/map"
            element={
              <RequireAuth>
                <LayoutAfterSignin>
                  <MapPage />
                </LayoutAfterSignin>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
