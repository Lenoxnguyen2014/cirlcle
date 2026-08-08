import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';
import { LayoutAfterSignin } from './layout/LayoutAfterSignin';
import { LoginPage } from './pages/Auth/LoginPage';
import { SignupPage } from './pages/Auth/SignupPage';
import { BoardsHomePage } from './pages/BoardsHome/BoardsHomePage';
import { BoardMapViewPage } from './pages/BoardMapView/BoardMapViewPage';
import { BoardView } from './pages/BoardMapView/BoardView';
import { MapView } from './pages/BoardMapView/MapView';

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
          {/* BoardMapViewPage is the shared parent for both views — it owns
              cards/presence/locations/day-colors once, so toggling between
              board and map (its two nested routes below) only swaps which
              child <Outlet> renders instead of remounting all of that. */}
          <Route
            path="/boards/:boardId"
            element={
              <RequireAuth>
                <LayoutAfterSignin>
                  <BoardMapViewPage />
                </LayoutAfterSignin>
              </RequireAuth>
            }
          >
            <Route index element={<BoardView />} />
            <Route path="map" element={<MapView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
