import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { LayoutAfterSignin } from './layout/LayoutAfterSignin';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { BoardsHomePage } from './pages/BoardsHomePage';
import { InteractiveBoardPage } from './pages/InteractiveBoardPage';
import { MapPage } from './pages/MapPage';
import './App.css';

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
